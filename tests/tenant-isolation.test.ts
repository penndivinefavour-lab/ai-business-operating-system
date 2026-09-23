// tests/tenant-isolation.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db/client.ts';
import { migrate } from '../src/db/schema.ts';
import { createHotel, createRoom, listRooms, listReservations, createReservation } from '../src/db/repositories.ts';

openDb();
migrate();

// Create isolated test hotels (use unique slugs to avoid conflict with demo seed)
const hotelA = createHotel({ slug: `test-a-${Date.now()}`, name: 'Test Hotel A' });
const hotelB = createHotel({ slug: `test-b-${Date.now() + 1}`, name: 'Test Hotel B' });
createRoom(hotelA, { number: '101', roomType: 'standard', basePrice: 25000 });
createRoom(hotelA, { number: '102', roomType: 'standard', basePrice: 25000 });
createRoom(hotelB, { number: '201', roomType: 'suite', basePrice: 50000 });

test('hotel A rooms are isolated from hotel B', () => {
  const roomsA = listRooms(hotelA);
  const roomsB = listRooms(hotelB);
  assert.equal(roomsA.length, 2);
  assert.equal(roomsB.length, 1);
  const aIds = roomsA.map(r => r.id);
  const bIds = roomsB.map(r => r.id);
  assert.equal(aIds.filter(id => bIds.includes(id)).length, 0);
});

test('hotel A cannot access hotel B reservations', () => {
  const roomsB = listRooms(hotelB);
  createReservation(hotelB, {
    customerId: null,
    checkIn: '2026-10-01',
    checkOut: '2026-10-02',
    guests: 1,
    roomIds: roomsB.map(r => r.id),
    totalAmount: 50000,
  });
  const resA = listReservations(hotelA, 'all');
  const resB = listReservations(hotelB, 'all');
  assert.equal(resA.length, 0);
  assert.equal(resB.length, 1);
});
