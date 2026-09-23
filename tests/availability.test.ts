// tests/availability.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processMessage } from '../src/core/orchestrator.ts';
import { openDb } from '../src/db/client.ts';
import { migrate } from '../src/db/schema.ts';
import { createHotel, createRoom, createKnowledgeItem, listRooms, listKnowledge } from '../src/db/repositories.ts';

openDb();
migrate();

const ts = Date.now();
const hotelId = createHotel({ slug: `avail-${ts}`, name: 'Avail Test Hotel' });
createRoom(hotelId, { number: '101', roomType: 'standard', name: 'Chambre Standard', basePrice: 25000 });
createRoom(hotelId, { number: '102', roomType: 'standard', name: 'Chambre Standard', basePrice: 25000 });
createRoom(hotelId, { number: '201', roomType: 'executive', name: 'Chambre Exécutive', basePrice: 38000 });
createKnowledgeItem(hotelId, { category: 'location', question: 'Where are you?', answer: 'We are in Test City.' });

test('returns availability when rooms exist', async () => {
  const result = await processMessage({
    hotelId,
    channel: 'web',
    text: 'Do you have rooms for friday?',
  });
  assert.ok(result.reply);
  assert.equal(result.intent, 'availability');
  assert.equal(result.provider, 'demo');
});

test('returns price information', async () => {
  const result = await processMessage({
    hotelId,
    channel: 'web',
    text: 'How much is the executive room?',
  });
  assert.ok(result.reply);
  assert.ok(result.reply.includes('38'), 'Should mention executive room price');
});

test('handles location query', async () => {
  const result = await processMessage({
    hotelId,
    channel: 'web',
    text: 'Where are you located?',
  });
  assert.ok(result.reply);
  assert.ok(result.reply.toLowerCase().includes('test city'), 'Should mention test city');
});

test('has rooms seeded', () => {
  const rooms = listRooms(hotelId);
  assert.ok(rooms.length > 0);
});

test('has knowledge base seeded', () => {
  const items = listKnowledge(hotelId);
  assert.ok(items.length > 0);
});
