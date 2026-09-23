// tests/multi-turn.test.ts
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

test('multi-turn: availability → follow-up → booking flow', async () => {
  const turn1 = await processMessage({
    hotelId: demoHotelId,
    channel: 'web',
    text: 'Do you have rooms for friday?',
  });
  assert.equal(turn1.intent, 'availability');
  assert.ok(turn1.conversationId);

  const turn2 = await processMessage({
    hotelId: demoHotelId,
    channel: 'web',
    text: 'How much is the standard room?',
    conversationId: turn1.conversationId,
  });
  assert.equal(turn2.intent, 'price');
  assert.ok(turn2.reply.includes('25'), 'Should mention standard room price 25000');

  const turn3 = await processMessage({
    hotelId: demoHotelId,
    channel: 'web',
    text: 'Book it for me',
    conversationId: turn1.conversationId,
  });
  assert.equal(turn3.intent, 'booking');
});

test('employee identity is used in greeting', async () => {
  const result = await processMessage({
    hotelId: demoHotelId,
    channel: 'web',
    text: 'Hello!',
  });
  assert.ok(result.reply);
  assert.ok(result.reply.toLowerCase().includes('sarah') || result.reply.toLowerCase().includes('bonjour'));
});

test('tool results are factual', async () => {
  const result = await processMessage({
    hotelId: demoHotelId,
    channel: 'web',
    text: 'What are your room rates?',
  });
  assert.ok(result.reply);
  assert.ok(result.reply.includes('25') || result.reply.includes('38'));
  assert.ok(!result.reply.includes('99999'));
});
