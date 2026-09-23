// tests/availability.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { processMessage } from '../src/core/orchestrator.ts';
import { openDb, closeDb } from '../src/db/client.ts';
import { migrate } from '../src/db/schema.ts';
import { seedDemoHotel, hashPassword } from '../src/db/seed.ts';
import { getHotelBySlug, createHotel, createHotelUser } from '../src/db/repositories.ts';

let demoHotelId: number;

beforeAll(() => {
  openDb();
  migrate();
  // Reset and seed
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
    expect(result.reply).toBeTruthy();
    expect(result.intent).toBe('availability');
    // Should either show availability or say none available (never hallucinate)
    expect(result.provider).toBe('demo');
  });

  it('returns price information', async () => {
    const result = await processMessage({
      hotelId: demoHotelId,
      channel: 'web',
      text: 'How much is the executive room?',
    });
    expect(result.reply).toBeTruthy();
    // Should mention actual prices from DB (38000 FCFA)
    expect(result.reply).toContain('38');
  });

  it('handles location query', async () => {
    const result = await processMessage({
      hotelId: demoHotelId,
      channel: 'web',
      text: 'Where are you located?',
    });
    expect(result.reply).toBeTruthy();
    // Should mention actual hotel location (Douala)
    expect(result.reply.toLowerCase()).toContain('douala');
  });
});

describe('demo hotel exists', () => {
  it('has rooms seeded', async () => {
    const { listRooms } = await import('../src/db/repositories.ts');
    const rooms = listRooms(demoHotelId);
    expect(rooms.length).toBeGreaterThan(0);
  });

  it('has knowledge base seeded', async () => {
    const { listKnowledge } = await import('../src/db/repositories.ts');
    const items = listKnowledge(demoHotelId);
    expect(items.length).toBeGreaterThan(5);
  });
});
