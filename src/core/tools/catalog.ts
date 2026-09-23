import type { ToolDef, ToolContext } from './registry.ts';
import { errResult, okResult } from './registry.ts';
import type { ToolResult } from '../../types.ts';
import {
  computeTotal,
  findAvailableRooms,
  getHotelById,
  getReservation,
  createReservation,
  updateReservationStatus,
  findCustomerByPhone,
  findCustomerByEmail,
  getCustomer,
  upsertCustomerByPhone,
  createLead,
  createFollowup,
  createFeedback,
  createEscalation,
  updateConversationStatus,
  reservationRoomIds,
  getRoom,
  nightsBetween,
  searchKnowledge,
  listRooms,
} from '../../db/repositories.ts';
import { formatMoney, normalizePhone } from '../format.ts';
import { addDays, todayIso } from '../time.ts';

/**
 * Controlled tools — deterministic, governed, audited. The LLM (guest-facing
 * reply composer) never calls these directly: specialist agents call them with
 * fixed capability sets, and results are the ONLY business facts the AI may
 * repeat.
 */

const no = (v: unknown, def: string): string => (typeof v === 'string' && v.trim() ? v.trim() : def);

export const tools: ToolDef[] = [];

function define(tool: ToolDef): void {
  tools.push(tool);
}

// ---------------------------------------------------------------------------
// read: knowledge search
// ---------------------------------------------------------------------------

define({
  name: 'knowledge.search',
  summary: 'Search the hotel knowledge base (FAQ, policies, amenities, directions).',
  permission: 'read',
  run(ctx, args): ToolResult {
    const query = no(args.query, '');
    if (!query) return errResult('knowledge.search', 'query is required');
    const matches = searchKnowledge(ctx.hotel.id, query);
    if (matches.length === 0) {
      return okResult('knowledge.search', [], ['Aucune entrée de la base de connaissances ne correspond à cette question.']);
    }
    const facts = matches.slice(0, 3).map((k) => `KB[${k.category}]: ${k.answer}`);
    return okResult('knowledge.search', matches.slice(0, 3), facts);
  },
});

// ---------------------------------------------------------------------------
// read: hotel info / policies
// ---------------------------------------------------------------------------

define({
  name: 'hotel.info',
  summary: 'Return deterministic hotel facts (name, address, contact, check-in/out, tax).',
  permission: 'read',
  run(ctx): ToolResult {
    const h = ctx.hotel;
    const facts = [
      h.name,
      `Address: ${h.address}, ${h.city}`,
      `Phone/WhatsApp: ${h.whatsapp_phone || h.phone}`,
      `Check-in from ${h.check_in_time} · Check-out until ${h.check_out_time}`,
      `Tax/VAT: ${h.tax_rate}%`,
      `Currency: ${h.currency}`,
    ];
    return okResult('hotel.info', h, facts);
  },
});

// ---------------------------------------------------------------------------
// read: availability. NEVER fabricates — pure DB query over rooms + reservations.
// ---------------------------------------------------------------------------

define({
  name: 'availability.check',
  summary: 'Deterministic room availability + prices for a date range.',
  permission: 'read',
  run(ctx, args): ToolResult {
    const checkIn = no(args.checkIn, '');
    const checkOut = no(args.checkOut, '');
    const guests = Number(args.guests ?? 1);
    const roomType = typeof args.roomType === 'string' && args.roomType ? args.roomType : undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
      return errResult('availability.check', 'valid checkIn/checkOut ISO dates are required');
    }
    if (checkOut <= checkIn) return errResult('availability.check', 'checkOut must be after checkIn');

    const rooms = findAvailableRooms(ctx.hotel.id, checkIn, checkOut, Math.floor(guests) || 1);
    const filtered = roomType ? rooms.filter((r) => r.room_type.toLowerCase() === roomType.toLowerCase()) : rooms;
    const nights = nightsBetween(checkIn, checkOut);

    if (filtered.length === 0) {
      const typeNote = roomType ? ` of type "${roomType}"` : '';
      const anyRooms = rooms.length > 0;
      const facts: string[] = [
        anyRooms
          ? `No ${roomType ?? ''} rooms available ${checkIn}→${checkOut}, but ${rooms.length} other room(s) are.`
          : `No rooms available from ${checkIn.split('-').reverse().join('/')} to ${checkOut.split('-').reverse().join('/')}.`,
      ];
      return okResult('availability.check', { rooms: filtered, nights, availableAny: anyRooms, totalCount: rooms.length }, facts);
    }

    const facts = filtered.slice(0, 4).map((r) =>
      `${r.name} (${r.room_type}) — ${formatMoney(r.base_price)}/nuit, ${r.capacity} pers.`,
    );
    facts.push(`Séjour de ${nights} nuit(s) du ${checkIn.split('-').reverse().join('/')} au ${checkOut.split('-').reverse().join('/')}.`);
    return okResult('availability.check', { rooms: filtered, nights, availableAny: true, totalCount: filtered.length }, facts);
  },
});

