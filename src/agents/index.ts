import type {
  AgentContext,
  Intent,
  Room,
  ToolResult,
} from '../types.ts';
import type { ToolSandbox } from '../core/tools/registry.ts';
import {
  findPendingReservation,
  findUpcomingReservation,
  findAvailableRooms,
  listRooms,
  nightsBetween,
} from '../db/repositories.ts';
import { defaultCheckIn, parseCheckIn } from '../core/dateparse.ts';
import { formatDateNice, formatDateShort, formatMoney } from '../core/format.ts';
import { addDays, todayIso } from '../core/time.ts';

/**
 * Specialist agents. Each returns a composed proposal reply plus the business
 * facts it obtained. Everything a reply may state comes from tool results (the
 * `facts` below) — never from the model's imagination.
 */

export interface AgentOutput {
  reply: string;
  facts: string[];
  changed: boolean;
  pendingConfirmationId?: number;
}

export interface AgentInput {
  ctx: AgentContext;
  sandbox: ToolSandbox;
}

const EN = (fr: string, en: string, lang?: 'fr' | 'en'): string => (lang === 'en' ? en : fr);

/** Deterministic helper: find the next date in the next 21 days with rooms. */
function findNextFreeDate(hotelId: number, startIso: string, nights: number, guests: number): { date: string; rooms: Room[] } | null {
  for (let i = 0; i < 21; i += 1) {
    const day = addDays(startIso, i);
    const rooms = findAvailableRooms(hotelId, day, addDays(day, nights), guests);
    if (rooms.length > 0) return { date: day, rooms };
  }
  return null;
}

function toolFacts(actions: ToolResult[]): string[] {
  return actions.flatMap((a) => (a.ok ? a.facts : []));
}

// ---------------------------------------------------------------------------
export async function handleGreeting(input: AgentInput): Promise<AgentOutput> {
  const { customer, hotel, classification } = input.ctx;
  const lang = classification.entities.dateRef ? (customer?.language === 'en' ? 'en' : 'fr') : (customer?.language === 'en' ? 'en' : 'fr');
  if (customer && customer.name) {
    return {
      reply: EN(
        `Bonjour ${customer.name} 👋 Bienvenue au ${hotel.name}. Je suis votre réceptionniste virtuelle. Je peux vérifier la disponibilité, les tarifs, vous aider à réserver, ou répondre à vos questions. Que puis-je faire pour vous ?`,
        `Hello ${customer.name} 👋 Welcome to ${hotel.name}. I'm your virtual front desk assistant. I can check availability, rates, help you book, or answer questions. How can I help?`,
        lang,
      ),
      facts: [],
      changed: false,
    };
  }
  return {
    reply: EN(
      `Bonjour 👋 Bienvenue au ${hotel.name}. Je suis votre réceptionniste virtuelle. Je peux vérifier la disponibilité, les tarifs, vous aider à réserver, ou répondre à vos questions. Que puis-je faire pour vous ?`,
      `Hello 👋 Welcome to ${hotel.name}. I'm your virtual front desk assistant. I can check availability, rates, help you book, or answer questions. How can I help?`,
      lang,
    ),
    facts: [],
    changed: false,
  };
}

