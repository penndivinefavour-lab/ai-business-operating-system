// src/tools/customer.ts

import type { DatabaseClient } from '../adapters/database/index.js';
import type { ToolResult } from '../types/index.js';
import { z } from 'zod';

const GetCustomerInput = z.object({
  tenant_id: z.string(),
  phone: z.string(),
});

export async function getCustomerByPhone(
  db: DatabaseClient,
  input: z.infer<typeof GetCustomerInput>
): Promise<ToolResult> {
  const parsed = GetCustomerInput.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message, message: 'Invalid input' };
  }

  const { tenant_id, phone } = parsed.data;

  try {
    const customer = await db.getCustomerByPhone(tenant_id, phone);
    
    if (!customer) {
      return {
        success: true,
        data: null,
        message: "I don't see a profile for this number. Would you like to create one?",
      };
    }

    return {
      success: true,
      data: customer,
      message: `Welcome back, ${customer.name}! You have ${customer.total_stays} stay(s) with us. How can I help you today?`,
    };
  } catch (error: any) {
    return { success: false, error: error.message, message: 'Error looking up customer' };
  }
}

const CreateCustomerInput = z.object({
  tenant_id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().optional(),
});

export async function createCustomer(
  db: DatabaseClient,
  input: z.infer<typeof CreateCustomerInput>
): Promise<ToolResult> {
  const parsed = CreateCustomerInput.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message, message: 'Invalid input' };
  }

  const { tenant_id, name, phone, email } = parsed.data;

  try {
    // Check if customer already exists
    const existing = await db.getCustomerByPhone(tenant_id, phone);
    if (existing) {
      return {
        success: true,
        data: existing,
        message: `Welcome back, ${existing.name}! I found your existing profile.`,
      };
    }

    const customer = await db.createCustomer({
      tenant_id,
      name,
      phone,
      email: email || '',
      total_stays: 0,
      total_spent_cents: 0,
      preferences: '',
      notes: '',
    });

    return {
      success: true,
      data: customer,
      message: `Welcome, ${name}! I've created your profile. You're now ready to make bookings with us.`,
    };
  } catch (error: any) {
    return { success: false, error: error.message, message: 'Error creating customer' };
  }
}