// ---------------------------------------------------------------------------
// read: price for a room type (read-only)
// ---------------------------------------------------------------------------

define({
  name: 'price.check',
  summary: 'Deterministic room-type price per night (from DB).',
  permission: 'read',
  run(ctx, args): ToolResult {
    const roomType = no(args.roomType, '');
    const rooms = listRooms(ctx.hotel.id).filter((r) => r.active === 1 && r.maintenance === 0);
    const matches = roomType ? rooms.filter((r) => r.room_type.toLowerCase() === roomType.toLowerCase()) : rooms;
    if (matches.length === 0) {
      const types = [...new Set(rooms.map((r) => r.room_type))];
      return okResult(
        'price.check',
        types,
        [`We don't have "${roomType}". Our rates: ${types.map((t) => t).join(', ') || 'n/a'} (from DB).`],
      );
    }
    const cheapest = [...matches].sort((a, b) => a.base_price - b.base_price)[0]!;
    const pricesPerNite = [...new Set(matches.map((r) => r.base_price))].sort((a, b) => a - b);
    const facts = [
      `Rate for ${roomType}: from ${formatMoney(cheapest.base_price)}/night (${matches.length} room(s) of this type).`,
      `Other nightly rates: ${pricesPerNite.map((p) => formatMoney(p)).join(', ')}.`,
    ];
    return okResult('price.check', matches.slice(0, 10), facts);
  },
});

// ---------------------------------------------------------------------------
// read/write: customer lookup & upsert (always tenant scoped)
// ---------------------------------------------------------------------------

define({
  name: 'customer.lookup',
  summary: 'Find an existing customer by phone/email/name (tenant-scoped).',
  permission: 'read',
  run(ctx, args): ToolResult {
    const phone = no(args.phone, '');
    const email = no(args.email, '');
    let customer = phone ? findCustomerByPhone(ctx.hotel.id, normalizePhone(phone)) : undefined;
    if (!customer && email) customer = findCustomerByEmail(ctx.hotel.id, email);
    if (!customer) {
      return okResult('customer.lookup', null, ['No existing customer found in this hotel.']);
    }
    return okResult('customer.lookup', customer, [`Existing customer found: ${customer.name || customer.phone}.`]);
  },
});

define({
  name: 'customer.upsert',
  summary: 'Create or update a customer profile (validated, tenant-scoped).',
  permission: 'write',
  run(ctx, args): ToolResult {
    const phone = typeof args.phone === 'string' ? normalizePhone(args.phone) : '';
    const email = typeof args.email === 'string' ? args.email.trim() : '';
    const name = typeof args.name === 'string' ? args.name.trim() : '';
    if (!phone && !email) return errResult('customer.upsert', 'phone or email required');
    const customer = upsertCustomerByPhone(ctx.hotel.id, { phone, email, name, source: 'ai' });
    return okResult('customer.upsert', customer, [`Customer profile ${customer.name || customer.phone} ready.`], customer.id);
  },
});

// ---------------------------------------------------------------------------
// write: leads
// ---------------------------------------------------------------------------