export async function handleAvailability(input: AgentInput): Promise<AgentOutput> {
  const { ctx, sandbox } = input;
  const lang = ctx.customer?.language === 'en' ? 'en' : 'fr';
  const e = ctx.classification.entities;
  const checkIn = e.checkIn ?? defaultCheckIn();
  const nights = e.nights ?? 1;
  const checkOut = addDays(checkIn, nights);
  const guests = e.guests ?? 1;
  const roomType = e.roomType;

  const res = await sandbox.execute(ctx, 'availability.check', { checkIn, checkOut, guests, roomType });
  const facts = toolFacts([res]);
  if (!res.ok) {
    return { reply: EN('Je ne peux pas vérifier la disponibilité pour le moment.', 'I can\'t check availability right now.'), facts, changed: false };
  }

  const data = res.data as { rooms: Room[]; nights: number; availableAny: boolean };
  if (data.rooms.length === 0) {
    const next = findNextFreeDate(ctx.hotel.id, checkIn, nights, guests);
    let suggestion = '';
    if (next) {
      suggestion = EN(
        ` Nous avons des chambres libres à partir du ${formatDateNice(next.date, lang)} si cela vous convient.`,
        ` We have rooms free from ${formatDateNice(next.date, lang)} if that works for you.`,
        lang,
      );
    }
    return {
      reply: EN(
        `Désolé, aucune chambre n'est disponible pour ${formatDateNice(checkIn, lang)} → ${formatDateNice(checkOut, lang)}.${suggestion} Souhaitez-vous que je vous mette en contact avec un membre de l'équipe ?`,
        `Sorry, no room is available for ${formatDateNice(checkIn, lang)} → ${formatDateNice(checkOut, lang)}.${suggestion} Would you like me to connect you with a team member?`,
        lang,
      ),
      facts: [...facts, ...(suggestion ? [`Next free date: ${next!.date}`] : [])],
      changed: false,
    };
  }

  const lines = data.rooms.slice(0, 4).map((r) => {
    const total = r.base_price * data.nights;
    return EN(
      `🏨 ${r.name} (${r.room_type}) — ${formatMoney(r.base_price)}/nuit · ${r.capacity} pers. · Total ${data.nights} nuit(s) : ${formatMoney(total)}`,
      `🏨 ${r.name} (${r.room_type}) — ${formatMoney(r.base_price)}/night · ${r.capacity} guests · ${data.nights} night(s): ${formatMoney(total)}`,
      lang,
    );
  });
  return {
    reply: EN(
      `Oui, nous avons des chambres disponibles pour ${formatDateNice(checkIn, lang)}, ${data.nights} nuit(s) :\n${lines.join('\n')}\n\nSouhaitez-vous réserver l'une d'elles ?`,
      `Yes, we have rooms available for ${formatDateNice(checkIn, lang)}, ${data.nights} night(s):\n${lines.join('\n')}\n\nWould you like to book one?`,
      lang,
    ),
    facts,
    changed: false,
  };
}

export async function handlePrice(input: AgentInput): Promise<AgentOutput> {
  const { ctx, sandbox } = input;
  const lang = ctx.customer?.language === 'en' ? 'en' : 'fr';
  const roomType = ctx.classification.entities.roomType;
  const res = await sandbox.execute(ctx, 'price.check', { roomType });
  const facts = toolFacts([res]);
  if (!res.ok) return { reply: EN('Je ne peux pas afficher les tarifs pour le moment.', 'I can\'t show rates right now.'), facts, changed: false };
  const data = res.data as Room[] | string[];
  if (roomType && Array.isArray(data) && data.length === 0) {
    const types = await sandbox.execute(ctx, 'price.check', {});
    return {
      reply: EN(
        `Nous n'avons pas de chambre "${roomType}". Nos types de chambres : ${types.ok ? (types.data as string[]).join(', ') : ''}. Je peux vérifier la disponibilité si vous le souhaitez.`,
        `We don't have a "${roomType}" room. Our room types: ${types.ok ? (types.data as string[]).join(', ') : ''}. I can check availability if you'd like.`,
        lang,
      ),
      facts: [...facts, ...toolFacts([types])],
      changed: false,
    };
  }
  return {
    reply: EN(
      `Voici nos tarifs par nuit (taxes incluses) :\n${facts.join('\n')}\n\nJe peux vérifier la disponibilité pour une date précise si vous le souhaitez.`,
      `Here are our nightly rates (incl. tax):\n${facts.join('\n')}\n\nI can check availability for a specific date if you'd like.`,
      lang,
    ),
    facts,
    changed: false,
  };
}

