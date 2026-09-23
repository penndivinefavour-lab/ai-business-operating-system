// tests/booking.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBooking, cancelBooking, getCustomerBookings } from '../src/tools/booking.js';
import type { DatabaseClient } from '../src/adapters/database/index.js';

const mockDb = {
  getOverlappingBookings: vi.fn(),
  getRoom: vi.fn(),
  createBooking: vi.fn(),
  updateCustomer: vi.fn(),
  list: vi.fn(),
  getBookings: vi.fn(),
  updateBooking: vi.fn(),
} as unknown as DatabaseClient;

describe('createBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates booking when room is available', async () => {
    mockDb.getOverlappingBookings.mockResolvedValue([]);
    mockDb.getRoom.mockResolvedValue({ id: 'room1', tenant_id: 't1', type: 'Standard', name: 'Standard Room', description: '', price_cents: 25000, amenities: [], total_count: 3, images: [], created_at: '' });
    mockDb.createBooking.mockResolvedValue({ id: 'booking1' });
    mockDb.list.mockResolvedValue({ items: [{ total_stays: 0, total_spent_cents: 0 }] });
    mockDb.updateCustomer.mockResolvedValue({});

    const result = await createBooking(mockDb, {
      tenant_id: 't1',
      customer_id: 'cust1',
      room_id: 'room1',
      check_in: '2026-10-01',
      check_out: '2026-10-02',
      special_requests: 'Late arrival',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('confirmed');
  });

  it('rejects booking when room is not available', async () => {
    mockDb.getOverlappingBookings.mockResolvedValue([{ id: 'existing1' }]);

    const result = await createBooking(mockDb, {
      tenant_id: 't1',
      customer_id: 'cust1',
      room_id: 'room1',
      check_in: '2026-10-01',
      check_out: '2026-10-02',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('not available');
  });

  it('validates input schema', async () => {
    const result = await createBooking(mockDb, { tenant_id: '', customer_id: '', room_id: '', check_in: '', check_out: '' });
    expect(result.success).toBe(false);
  });
});

describe('cancelBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancels existing booking', async () => {
    mockDb.getBookings.mockResolvedValue([{ id: 'booking1', status: 'confirmed', total_cents: 25000 }]);
    mockDb.updateBooking.mockResolvedValue({});

    const result = await cancelBooking(mockDb, {
      tenant_id: 't1',
      booking_id: 'booking1',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('cancelled');
  });

  it('returns error for non-existent booking', async () => {
    mockDb.getBookings.mockResolvedValue([]);

    const result = await cancelBooking(mockDb, {
      tenant_id: 't1',
      booking_id: 'nonexistent',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });
});
