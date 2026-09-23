import type {
  AgentContext,
  Customer,
  Hotel,
  Intent,
  MessageRow,
  OrchestratorResult,
  ToolResult,
  UserMessage,
} from '../types.ts';
import {
  addMessage,
  createConversation,
  findCustomerByPhone,
  getConversation,
  getCustomer,
  getHotelById,
  listMessages,
  recordAgentRun,
  updateConversationStatus,
  updateCustomer,
  upsertCustomerByPhone,
} from '../db/repositories.ts';
import { classify, classifyLanguage } from '../core/intents.ts';
import { normalizePhone } from '../core/format.ts';
import { ToolRegistry, ToolSandbox } from '../core/tools/registry.ts';
import { registerAll } from '../core/tools/catalog.ts';
import { agentForIntent } from '../agents/index.ts';
import { createProvider } from '../llm/provider.ts';
import { config } from '../config.ts';
import type { LlmRequest } from '../types.ts';

/**
 * The AI Orchestrator.
 *
 * Customer -> channel -> orchestrator -> specialist agent -> governed tools ->
 * business database -> reply (optionally rephrased by an LLM, always verified
 * against tool facts). Business state changes ONLY happen through tools the
 * agent is explicitly permitted to call.
 */

export const registry = new ToolRegistry();
registerAll(registry);

/** Capability set per intent = the permission boundary. No intent may exceed its list. */
export const AGENT_CAPABILITIES: Record<Intent, ReadonlySet<string>> = {
  greeting: new Set(),
  thanks: new Set(),
  goodbye: new Set(),
  availability: new Set(['availability.check']),
  price: new Set(['price.check']),
  booking: new Set(['availability.check', 'reservation.request']),
  booking_confirm: new Set(['reservation.confirm', 'followup.create']),
  booking_cancel: new Set(['reservation.cancel']),
  location: new Set(['hotel.info', 'knowledge.search']),
  checkin_policy: new Set(['knowledge.search']),
  checkout_time: new Set(['knowledge.search']),
  amenities: new Set(['knowledge.search']),
  feedback: new Set(['feedback.log', 'followup.create']),
  escalation: new Set(['escalation.create']),
  lead_capture: new Set(['lead.create', 'followup.create']),
  customer_lookup: new Set(['customer.lookup']),
  faq: new Set(['knowledge.search']),
  unknown: new Set(['knowledge.search']),
};

/** Explicitly read-only intents (no business data mutation allowed). */
export const READONLY_INTENTS: ReadonlySet<string> = new Set([
  'greeting', 'thanks', 'goodbye', 'availability', 'price', 'location',
  'checkin_policy', 'checkout_time', 'amenities', 'customer_lookup', 'faq',
]);

function resolveCustomer(hotel: Hotel, input: UserMessage): Customer | null {
  if (input.customerId) {
    return getCustomer(hotel.id, input.customerId) ?? null;
  }
  const contact = input.contact;
  if (contact?.phone) {
    const phone = normalizePhone(contact.phone);
    const existing = findCustomerByPhone(hotel.id, phone);
    if (existing) {
      return updateCustomer(hotel.id, existing.id, {
        name: contact.name || existing.name,
        email: contact.email || existing.email,
      }) ?? existing;
    }
    return upsertCustomerByPhone(hotel.id, {
      phone,
      name: contact.name ?? '',
      email: contact.email ?? '',
      source: input.channel,
    });
  }
  if (contact?.email || contact?.name) {
    return upsertCustomerByPhone(hotel.id, {
      phone: '',
      email: contact.email ?? '',
      name: contact.name ?? '',
      source: input.channel,
    });
  }
  return null;
}

function resolveConversation(hotel: Hotel, input: UserMessage, customer: Customer | null): { id: number; intentLast: string } {
  if (input.conversationId) {
    const conv = getConversation(hotel.id, input.conversationId);
    if (conv) return { id: conv.id, intentLast: conv.intent_last };
  }
  const id = createConversation(hotel.id, customer?.id ?? null, input.channel);
  return { id, intentLast: '' };
}

export async function processMessage(input: UserMessage): Promise<OrchestratorResult> {
  const hotel = getHotelById(input.hotelId);
  if (!hotel) throw new Error(`hotel not found: ${input.hotelId}`);

  const customer = resolveCustomer(hotel, input);
  const { id: conversationId, intentLast } = resolveConversation(hotel, input, customer);

  addMessage(hotel.id, conversationId, 'guest', input.text);

  const classification = classify(input.text, intentLast);
  if (classification.intent !== 'unknown') {
    const lang = classifyLanguage(input.text);
    if (customer) updateCustomer(hotel.id, customer.id, { language: lang });
  }

  const history = listMessages(hotel.id, conversationId);
  const ctx: AgentContext = { hotel, customer, conversationId, history, classification };
  const capabilities = AGENT_CAPABILITIES[classification.intent] ?? new Set<string>();
  const sandbox = new ToolSandbox(registry, capabilities);

  const handler = agentForIntent(classification.intent) ?? agentForIntent('unknown')!;
  const started = Date.now();
  const agentOutput = await handler({ ctx, sandbox });
  const latency = Date.now() - started;

  const actions: ToolResult[] = [...sandbox.results];
  let reply = agentOutput.reply;

  const llm = createProvider();
  if (llm.name !== 'demo' && config.ai.composeReplies && agentOutput.facts.length > 0) {
    const req: LlmRequest = {
      hotel,
      customer,
      conversationId,
      history,
      language: classifyLanguage(input.text),
      intent: classification.intent,
      facts: agentOutput.facts,
      actions,
      proposedReply: reply,
    };
    try {
      reply = await llm.composeReply(req);
    } catch {
      // Never fail the guest turn because the LLM is down -> fall back deterministic.
    }
  }

  addMessage(hotel.id, conversationId, 'ai', reply);

  const finalStatus =
    classification.intent === 'escalation' ? 'escalated'
    : classification.intent === 'goodbye' ? 'resolved'
    : classification.intent === 'booking' && agentOutput.pendingConfirmationId ? 'awaiting'
    : 'open';
  updateConversationStatus(hotel.id, conversationId, finalStatus, classification.intent);

  recordAgentRun(
    hotel.id,
    conversationId,
    classification.intent,
    classification.confidence,
    JSON.stringify(actions.map((a) => ({ tool: a.tool, ok: a.ok }))),
    latency,
  );

  return {
    reply,
    intent: classification.intent,
    confidence: classification.confidence,
    actions,
    conversationId,
    customer: customer ? getCustomer(hotel.id, customer.id) ?? customer : null,
    changed: agentOutput.changed,
    provider: llm.name,
  };
}


