// src/tools/booking.ts

import type { DatabaseClient } from '../adapters/database/index.js';
import type { ToolResult } from '../types/index.js';
import { z } from 'zod';

const CreateBookingInput = z.object({
  tenant_id: z.string(),
  customer_id: z.string(),
  room_id: z.string(),
  check_in: z.string(), // YYYY-MM-DD
  check_out: z.string(), // YYYY-MM-DD
  special_requests: z.string().optional(),
});

export async function createBooking(
  db: DatabaseClient,
  input: z.infer<typeof CreateBookingInput>
): Promise<ToolResult> {
  const parsed = CreateBookingInput.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message, message: 'Invalid input' };
  }

  const { tenant_id, customer_id, room_id, check_in, check_out, special_requests } = parsed.data;

  try {
    // Check for overlapping bookings
    const overlapping = await db.getOverlappingBookings(tenant_id, room_id, check_in, check_out);
    if (overlapping.length > 0) {
      return {
        success: false,
        message: `Sorry, this room is not available from ${check_in} to ${check_out}. Please try different dates.`,
      };
    }

    // Get room price
    const room = await db.getRoom(tenant_id, room_id);
    
    // Calculate total
    const nights = Math.ceil((new Date(check_out).getTime() - new Date(check_in).getTime()) / (1000 * 60 * 60 * 24));
    const total_cents = room.price_cents * nights;

    // Create booking
    const booking = await db.createBooking({
      tenant_id,
      customer_id,
      room_id,
      check_in,
      check_out,
      status: 'pending',
      total_cents,
      special_requests: special_requests || '',
    });

    // Update customer stats
    const customerRes = await db.list('customers', `id="${customer_id}"`);
    const customerRecord = customerRes.items?.[0] as any;
    if (customerRecord) {
      await db.updateCustomer(customer_id, {
        total_stays: (customerRecord.total_stays || 0) + 1,
        total_spent_cents: (customerRecord.total_spent_cents || 0) + total_cents,
      });
    }

    return {
      success: true,
      data: booking,
      message: `✅ Booking confirmed!\n\nRoom: ${room.name}\nCheck-in: ${check_in}\nCheck-out: ${check_out}\nTotal: ${total_cents / 100} FCFA\n\nPlease arrive at the front desk to complete check-in. Would you like to add any special requests?`,
    };
  } catch (error: any) {
    return { success: false, error: error.message, message: 'Error creating booking' };
  }
}

const CancelBookingInput = z.object({
  tenant_id: z.string(),
  booking_id: z.string(),
  reason: z.string().optional(),
});

export async function cancelBooking(
  db: DatabaseClient,
  input: z.infer<typeof CancelBookingInput>
): Promise<ToolResult> {
  const parsed = CancelBookingInput.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message, message: 'Invalid input' };
  }

  const { tenant_id, booking_id, reason } = parsed.data;

  try {
    const bookings = await db.getBookings(tenant_id, { id: booking_id });
    if (!bookings.length) {
      return { success: false, message: 'Booking not found.' };
    }

    if (bookings[0].status === 'cancelled') {
      return { success: false, message: 'This booking is already cancelled.' };
    }

    await db.updateBooking(booking_id, { status: 'cancelled' });

    return {
      success: true,
      data: { booking_id, status: 'cancelled' },
      message: `Your booking has been cancelled. ${reason ? `Reason: ${reason}.` : ''}\n\nCancellation policy: Cancellations made 48 hours before check-in are fully refunded. Is there anything else I can help with?`,
    };
  } catch (error: any) {
    return { success: false, error: error.message, message: 'Error cancelling booking' };
  }
}

const GetCustomerBookingsInput = z.object({
  tenant_id: z.string(),
  customer_id: z.string(),
});

export async function getCustomerBookings(
  db: DatabaseClient,
  input: z.infer<typeof GetCustomerBookingsInput>
): Promise<ToolResult> {
  const parsed = GetCustomerBookingsInput.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message, message: 'Invalid input' };
  }

  const { tenant_id, customer_id } = parsed.data;

  try {
    const bookings = await db.getBookings(tenant_id, { customer_id });
    
    if (!bookings.length) {
      return { success: true, data: [], message: "I couldn't find any bookings for this customer." };
    }

    const bookingList = bookings
      .map(b => `• ${b.check_in} to ${b.check_out} — ${b.status} (${b.total_cents / 100} FCFA)`)
      .join('\n');

    return {
      success: true,
      data: bookings,
      message: `Found ${bookings.length} booking(s):\n${bookingList}`,
    };
  } catch (error: any) {
    return { success: false, error: error.message, message: 'Error retrieving bookings' };
  }
}