export async function handleBooking(input: AgentInput): Promise<AgentOutput> {
  const { ctx, sandbox } = input;
  const lang = ctx.customer?.language === 'en' ? 'en' : 'fr';
  const e = ctx.classification.entities;

  let checkIn = e.checkIn;
  if (!checkIn) {
    const parsed = parseCheckIn(ctx.history.map((m) => m.body).join(' '));
    checkIn = parsed?.checkIn;
  }
  if (!checkIn) {
    return {
      reply: EN(
        `Avec plaisir ! Pour quelle date souhaitez-vous arriver ? (ex: "vendredi", "demain", "le 25 février")`,
        `With pleasure! For which date would you like to arrive? (e.g., "Friday", "tomorrow", "February 25")`,
        lang,
      ),
      facts: [],
      changed: false,
    };
  }
  const nights = e.nights ?? 1;
  const checkOut = addDays(checkIn, nights);
  const guests = e.guests ?? 1;
  const roomType = e.roomType;

  const avail = await sandbox.execute(ctx, 'availability.check', { checkIn, checkOut, guests, roomType });
  const facts = toolFacts([avail]);
  const data = avail.data as { rooms: Room[]; nights: number };
  if (!avail.ok || data.rooms.length === 0) {
    const next = findNextFreeDate(ctx.hotel.id, checkIn, nights, guests);
    if (next) {
      const typeNote = roomType ? ` "${roomType}"` : '';
      return {
        reply: EN(
          `Désolé, aucun${typeNote} chambre n'est libre pour ${formatDateNice(checkIn, lang)}. Par contre, nous sommes libres à partir du ${formatDateNice(next.date, lang)}. Voulez-vous réserver à cette date ?`,
          `Sorry, no${typeNote} room is free on ${formatDateNice(checkIn, lang)}. However we are free from ${formatDateNice(next.date, lang)}. Would you like to book that date?`,
          lang,
        ),
        facts: [...facts, `Next free: ${next.date}`],
        changed: false,
      };
    }
    return {
      reply: EN(
        `Je suis désolé, ${roomType ? `le type "${roomType}"` : 'aucune chambre'} n'est disponible ${formatDateNice(checkIn, lang)} → ${formatDateNice(checkOut, lang)}. Voulez-vous parler à quelqu'un pour d'autres options ?`,
        `I'm sorry, ${roomType ? `"${roomType}"` : 'no room'} is available ${formatDateNice(checkIn, lang)} → ${formatDateNice(checkOut, lang)}. Would you like to speak to someone for other options?`,
        lang,
      ),
      facts,
      changed: false,
    };
  }

  const chosen = data.rooms.slice(0, 2);
  const reqRes = await sandbox.execute(ctx, 'reservation.request', {
    checkIn,
    checkOut,
    guests,
    roomIds: chosen.map((r) => r.id),
    roomType,
  });
  const reqFacts = toolFacts([reqRes]);
  if (!reqRes.ok) {
    return { reply: EN('Je ne peux pas créer la demande de réservation. Contactez la réception s\'il vous plaît.', 'I couldn\'t create the booking request. Please contact the front desk.'), facts: [...facts, ...reqFacts], changed: false };
  }
  const resId = reqRes.createdId;
  return {
    reply: EN(
      `Parfait ! Voici le récapitulatif de votre demande de réservation :\n${reqFacts.join('\n')}\n\n📌 Confirmez-vous cette réservation ? (répondez "oui")`,
      `Perfect! Here is your booking request summary:\n${reqFacts.join('\n')}\n\n📌 Do you confirm this reservation? (reply "yes")`,
      lang,
    ),
    facts: [...facts, ...reqFacts],
    changed: true,
    pendingConfirmationId: resId,
  };
}

