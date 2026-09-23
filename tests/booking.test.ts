// tests/booking.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processMessage } from '../src/core/orchestrator.ts';
import { openDb } from '../src/db/client.ts';
import { migrate } from '../src/db/schema.ts';
import { seedDemoHotel } from '../src/db/seed.ts';
import { listHotels } from '../src/db/repositories.ts';

openDb();
migrate();

const existing = listHotels();
const demo = existing.find((h) => h.slug === 'demo');
const demoHotelId = demo ? demo.id : seedDemoHotel();

test('initiates booking when guest requests a room', async () => {
  const result = await processMessage({
    hotelId: demoHotelId,
    channel: 'web',
    text: 'I want to book a room for two nights',
  });
  assert.ok(result.reply);
  assert.equal(result.intent, 'booking');
});

test('handles booking confirmation', async () => {
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

test('does not hallucinate room availability', async () => {
  const result = await processMessage({
    hotelId: demoHotelId,
    channel: 'web',
    text: 'Do you have a presidential suite for tomorrow?',
  });
  const reply = result.reply.toLowerCase();
  assert.ok(!reply.match(/presidential/), 'Should not claim presidential suite');
});
