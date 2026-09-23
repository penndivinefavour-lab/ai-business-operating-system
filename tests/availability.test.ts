// tests/availability.test.ts
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { processMessage } from '../src/core/orchestrator.ts';
import { openDb } from '../src/db/client.ts';
import { migrate } from '../src/db/schema.ts';
import { seedDemoHotel } from '../src/db/seed.ts';
import { getHotelBySlug, listRooms, listKnowledge } from '../src/db/repositories.ts';

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

describe('check availability through orchestrator', () => {
  it('returns availability when rooms exist', async () => {
    const result = await processMessage({
      hotelId: demoHotelId,
      channel: 'web',
      text: 'Do you have a room for friday?',
    });
    assert.ok(result.reply);
    assert.equal(result.intent, 'availability');
    assert.equal(result.provider, 'demo');
  });

  it('returns price information', async () => {
    const result = await processMessage({
      hotelId: demoHotelId,
      channel: 'web',
      text: 'How much is the executive room?',
    });
    assert.ok(result.reply);
    // Should mention actual prices from DB (38000 FCFA)
    assert.ok(result.reply.includes('38'), 'Should mention executive room price');
  });

  it('handles location query', async () => {
    const result = await processMessage({
      hotelId: demoHotelId,
      channel: 'web',
      text: 'Where are you located?',
    });
    assert.ok(result.reply);
    // Should mention actual hotel location (Douala)
    assert.ok(result.reply.toLowerCase().includes('douala'), 'Should mention Douala');
  });
});

describe('demo hotel exists', () => {
  it('has rooms seeded', () => {
    const rooms = listRooms(demoHotelId);
    assert.ok(rooms.length > 0);
  });

  it('has knowledge base seeded', () => {
    const items = listKnowledge(demoHotelId);
    assert.ok(items.length > 5);
  });
});