export async function handleBookingConfirm(input: AgentInput): Promise<AgentOutput> {
  const { ctx, sandbox } = input;
  const lang = ctx.customer?.language === 'en' ? 'en' : 'fr';
  const pending = findPendingReservation(ctx.hotel.id, ctx.conversationId);
  if (!pending) {
    return {
      reply: EN('Je ne vois pas de réservation en attente. Voulez-vous vérifier la disponibilité ou en créer une nouvelle ?', `I don't see a pending booking. Would you like to check availability or create a new one?`, lang),
      facts: [],
      changed: false,
    };
  }
  const res = await sandbox.execute(ctx, 'reservation.confirm', { reservationId: pending.id });
  const facts = toolFacts([res]);
  if (!res.ok) {
    return { reply: EN('Je n\'ai pas pu confirmer la réservation. Un membre de l\'équipe va vous contacter.', `I couldn't confirm the reservation. A team member will contact you.`), facts, changed: false };
  }
  const reminderDay = addDays(pending.check_in, -1);
  const reminder = await sandbox.execute(ctx, 'followup.create', {
    task: `Send check-in reminder to ${ctx.customer?.name ?? 'guest'} for reservation #${pending.id} (arriving ${formatDateShort(pending.check_in)}).`,
    dueAt: reminderDay,
  });
  const reminderNote = reminder.ok ? '\n\n⏰ Je vous rappellerai la veille de votre arrivée.' : '';
  return {
    reply: EN(
      `✅ Réservation confirmée !\n\n${facts.join('\n')}${reminderNote}\n\nÀ bientôt ! 🏨`,
      `✅ Reservation confirmed!\n\n${facts.join('\n')}${reminderNote}\n\nSee you soon! 🏨`,
      lang,
    ),
    facts: [...facts, ...toolFacts([reminder])],
    changed: true,
  };
}

export async function handleBookingCancel(input: AgentInput): Promise<AgentOutput> {
  const { ctx, sandbox } = input;
  const lang = ctx.customer?.language === 'en' ? 'en' : 'fr';
  if (!ctx.customer?.id) {
    return { reply: EN('Je dois vous identifier pour annuler une réservation. Avez-vous un téléphone ou un email associé ?', `I need to identify you to cancel a booking. Do you have a phone or email on file?`), facts: [], changed: false };
  }
  const upcoming = findUpcomingReservation(ctx.hotel.id, ctx.customer.id);
  if (!upcoming) {
    return { reply: EN('Je ne trouve aucune réservation à venir pour vous annuler.', `I couldn't find any upcoming reservation of yours to cancel.`), facts: [], changed: false };
  }
  const res = await sandbox.execute(ctx, 'reservation.cancel', { reservationId: upcoming.id });
  const facts = toolFacts([res]);
  if (!res.ok) return { reply: EN('Je ne peux pas annuler cette réservation pour le moment.', `I can't cancel that reservation right now.`), facts, changed: false };
  return { reply: EN(`C'est fait. ${facts.join('\n')}`, `Done. ${facts.join('\n')}`), facts, changed: true };
}

export async function handleLocation(input: AgentInput): Promise<AgentOutput> {
  const { ctx, sandbox } = input;
  const lang = ctx.customer?.language === 'en' ? 'en' : 'fr';
  const info = await sandbox.execute(ctx, 'hotel.info', {});
  const kb = await sandbox.execute(ctx, 'knowledge.search', { query: 'location directions address' });
  const facts = [...toolFacts([info]), ...toolFacts([kb])];
  const kbAnswer = facts.find((f) => f.startsWith('KB'));
  return {
    reply: EN(
      `📍 ${ctx.hotel.name}\n${ctx.hotel.address}, ${ctx.hotel.city}\n\n${kbAnswer ? kbAnswer.replace(/^KB\[[^\]]+\]:\s*/, '') : 'Nous pouvons vous donner l\'itinéraire à la réception.'}\n\n📞 ${ctx.hotel.whatsapp_phone || ctx.hotel.phone}`,
      `📍 ${ctx.hotel.name}\n${ctx.hotel.address}, ${ctx.hotel.city}\n\n${kbAnswer ? kbAnswer.replace(/^KB\[[^\]]+\]:\s*/, '') : 'We can help with directions at the front desk.'}\n\n📞 ${ctx.hotel.whatsapp_phone || ctx.hotel.phone}`,
      lang,
    ),
    facts,
    changed: false,
  };
}

