import type { LlmProvider, LlmRequest } from '../types.ts';
import type { AiConfig } from './openai-compatible.ts';
import { verifyReplyAgainstFacts } from './guard.ts';

/**
 * Anthropic Messages API client. Credentials come from env vars.
 */
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  private readonly cfg: AiConfig;

  constructor(cfg: AiConfig) {
    this.cfg = cfg;
  }

  async composeReply(req: LlmRequest): Promise<string> {
    if (!this.cfg.apiKey) return req.proposedReply;

    const system = [
      `You are the AI Digital Front Desk voice of "${req.hotel.name}". Reply in the guest's language, warmly but professionally. You MUST NOT invent or estimate ANY price, availability, date, room, or policy. If unsure, restate the verified facts only or offer a human. Keep it short and natural.`,
      `VERIFIED FACTS (use these and only these for anything factual):\n${req.facts.map((f) => `- ${f}`).join('\n')}`,
    ].join('\n\n');

    const body = {
      model: this.cfg.model || 'claude-3-5-haiku-latest',
      max_tokens: 500,
      temperature: 0.4,
      system,
      messages: [
        ...req.history.slice(-6).map((m) => ({
          role: m.sender === 'guest' ? ('user' as const) : ('assistant' as const),
          content: m.body,
        })),
        {
          role: 'user' as const,
          content: `Rephrase the following proposed reply naturally in the guest's language, staying strictly within the VERIFIED FACTS:\n"""${req.proposedReply}"""`,
        },
      ],
    };

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.cfg.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      throw new Error(`Anthropic ${res.status}: ${text}`);
    }

    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const reply = (json.content?.find((c) => c.type === 'text')?.text ?? '').trim();
    if (!reply) return req.proposedReply;
    return verifyReplyAgainstFacts(reply, req.facts, req.proposedReply) ? reply : req.proposedReply;
  }
}