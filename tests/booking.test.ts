// tests/booking.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { processMessage } from '../src/core/orchestrator.ts';
import { openDb } from '../src/db/client.ts';
import { migrate } from '../src/db/schema.ts';
import { seedDemoHotel } from '../src/db/seed.ts';
import { getHotelBySlug } from '../src/db/repositories.ts';

let demoHotelId: number;

beforeAll(() => {
  openDb();
  migrate();
  const existing = getHotelBySlug('demo');
  if (!existing) {
    demoHotelId = seedDemoHotel(true);
  } else {
    demoHotelId = existing.id;
  }
});

describe('booking flow', () => {
  it('initiates booking when guest requests a room', async () => {
    const result = await processMessage({
      hotelId: demoHotelId,
      channel: 'web',
      text: 'I want to book a room for two nights',
    });
    expect(result.reply).toBeTruthy();
    expect(result.intent).toBe('booking');
    // Should mention rooms/prices from DB, never invent
    expect(result.changed).toBe(true);
  });

  it('handles booking confirmation', async () => {
    // First start a booking
    const start = await processMessage({
      hotelId: demoHotelId,
      channel: 'web',
      text: 'I want to book a standard room',
    });
    expect(start.conversationId).toBeTruthy();

    // Then confirm
    const confirm = await processMessage({
      hotelId: demoHotelId,
      channel: 'web',
      text: 'yes',
      conversationId: start.conversationId,
    });
    expect(confirm.reply).toBeTruthy();
    expect(confirm.intent).toBe('booking_confirm');
  });

  it('does not hallucinate room availability', async () => {
    const result = await processMessage({
      hotelId: demoHotelId,
      channel: 'web',
      text: 'Do you have a presidential suite for tomorrow?',
    });
    // Should either say no or not mention any suite we don't have
    // The demo hotel has "Suite Junior" and "Suite Prestige" but no "Presidential"
    const reply = result.reply.toLowerCase();
    // Should not claim to have a presidential suite
    expect(reply).not.toMatch(/presidential/);
  });
});