export async function handleCheckinPolicy(input: AgentInput): Promise<AgentOutput> {
  const { ctx, sandbox } = input;
  const lang = ctx.customer?.language === 'en' ? 'en' : 'fr';
  const kb = await sandbox.execute(ctx, 'knowledge.search', { query: 'early check-in check-in time arrival' });
  const facts = toolFacts([kb]);
  const answer = facts.find((f) => f.startsWith('KB'));
  if (answer) return { reply: answer.replace(/^KB\[[^\]]+\]:\s*/, ''), facts, changed: false };
  return {
    reply: EN(
      `Check-in à partir de ${ctx.hotel.check_in_time}. Un early check-in est possible selon disponibilité — je peux le demander à l'équipe.`,
      `Check-in from ${ctx.hotel.check_in_time}. Early check-in is possible subject to availability — I can request it.`,
      lang,
    ),
    facts: [...facts, `Check-in ${ctx.hotel.check_in_time}.`],
    changed: false,
  };
}

export async function handleCheckoutPolicy(input: AgentInput): Promise<AgentOutput> {
  const { ctx, sandbox } = input;
  const lang = ctx.customer?.language === 'en' ? 'en' : 'fr';
  const kb = await sandbox.execute(ctx, 'knowledge.search', { query: 'check-out late check-out departure time' });
  const facts = toolFacts([kb]);
  const answer = facts.find((f) => f.startsWith('KB'));
  if (answer) return { reply: answer.replace(/^KB\[[^\]]+\]:\s*/, ''), facts, changed: false };
  return {
    reply: EN(
      `Check-out jusqu'à ${ctx.hotel.check_out_time}. Un late check-out peut être demandé selon disponibilité.`,
      `Check-out until ${ctx.hotel.check_out_time}. Late check-out can be requested subject to availability.`,
      lang,
    ),
    facts: [...facts, `Check-out ${ctx.hotel.check_out_time}.`],
    changed: false,
  };
}

export async function handleAmenities(input: AgentInput): Promise<AgentOutput> {
  const { ctx, sandbox } = input;
  const lang = ctx.customer?.language === 'en' ? 'en' : 'fr';
  const text = ctx.history[ctx.history.length - 1]?.body ?? '';
  const kb = await sandbox.execute(ctx, 'knowledge.search', { query: `${text} amenity` });
  const facts = toolFacts([kb]);
  const answer = facts.find((f) => f.startsWith('KB'));
  if (answer) return { reply: answer.replace(/^KB\[[^\]]+\]:\s*/, ''), facts, changed: false };
  return { reply: EN('Je n\'ai pas cette information. Un membre de l\'équipe peut vous aider.', `I don't have that information handy — a team member can help.`), facts, changed: false };
}

export async function handleFeedback(input: AgentInput): Promise<AgentOutput> {
  const { ctx, sandbox } = input;
  const lang = ctx.customer?.language === 'en' ? 'en' : 'fr';
  const e = ctx.classification.entities;
  const text = ctx.history[ctx.history.length - 1]?.body ?? '';
  const isComplaint = /\b(complaint|problem|issue|probl|mauvais|terrible|not happy|insatisfait|bruit|dirty|sale|broken|ne marche)\b/i.test(text);

  if (e.rating === undefined && !isComplaint) {
    return {
      reply: EN(`Merci de vouloir partager votre avis ! Sur une échelle de 1 à 10, comment évalueriez-vous votre expérience ?`, `Thanks for offering feedback! On a scale of 1-10, how would you rate your experience?`, lang),
      facts: [],
      changed: false,
    };
  }

  const fb = await sandbox.execute(ctx, 'feedback.log', { rating: e.rating ?? null, comment: text });
  const facts = toolFacts([fb]);

  if (isComplaint || (e.rating !== undefined && e.rating <= 3)) {
    const follow = await sandbox.execute(ctx, 'followup.create', {
      task: `Handle guest complaint/feedback (${e.rating ?? 'no rating'}) within 12h. Guest: ${ctx.customer?.name ?? ctx.customer?.phone ?? 'unknown'}. Detail: ${text.slice(0, 300)}.`,
      dueAt: todayIso(),
    });
    return {
      reply: EN(
        `Nous sommes sincèrement désolés 🙏. J'ai transmis votre retour (${e.rating ? e.rating + '/10' : 'signalé'}) à l'équipe, qui vous contactera sous 12 heures.`,
        `We're truly sorry 🙏. I've passed your feedback (${e.rating ? e.rating + '/10' : 'noted'}) to the team — they'll reach out within 12 hours.`,
        lang,
      ),
      facts: [...facts, ...toolFacts([follow])],
      changed: true,
    };
  }

  return {
    reply: EN(`Merci infiniment pour votre note ${e.rating ? e.rating + '/10' : ''} 🌟 Votre retour nous aide à nous améliorer !`, `Thank you so much for your ${e.rating ? e.rating + '/10' : ''} rating 🌟 Your feedback helps us improve!`, lang),
    facts,
    changed: true,
  };
}