define({
  name: 'lead.create',
  summary: 'Capture a sales lead (quote/group/corporate requests).',
  permission: 'write',
  run(ctx, args): ToolResult {
    const phone = typeof args.phone === 'string' ? normalizePhone(args.phone) : '';
    const email = typeof args.email === 'string' ? args.email.trim() : '';
    const name = no(args.name, '');
    const intent = no(args.intent, 'lead');
    if (!phone && !email && !name) return errResult('lead.create', 'need at least a name, phone or email');
    const customerId = ctx.customer?.id ?? null;
    const leadId = createLead(ctx.hotel.id, { name, phone, email, customerId, intent });
    return okResult('lead.create', { leadId }, [`Lead #${leadId} captured (${name || phone || email}).`], leadId);
  },
});

// ---------------------------------------------------------------------------
// write: booking request → confirm → cancel (all deterministic pricing)
// ---------------------------------------------------------------------------

define({
  name: 'reservation.request',
  summary: 'Register a booking REQUEST with deterministic pricing (requires explicit confirmation).',
  permission: 'write',
  run(ctx, args): ToolResult {
    const checkIn = no(args.checkIn, '');
    const checkOut = no(args.checkOut, '');
    const guests = Number(args.guests ?? 1);
    const roomIdsRaw = args.roomIds;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
      return errResult('reservation.request', 'valid checkIn/checkOut required');
    }
    if (!Array.isArray(roomIdsRaw) || roomIdsRaw.length === 0) {
      return errResult('reservation.request', 'roomIds array required');
    }
    const roomIds = roomIdsRaw.filter((x): x is number => typeof x === 'number' && Number.isInteger(x));
    // Re-verify availability deterministically (rooms must still be free).
    const stillAvailable = findAvailableRooms(ctx.hotel.id, checkIn, checkOut, Math.floor(guests) || 1);
    const stillFree = new Set(stillAvailable.map((r) => r.id));
    const okRooms = roomIds.filter((id) => stillFree.has(id));
    if (okRooms.length === 0) {
      return errResult('reservation.request', 'rooms no longer available for those dates');
    }
    const rooms = okRooms.map((id) => getRoom(ctx.hotel.id, id)).filter((r): r is NonNullable<typeof r> => !!r);
    const nights = nightsBetween(checkIn, checkOut);
    const total = computeTotal(rooms, nights);

    const reservationId = createReservation(ctx.hotel.id, {
      customerId: ctx.customer?.id ?? null,
      checkIn,
      checkOut,
      guests: Math.floor(guests) || 1,
      roomIds: okRooms,
      totalAmount: total,
      source: 'ai',
      notes: `conv=${ctx.conversationId}`,
    });

    const facts = [
      `Booking request #${reservationId} (REQUESTED, awaiting guest confirmation).`,
      `Rooms: ${rooms.map((r) => r.name).join(', ')}.`,
      `Dates: ${checkIn.split('-').reverse().join('/')} → ${checkOut.split('-').reverse().join('/')} (${nights} night(s)).`,
      `Total: ${formatMoney(total)} (${nights} × ${rooms.map((r) => formatMoney(r.base_price)).join(' + ')}), VAT ${ctx.hotel.tax_rate}% included.`,
    ];
    return okResult('reservation.request', { reservationId, rooms: okRooms, totalAmount: total }, facts, reservationId);
  },
});

