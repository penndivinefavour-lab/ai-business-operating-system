// src/tools/escalation.ts

import type { DatabaseClient } from '../adapters/database/index.js';
import type { ToolResult, Escalation } from '../types/index.js';
import { z } from 'zod';

const CreateEscalationInput = z.object({
  tenant_id: z.string(),
  conversation_id: z.string(),
  reason: z.string(),
  context: z.record(z.unknown()).optional(),
});

export async function escalateToHuman(
  db: DatabaseClient,
  input: z.infer<typeof CreateEscalationInput>
): Promise<ToolResult> {
  const parsed = CreateEscalationInput.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message, message: 'Invalid input' };
  }

  const { tenant_id, conversation_id, reason, context } = parsed.data;

  try {
    const escalation = await db.createEscalation({
      tenant_id,
      conversation_id,
      reason,
      status: 'open',
      assigned_to: '',
      context: context || {},
    });

    // Update conversation status
    await db.updateConversation(conversation_id, { status: 'escalated' });

    return {
      success: true,
      data: escalation,
      message: `I understand. Let me connect you with a team member who can better assist you. Please hold on while I transfer your conversation.`,
    };
  } catch (error: any) {
    return { success: false, error: error.message, message: 'Error creating escalation' };
  }
}

const GetEscalationsInput = z.object({
  tenant_id: z.string(),
  status: z.string().optional(),
});

export async function getEscalations(
  db: DatabaseClient,
  input: z.infer<typeof GetEscalationsInput>
): Promise<ToolResult> {
  const parsed = GetEscalationsInput.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message, message: 'Invalid input' };
  }

  const { tenant_id, status } = parsed.data;

  try {
    const escalations = await db.getEscalations(tenant_id);
    const filtered = status ? escalations.filter(e => e.status === status) : escalations;

    return {
      success: true,
      data: filtered,
      message: `Found ${filtered.length} escalation(s)${status ? ` with status "${status}"` : ''}.`,
    };
  } catch (error: any) {
    return { success: false, error: error.message, message: 'Error retrieving escalations' };
  }
}

const ResolveEscalationInput = z.object({
  escalation_id: z.string(),
  assigned_to: z.string().optional(),
});

export async function resolveEscalation(
  db: DatabaseClient,
  input: z.infer<typeof ResolveEscalationInput>
): Promise<ToolResult> {
  const parsed = ResolveEscalationInput.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message, message: 'Invalid input' };
  }

  const { escalation_id, assigned_to } = parsed.data;

  try {
    await db.updateEscalation(escalation_id, {
      status: 'resolved',
      assigned_to: assigned_to || 'human_agent',
    });

    return {
      success: true,
      data: { id: escalation_id, status: 'resolved' },
      message: 'Escalation has been resolved.',
    };
  } catch (error: any) {
    return { success: false, error: error.message, message: 'Error resolving escalation' };
  }
}