export async function handleEscalation(input: AgentInput): Promise<AgentOutput> {
  const { ctx, sandbox } = input;
  const lang = ctx.customer?.language === 'en' ? 'en' : 'fr';
  const text = ctx.history[ctx.history.length - 1]?.body ?? '';
  const esc = await sandbox.execute(ctx, 'escalation.create', { reason: text.slice(0, 300) });
  const facts = toolFacts([esc]);
  return {
    reply: EN(
      `Je comprends. Je transmets immédiatement à un membre de notre équipe qui vous contactera très vite 📞. En attendant, puis-je faire autre chose pour vous ?`,
      `I understand. I'm connecting you with a member of our team who will contact you shortly 📞. Is there anything else I can do in the meantime?`,
      lang,
    ),
    facts,
    changed: true,
  };
}

export async function handleLeadCapture(input: AgentInput): Promise<AgentOutput> {
  const { ctx, sandbox } = input;
  const lang = ctx.customer?.language === 'en' ? 'en' : 'fr';
  const e = ctx.classification.entities;
  const lead = await sandbox.execute(ctx, 'lead.create', {
    name: e.name ?? ctx.customer?.name ?? '',
    phone: e.phone ?? ctx.customer?.phone ?? '',
    email: e.email ?? ctx.customer?.email ?? '',
    intent: 'sales',
  });
  if (!lead.ok) {
    return {
      reply: EN(
        `Bien sûr, je peux préparer un devis pour vous. Pouvez-vous me donner votre nom et un numéro de téléphone ou un email ?`,
        `Of course, I can prepare a quote for you. Could you share your name and a phone number or email?`,
        lang,
      ),
      facts: toolFacts([lead]),
      changed: false,
    };
  }
  const follow = await sandbox.execute(ctx, 'followup.create', {
    task: `Contact the lead by phone within 24h (${ctx.customer?.name ?? e.name ?? ''} ${ctx.customer?.phone ?? ''}).`,
    dueAt: todayIso(),
  });
  const facts = [...toolFacts([lead]), ...toolFacts([follow])];
  return {
    reply: EN(
      `Très bien, j'ai transmis votre demande à notre équipe commerciale qui vous contactera 👥. Avez-vous d'autres questions ?`,
      `Great — I've passed your request to our sales team who will reach out 👥. Any other questions?`,
      lang,
    ),
    facts,
    changed: true,
  };
}

export async function handleCustomerLookup(input: AgentInput): Promise<AgentOutput> {
  const { ctx, sandbox } = input;
  const lang = ctx.customer?.language === 'en' ? 'en' : 'fr';
  const e = ctx.classification.entities;
  if (e.phone || e.email) {
    const lookup = await sandbox.execute(ctx, 'customer.lookup', { phone: e.phone ?? '', email: e.email ?? '' });
    if (lookup.ok && lookup.data) {
      const c = lookup.data as { name?: string; phone?: string };
      return {
        reply: EN(`Oui, je vous reconnais${c.name ? `, ${c.name}` : ''} 😊 Que puis-je faire pour vous ?`, `Yes, I remember you${c.name ? `, ${c.name}` : ''} 😊 What can I do for you?`, lang),
        facts: toolFacts([lookup]),
        changed: false,
      };
    }
  }
  return { reply: EN(`Je ne crois pas vous avoir encore enregistré. Comment puis-je vous aider ?`, `I don't think I've registered you yet. How can I help?`, lang), facts: [], changed: false };
}

