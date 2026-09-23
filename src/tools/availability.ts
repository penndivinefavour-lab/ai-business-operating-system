// src/tools/availability.ts

import type { DatabaseClient } from '../adapters/database/index.js';
import type { ToolResult } from '../types/index.js';
import { z } from 'zod';

const CheckAvailabilityInput = z.object({
  tenant_id: z.string(),
  date: z.string(), // YYYY-MM-DD
  room_type: z.string().optional(),
});

export async function checkAvailability(
  db: DatabaseClient,
  input: z.infer<typeof CheckAvailabilityInput>
): Promise<ToolResult> {
  const parsed = CheckAvailabilityInput.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message, message: 'Invalid input' };
  }

  const { tenant_id, date, room_type } = parsed.data;

  try {
    // Get all rooms for tenant
    const rooms = await db.getRooms(tenant_id);
    const filteredRooms = room_type 
      ? rooms.filter(r => r.type.toLowerCase().includes(room_type.toLowerCase()))
      : rooms;

    const availableRooms = [];
    for (const room of filteredRooms) {
      // Check for overlapping bookings
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      
      const overlapping = await db.getOverlappingBookings(tenant_id, room.id, date, nextDayStr);
      const availableCount = room.total_count - overlapping.length;
      
      if (availableCount > 0) {
        availableRooms.push({
          room_id: room.id,
          type: room.type,
          name: room.name,
          description: room.description,
          price_cents: room.price_cents,
          available_count: availableCount,
          amenities: room.amenities,
        });
      }
    }

    if (availableRooms.length === 0) {
      return {
        success: true,
        data: { available: false, rooms: [] },
        message: `Sorry, we don't have any ${room_type || ''} rooms available for ${date}.`,
      };
    }

    const roomList = availableRooms
      .map(r => `• ${r.name} - ${r.price_cents / 100} FCFA/night (${r.available_count} available)`)
      .join('\n');

    return {
      success: true,
      data: { available: true, rooms: availableRooms },
      message: `Yes! We have the following rooms available for ${date}:\n${roomList}\n\nWould you like to book one of these?`,
    };
  } catch (error: any) {
    return { success: false, error: error.message, message: 'Error checking availability' };
  }
}

const GetRoomPriceInput = z.object({
  tenant_id: z.string(),
  room_type: z.string(),
});

export async function getRoomPrice(
  db: DatabaseClient,
  input: z.infer<typeof GetRoomPriceInput>
): Promise<ToolResult> {
  const parsed = GetRoomPriceInput.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message, message: 'Invalid input' };
  }

  const { tenant_id, room_type } = parsed.data;

  try {
    const rooms = await db.getRooms(tenant_id);
    const matchingRooms = rooms.filter(r => 
      r.type.toLowerCase().includes(room_type.toLowerCase()) ||
      r.name.toLowerCase().includes(room_type.toLowerCase())
    );

    if (matchingRooms.length === 0) {
      return {
        success: true,
        data: { found: false },
        message: `I couldn't find a room matching "${room_type}". Our room types are: ${[...new Set(rooms.map(r => r.type))].join(', ')}.`,
      };
    }

    const priceList = matchingRooms
      .map(r => `• ${r.name}: ${r.price_cents / 100} FCFA/night — ${r.description}`)
      .join('\n');

    return {
      success: true,
      data: { found: true, rooms: matchingRooms },
      message: `Here are our ${room_type} room prices:\n${priceList}`,
    };
  } catch (error: any) {
    return { success: false, error: error.message, message: 'Error getting room price' };
  }
}