define({
  name: 'reservation.confirm',
  summary: 'Confirm a requested reservation (status requested → confirmed).',
  permission: 'write',
  run(ctx, args): ToolResult {
    const reservationId = Number(args.reservationId);
    if (!Number.isInteger(reservationId)) return errResult('reservation.confirm', 'reservationId required');
    const res = getReservation(ctx.hotel.id, reservationId);
    if (!res) return errResult('reservation.confirm', 'reservation not found in this hotel');
    if (res.status !== 'requested') {
      return errResult('reservation.confirm', `reservation is already '${res.status}'`);
    }
    updateReservationStatus(ctx.hotel.id, reservationId, 'confirmed');
    const rooms = reservationRoomIds(res).map((id) => getRoom(ctx.hotel.id, id)).filter((r): r is NonNullable<typeof r> => !!r);
    return okResult('reservation.confirm', res, [
      `Reservation #${reservationId} CONFIRMED.`,
      `Dates ${res.check_in.split('-').reverse().join('/')} → ${res.check_out.split('-').reverse().join('/')} for ${rooms.map((r) => r.name).join(', ')}.`,
      `Total ${formatMoney(res.total_amount)}. Reference: ${ctx.hotel.slug.toUpperCase()}-${String(reservationId).padStart(4, '0')}.`,
    ]);
  },
});

define({
  name: 'reservation.cancel',
  summary: 'Cancel a reservation (requested/confirmed → cancelled).',
  permission: 'write',
  run(ctx, args): ToolResult {
    const reservationId = Number(args.reservationId);
    if (!Number.isInteger(reservationId)) return errResult('reservation.cancel', 'reservationId required');
    const res = getReservation(ctx.hotel.id, reservationId);
    if (!res) return errResult('reservation.cancel', 'reservation not found in this hotel');
    if (res.status === 'cancelled' || res.status === 'declined' || res.status === 'checked_out') {
      return errResult('reservation.cancel', `reservation is already '${res.status}'`);
    }
    updateReservationStatus(ctx.hotel.id, reservationId, 'cancelled');
    return okResult('reservation.cancel', res, [`Reservation #${reservationId} cancelled; no charge.`]);
  },
});

// ---------------------------------------------------------------------------
// write: feedback, follow-ups, escalations
// ---------------------------------------------------------------------------

define({
  name: 'feedback.log',
  summary: 'Log guest feedback/review (rating 1-10, comment).',
  permission: 'write',
  run(ctx, args): ToolResult {
    const rating = args.rating === null || args.rating === undefined ? null : Number(args.rating);
    const comment = no(args.comment, '');
    if (rating === null && !comment) return errResult('feedback.log', 'rating or comment required');
    if (rating !== null && (Number.isNaN(rating) || rating < 1 || rating > 10)) {
      return errResult('feedback.log', 'rating must be 1..10');
    }
    const fbId = createFeedback(ctx.hotel.id, {
      customerId: ctx.customer?.id ?? null,
      rating,
      comment,
    });
    return okResult('feedback.log', { fbId }, [`Feedback logged (rating ${rating ?? 'n/a'}).`], fbId);
  },
});

define({
  name: 'followup.create',
  summary: 'Schedule a follow-up task (e.g., remind, call back, handle feedback).',
  permission: 'write',
  run(ctx, args): ToolResult {
    const task = no(args.task, '');
    const dueAt = no(args.dueAt, addDays(todayIso(), 1));
    if (!task) return errResult('followup.create', 'task required');
    const id = createFollowup(ctx.hotel.id, { customerId: ctx.customer?.id ?? null, conversationId: ctx.conversationId, dueAt, task });
    return okResult('followup.create', { id }, [`Follow-up scheduled: ${task} (${dueAt}).`], id);
  },
});

define({
  name: 'escalation.create',
  summary: 'Escalate the conversation to a human (marks conversation escalated).',
  permission: 'write',
  run(ctx, args): ToolResult {
    const reason = no(args.reason, 'guest requested human assistance');
    const escalationId = createEscalation(ctx.hotel.id, {
      conversationId: ctx.conversationId,
      customerId: ctx.customer?.id ?? null,
      reason,
      requestedByGuest: 1,
    });
    updateConversationStatus(ctx.hotel.id, ctx.conversationId, 'escalated');
    return okResult('escalation.create', { escalationId }, [`Escalation #${escalationId} → human team notified.`], escalationId);
  },
});

// ---------------------------------------------------------------------------
// timeout-based free room detection for reporting (read)
// ---------------------------------------------------------------------------

export function registerAll(registry: { register(t: ToolDef): void }): void {
  for (const t of tools) registry.register(t);
}