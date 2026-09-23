// tests/availability.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkAvailability, getRoomPrice } from '../src/tools/availability.js';
import type { DatabaseClient } from '../src/adapters/database/index.js';

const mockDb = {
  getRooms: vi.fn(),
  getOverlappingBookings: vi.fn(),
  getRoom: vi.fn(),
} as unknown as DatabaseClient;

describe('checkAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns available rooms when no conflicts', async () => {
    mockDb.getRooms.mockResolvedValue([
      { id: 'room1', tenant_id: 't1', type: 'Standard', name: 'Standard Room', description: '', price_cents: 25000, amenities: [], total_count: 3, images: [], created_at: '' },
    ]);
    mockDb.getOverlappingBookings.mockResolvedValue([]);

    const result = await checkAvailability(mockDb, { tenant_id: 't1', date: '2026-10-01' });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Yes!');
  });

  it('returns none available when all booked', async () => {
    mockDb.getRooms.mockResolvedValue([
      { id: 'room1', tenant_id: 't1', type: 'Standard', name: 'Standard Room', description: '', price_cents: 25000, amenities: [], total_count: 2, images: [], created_at: '' },
    ]);
    // 2 overlapping = 0 available
    mockDb.getOverlappingBookings.mockResolvedValue([
      { id: 'b1' }, { id: 'b2' },
    ]);

    const result = await checkAvailability(mockDb, { tenant_id: 't1', date: '2026-10-01' });

    expect(result.success).toBe(true);
    expect(result.message).toContain("don't have");
  });

  it('validates input schema', async () => {
    const result = await checkAvailability(mockDb, { tenant_id: '', date: '' });
    expect(result.success).toBe(false);
  });

  it('filters by room type when provided', async () => {
    mockDb.getRooms.mockResolvedValue([
      { id: 'room1', tenant_id: 't1', type: 'Standard', name: 'Standard Room', description: '', price_cents: 25000, amenities: [], total_count: 3, images: [], created_at: '' },
      { id: 'room2', tenant_id: 't1', type: 'Executive', name: 'Executive Room', description: '', price_cents: 75000, amenities: [], total_count: 2, images: [], created_at: '' },
    ]);
    mockDb.getOverlappingBookings.mockResolvedValue([]);

    const result = await checkAvailability(mockDb, { tenant_id: 't1', date: '2026-10-01', room_type: 'Executive' });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Executive');
  });
});

describe('getRoomPrice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns price for matching room type', async () => {
    mockDb.getRooms.mockResolvedValue([
      { id: 'room1', tenant_id: 't1', type: 'Executive', name: 'Executive Room', description: 'Luxury room', price_cents: 75000, amenities: [], total_count: 2, images: [], created_at: '' },
    ]);

    const result = await getRoomPrice(mockDb, { tenant_id: 't1', room_type: 'Executive' });

    expect(result.success).toBe(true);
    expect(result.message).toContain('750');
  });

  it('returns not found message when no matching room', async () => {
    mockDb.getRooms.mockResolvedValue([
      { id: 'room1', tenant_id: 't1', type: 'Standard', name: 'Standard Room', description: '', price_cents: 25000, amenities: [], total_count: 3, images: [], created_at: '' },
    ]);

    const result = await getRoomPrice(mockDb, { tenant_id: 't1', room_type: 'Presidential' });

    expect(result.success).toBe(true);
    expect(result.message).toContain("couldn't find");
  });
});