export async function handleKnowledge(input: AgentInput): Promise<AgentOutput> {
  const { ctx, sandbox } = input;
  const text = ctx.history[ctx.history.length - 1]?.body ?? '';
  const kb = await sandbox.execute(ctx, 'knowledge.search', { query: text });
  const facts = toolFacts([kb]);
  const answer = facts.find((f) => f.startsWith('KB'));
  if (answer) return { reply: answer.replace(/^KB\[[^\]]+\]:\s*/, ''), facts, changed: false };
  const lang = ctx.customer?.language === 'en' ? 'en' : 'fr';
  return {
    reply: EN(
      `Bonne question ! Je n'ai pas cette information dans ma base. Voulez-vous que je vous mette en contact avec la réception ?`,
      `Good question! I don't have that in my knowledge base. Would you like me to connect you with the front desk?`,
      lang,
    ),
    facts,
    changed: false,
  };
}

export async function handleThankOrGoodbye(input: AgentInput): Promise<AgentOutput> {
  const lang = input.ctx.customer?.language === 'en' ? 'en' : 'fr';
  if (input.ctx.classification.intent === 'goodbye') {
    return { reply: EN(`Au revoir et à bientôt au ${input.ctx.hotel.name} ! 🏨`, `Goodbye — see you soon at ${input.ctx.hotel.name}! 🏨`), facts: [], changed: false };
  }
  return { reply: EN(`Avec plaisir ! N'hésitez pas si vous avez d'autres questions. 😊`, `You're welcome! Don't hesitate if you have any other questions. 😊`), facts: [], changed: false };
}

/** Default fallback for unrecognized / low confidence intents. */
export async function handleUnknown(input: AgentInput): Promise<AgentOutput> {
  const lang = input.ctx.customer?.language === 'en' ? 'en' : 'fr';
  const text = input.ctx.history[input.ctx.history.length - 1]?.body ?? '';
  const kb = await input.sandbox.execute(input.ctx, 'knowledge.search', { query: text });
  const facts = toolFacts([kb]);
  const answer = facts.find((f) => f.startsWith('KB'));
  if (answer) return { reply: answer.replace(/^KB\[[^\]]+\]:\s*/, ''), facts, changed: false };
  return {
    reply: EN(
      `Je n'ai pas bien compris 🙈. Je peux vous aider avec : la disponibilité des chambres, les tarifs, les réservations, notre localisation, le check-in, ou vous mettre en contact avec un membre de l'équipe.`,
      `I didn't quite get that 🙈. I can help with: room availability, rates, reservations, our location, check-in, or connecting you with a team member.`,
      lang,
    ),
    facts,
    changed: false,
  };
}

const HANDLERS: Record<string, (i: AgentInput) => Promise<AgentOutput>> = {
  greeting: handleGreeting,
  thanks: handleThankOrGoodbye,
  goodbye: handleThankOrGoodbye,
  availability: handleAvailability,
  price: handlePrice,
  booking: handleBooking,
  booking_confirm: handleBookingConfirm,
  booking_cancel: handleBookingCancel,
  location: handleLocation,
  checkin_policy: handleCheckinPolicy,
  checkout_time: handleCheckoutPolicy,
  amenities: handleAmenities,
  feedback: handleFeedback,
  escalation: handleEscalation,
  lead_capture: handleLeadCapture,
  customer_lookup: handleCustomerLookup,
  faq: handleKnowledge,
  unknown: handleUnknown,
};

export function agentForIntent(intent: Intent): ((i: AgentInput) => Promise<AgentOutput>) | null {
  return HANDLERS[intent] ?? null;
}