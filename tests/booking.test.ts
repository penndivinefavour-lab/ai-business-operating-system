// tests/booking.test.ts
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { processMessage } from '../src/core/orchestrator.ts';
import { openDb } from '../src/db/client.ts';
import { migrate } from '../src/db/schema.ts';
import { seedDemoHotel } from '../src/db/seed.ts';
import { getHotelBySlug } from '../src/db/repositories.ts';

let demoHotelId: number;

before(() => {
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
    assert.ok(result.reply);
    assert.equal(result.intent, 'booking');
  });

  it('handles booking confirmation', async () => {
    const start = await processMessage({
      hotelId: demoHotelId,
      channel: 'web',
      text: 'I want to book a standard room',
    });
    assert.ok(start.conversationId);

    const confirm = await processMessage({
      hotelId: demoHotelId,
      channel: 'web',
      text: 'yes',
      conversationId: start.conversationId,
    });
    assert.ok(confirm.reply);
    assert.equal(confirm.intent, 'booking_confirm');
  });

  it('does not hallucinate room availability', async () => {
    const result = await processMessage({
      hotelId: demoHotelId,
      channel: 'web',
      text: 'Do you have a presidential suite for tomorrow?',
    });
    const reply = result.reply.toLowerCase();
    assert.ok(!reply.match(/presidential/), 'Should not claim presidential suite');
  });
});
