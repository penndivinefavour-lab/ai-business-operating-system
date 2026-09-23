// tests/tenant-isolation.test.ts

import { describe, it, expect, beforeAll } from 'vitest';
import { openDb } from '../src/db/client.ts';
import { migrate } from '../src/db/schema.ts';
import { createHotel, createRoom, listRooms, listReservations, createReservation } from '../src/db/repositories.ts';
import { addDays } from '../src/core/time.ts';

let hotelA: number;
let hotelB: number;

beforeAll(() => {
  openDb();
  migrate();
  hotelA = createHotel({ slug: 'iso-a', name: 'Hotel A' });
  hotelB = createHotel({ slug: 'iso-b', name: 'Hotel B' });
  createRoom(hotelA, { number: '101', roomType: 'standard', basePrice: 25000 });
  createRoom(hotelA, { number: '102', roomType: 'standard', basePrice: 25000 });
  createRoom(hotelB, { number: '201', roomType: 'suite', basePrice: 50000 });
});

describe('Tenant isolation', () => {
  it('hotel A rooms are isolated from hotel B', () => {
    const roomsA = listRooms(hotelA);
    const roomsB = listRooms(hotelB);
    expect(roomsA.length).toBe(2);
    expect(roomsB.length).toBe(1);
    const aIds = roomsA.map(r => r.id);
    const bIds = roomsB.map(r => r.id);
    expect(aIds.filter(id => bIds.includes(id)).length).toBe(0);
  });

  it('hotel A cannot access hotel B reservations', () => {
    createReservation(hotelB, {
      customerId: null,
      checkIn: '2026-10-01',
      checkOut: '2026-10-02',
      guests: 1,
      roomIds: listRooms(hotelB).map(r => r.id),
      totalAmount: 50000,
    });
    const resA = listReservations(hotelA, 'all');
    const resB = listReservations(hotelB, 'all');
    expect(resA.length).toBe(0);
    expect(resB.length).toBe(1);
  });
});
