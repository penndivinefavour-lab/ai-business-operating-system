// tests/tenant-isolation.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkAvailability } from '../src/tools/availability.js';
import type { DatabaseClient } from '../src/adapters/database/index.js';

const mockDb = {
  getRooms: vi.fn(),
  getOverlappingBookings: vi.fn(),
} as unknown as DatabaseClient;

describe('Tenant Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('never returns data from another tenant', async () => {
    // Hotel B should not see Hotel A's rooms
    mockDb.getRooms.mockImplementation(async (tenantId: string) => {
      if (tenantId === 'hotel-b') return []; // Hotel B has no rooms
      return [{ id: 'room-a', tenant_id: 'hotel-a', type: 'Standard', name: 'A Room', description: '', price_cents: 25000, amenities: [], total_count: 3, images: [], created_at: '' }];
    });
    mockDb.getOverlappingBookings.mockResolvedValue([]);

    const result = await checkAvailability(mockDb, { tenant_id: 'hotel-b', date: '2026-10-01' });

    // Should not leak Hotel A's room data
    expect(result.message).toContain("don't have");
  });

  it('always filters by tenant_id in queries', async () => {
    mockDb.getRooms.mockResolvedValue([]);
    mockDb.getOverlappingBookings.mockResolvedValue([]);

    await checkAvailability(mockDb, { tenant_id: 'specific-tenant', date: '2026-10-01' });

    // Verify tenant_id was passed to query
    expect(mockDb.getRooms).toHaveBeenCalledWith('specific-tenant');
  });
});
