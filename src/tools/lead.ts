// src/tools/lead.ts

import type { DatabaseClient } from '../adapters/database/index.js';
import type { ToolResult } from '../types/index.js';
import { z } from 'zod';

const CreateLeadInput = z.object({
  tenant_id: z.string(),
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  interest: z.string(),
  source: z.string().optional(),
});

export async function createLead(
  db: DatabaseClient,
  input: z.infer<typeof CreateLeadInput>
): Promise<ToolResult> {
  const parsed = CreateLeadInput.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message, message: 'Invalid input' };
  }

  const { tenant_id, name, phone, email, interest, source } = parsed.data;

  try {
    const lead = await db.createLead({
      tenant_id,
      name: name || 'Unknown',
      phone: phone || '',
      email: email || '',
      interest,
      status: 'new',
      source: source || 'whatsapp',
    });

    return {
      success: true,
      data: lead,
      message: "Thank you for your interest! We've noted your inquiry and our team will follow up with you shortly.",
    };
  } catch (error: any) {
    return { success: false, error: error.message, message: 'Error creating lead' };
  }
}

const GetLeadsInput = z.object({
  tenant_id: z.string(),
  status: z.string().optional(),
});

export async function getLeads(
  db: DatabaseClient,
  input: z.infer<typeof GetLeadsInput>
): Promise<ToolResult> {
  const parsed = GetLeadsInput.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message, message: 'Invalid input' };
  }

  const { tenant_id, status } = parsed.data;

  try {
    const leads = await db.getLeads(tenant_id, status);
    
    return {
      success: true,
      data: leads,
      message: `Found ${leads.length} lead(s)${status ? ` with status "${status}"` : ''}.`,
    };
  } catch (error: any) {
    return { success: false, error: error.message, message: 'Error retrieving leads' };
  }
}
