// src/tools/feedback.ts

import type { DatabaseClient } from '../adapters/database/index.js';
import type { ToolResult } from '../types/index.js';
import { z } from 'zod';

const CreateFeedbackInput = z.object({
  tenant_id: z.string(),
  customer_id: z.string().optional(),
  booking_id: z.string().optional(),
  rating: z.number().min(1).max(5),
  comment: z.string(),
});

export async function submitFeedback(
  db: DatabaseClient,
  input: z.infer<typeof CreateFeedbackInput>
): Promise<ToolResult> {
  const parsed = CreateFeedbackInput.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message, message: 'Invalid input' };
  }

  const { tenant_id, customer_id, booking_id, rating, comment } = parsed.data;

  try {
    const feedback = await db.createFeedback({
      tenant_id,
      customer_id: customer_id || '',
      booking_id: booking_id || '',
      rating,
      comment,
      status: 'new',
    });

    const responseMsg = rating <= 2
      ? `I'm very sorry to hear about your experience. Your feedback has been logged and our manager will review it immediately. We'd love the chance to make things right.`
      : rating <= 3
      ? `Thank you for your feedback. We're sorry we didn't fully meet your expectations. We'll use your comments to improve.`
      : `Thank you so much for your positive feedback! We're thrilled you enjoyed your stay.`;

    return {
      success: true,
      data: feedback,
      message: responseMsg,
    };
  } catch (error: any) {
    return { success: false, error: error.message, message: 'Error submitting feedback' };
  }
}

const GetFeedbackInput = z.object({
  tenant_id: z.string(),
  status: z.string().optional(),
});

export async function getFeedback(
  db: DatabaseClient,
  input: z.infer<typeof GetFeedbackInput>
): Promise<ToolResult> {
  const parsed = GetFeedbackInput.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message, message: 'Invalid input' };
  }

  const { tenant_id, status } = parsed.data;

  try {
    const feedback = await db.getFeedback(tenant_id);
    const filtered = status ? feedback.filter(f => f.status === status) : feedback;

    return {
      success: true,
      data: filtered,
      message: `Found ${filtered.length} feedback item(s)${status ? ` with status "${status}"` : ''}.`,
    };
  } catch (error: any) {
    return { success: false, error: error.message, message: 'Error retrieving feedback' };
  }
}
