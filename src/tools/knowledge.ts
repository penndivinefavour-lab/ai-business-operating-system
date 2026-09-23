// src/tools/knowledge.ts

import type { DatabaseClient } from '../adapters/database/index.js';
import type { ToolResult } from '../types/index.js';
import { z } from 'zod';

const SearchKnowledgeInput = z.object({
  tenant_id: z.string(),
  query: z.string(),
  type: z.string().optional(),
});

export async function searchKnowledge(
  db: DatabaseClient,
  input: z.infer<typeof SearchKnowledgeInput>
): Promise<ToolResult> {
  const parsed = SearchKnowledgeInput.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message, message: 'Invalid input' };
  }

  const { tenant_id, query, type } = parsed.data;

  try {
    const docs = await db.searchKnowledge(tenant_id, query);
    const filtered = type ? docs.filter(d => d.type === type) : docs;

    if (filtered.length === 0) {
      return {
        success: true,
        data: [],
        message: "I couldn't find specific information about that. Would you like me to connect you with a team member who can help?",
      };
    }

    // Return top result content
    const topDoc = filtered[0];

    return {
      success: true,
      data: filtered,
      message: topDoc.content,
    };
  } catch (error: any) {
    return { success: false, error: error.message, message: 'Error searching knowledge base' };
  }
}

const GetPolicyInput = z.object({
  tenant_id: z.string(),
  policy_type: z.string(),
});

export async function getPolicy(
  db: DatabaseClient,
  input: z.infer<typeof GetPolicyInput>
): Promise<ToolResult> {
  const parsed = GetPolicyInput.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message, message: 'Invalid input' };
  }

  const { tenant_id, policy_type } = parsed.data;

  try {
    const docs = await db.searchKnowledge(tenant_id, policy_type);
    const policyDoc = docs.find(d => d.type === 'policy') || docs[0];

    if (!policyDoc) {
      return {
        success: true,
        data: null,
        message: "I don't have that policy information available right now. Let me connect you with a team member.",
      };
    }

    return {
      success: true,
      data: policyDoc,
      message: policyDoc.content,
    };
  } catch (error: any) {
    return { success: false, error: error.message, message: 'Error retrieving policy' };
  }
}
