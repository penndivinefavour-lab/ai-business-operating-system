import type { Classification, Intent, ResolvedEntities } from '../types.ts';
import { normalizeText, parseCheckIn, parseGuests, parseNights, parseRoomType, isAffirmation } from './dateparse.ts';
import { detectLanguage, isValidEmail, normalizePhone } from './format.ts';

/**
 * Rule-based intent classifier (the deterministic brain of the demo/reception
 * agent). It is intentionally simple and transparent: every business intent
 * must match explicit patterns. No probabilistic guessing of business meaning.
 */

export interface IntentRule {
  name: Intent;
  confidence: number;
  /** array of patterns; ANY match triggers the intent */
  patterns: RegExp[];
  /** high-priority short-circuit intents checked before generic ones */
  priority?: number;
}

const n = (raw: string): string => raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[?.,!;:'"]/g, '');

const RULES: IntentRule[] = [
  {
    name: 'greeting', confidence: 0.9, priority: 1,
    patterns: [/^(hi|hello|hey|yo|salut|bonjour|bonsoir|coucou|good morning|good afternoon|good evening|allô|allo)\b/],
  },
  {
    name: 'thanks', confidence: 0.95, priority: 1,
    patterns: [/\b(thank you|thanks|merci|merci beaucoup|thank)\b/],
  },
  {
    name: 'goodbye', confidence: 0.9, priority: 1,
    patterns: [/\b(bye|goodbye|au revoir|a bientot|a plus|bonne journee|bonne soiree|see you)\b/],
  },
  {
    name: 'escalation', confidence: 0.97, priority: 5,
    patterns: [
      /\b(speak to (a |the )?(human|person|manager|someone|agent|real person)|talk to|parler a (un|quelqu|une) (humain|agent|responsable|directeur)|contacter quelqu|someone (real|human)|manager stp|je veux parler|vouloir parler|parler avec un|un humain|an actual person|call the (hotel|reception)|appeler la reception|human being)\b/,
    ],
  },
  {
    name: 'feedback', confidence: 0.93, priority: 4,
    patterns: [
      /\b(complaint|complaint about|problem with|issue with|probl.probleme|je veux signaler|mauvaise|terrible|not happy|insatisfait|je signale|to complain|se plaindre|bug|pas content|bad experience|could not sleep|noise|bruit|propre pas|unclear)\b/,
    ],
  },
  {
    name: 'booking_cancel', confidence: 0.92, priority: 3,
    patterns: [/\b(cancel|annul|canceled|annuler|modify (the )?booking|reporter (la )?reservation|wrong booking|please cancel|annulation)\b/],
  },
  {
    name: 'availability', confidence: 0.9, priority: 3,
    patterns: [
      /\b(do you have (any )?(a |the )?room|have availab|any (room|free) (for|on)|is (a |the )?room (available|free)|chambre (disponible|libre)|avez[- ]vous (une |des )?(chambre|dispo)|avoir une chambre|dispo|availability|free room|rooms available|available for|(what|how) about (a |the )?(suite|deluxe|king|bigger room|larger room)|et pour (une |la )?suite)\b/,
      /\b(disponibilite|disponibilité)\b/,
    ],
  },
  {
    name: 'price', confidence: 0.88, priority: 3,
    patterns: [
      /\b(how much|combien (coute|co te|ca coute)|price|prix|tarif|rate for|cost|taux|le prix|couts?|coutent|economic|moins cher|c'est combien|what is the (price|rate))\b/,
    ],
  },
  {
    name: 'location', confidence: 0.9, priority: 2,
    patterns: [
      /\b(where are you|where is|location|address|adresse|situ|ou etes|ou es t|comment (vous )?trouver|how (do i find|to find|far)|distance from|near|proche|localisation|l'adresse|your location|coordinates)\b/,
    ],
  },
  {
    name: 'checkin_policy', confidence: 0.9, priority: 2,
    patterns: [/\b(early check[- ]?in|check[- ]?in (time|hour|timing)|arriver (t.t|plus t.t|early)|early arrival|arrive early|can i check in early|heure d'arriv|check in at what time)\b/],
  },
  {
    name: 'checkout_time', confidence: 0.9, priority: 2,
    patterns: [/\b(check[- ]?out (time|hour)|heure de depart|checkout|l'heure de depart|departure time|what time.*(leave|check out)|late check out|depart tard)\b/],
  },
  {
    name: 'amenities', confidence: 0.85, priority: 2,
    patterns: [
      /\b(wifi|wi[- ]?fi|internet|breakfast|petit[- ]?dejeuner|petit dejeuner|pool|piscine|gym|fitness|spa|sauna|parking|restaurant|air conditioning|climatisation|ac included|room service|tv|television|balcon|balkon|hair dryer|minibar|vues?|view)\b/,
    ],
  },
  {
    name: 'booking', confidence: 0.86, priority: 3,
    patterns: [
      /\b(want to (book|stay|reserve)|i.d like to (book|reserve|stay)|like to book|book a room|booking|reserve (a |the )?(room|chambre)|reservation|to book|reserver|réserver|je (veux|voudrais|souhaite) (reserver|réserver|prendre un?|louer)|i.d like|je voudrais|peut[- ]?etre (reserver|réserver)|bestellen|stay for|arrive on|for (one|two|three|four|five|six|une|deux|trois|quatre|cinq) night|pat(\d+|urne|urn|nights)\b)\b/,
    ],
  },
  {
    name: 'lead_capture', confidence: 0.8, priority: 2,
    patterns: [
      /\b(quote|devis|promo|promotion|offer|corporate|societe|société|business rate|tarif entreprise|partnership|partenariat|long stay|group rate|tarif groupe|discount|reduction|cheaper|more affordable|negocier|fidelité|tarif special)\b/,
    ],
  },
  {
    name: 'customer_lookup', confidence: 0.7, priority: 1,
    patterns: [/\b(can you (find|look up|remember)|my name is|i am a guest|i stayed|i booked earlier|do you know me)\b/],
  },
  {
    name: 'unknown', confidence: 0.35, priority: 0,
    patterns: [/.*/],
  },
];

function extractEntities(text: string): ResolvedEntities {
  const entities: ResolvedEntities = {};
  const t = text;

  const parsed = parseCheckIn(t);
  if (parsed) {
    entities.checkIn = parsed.checkIn;
    entities.dateRef = parsed.description;
  }
  entities.nights = parseNights(t);
  if (parsed?.checkIn) {
    entities.checkOut = addDaysLocal(parsed.checkIn, entities.nights);
  }
  entities.guests = parseGuests(t);
  const roomType = parseRoomType(t);
  if (roomType) entities.roomType = roomType;

  const phoneMatch = t.match(/(\+?\d[\d\s.\-()]{7,}\d)/);
  if (phoneMatch?.[1]) entities.phone = normalizePhone(phoneMatch[1]);

  const emailMatch = t.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch && isValidEmail(emailMatch[0])) entities.email = emailMatch[0];

  // Capture a name: "my name is X", "je m'appelle X", "call me X"
  const nameMatch = t.match(/\b(?:my name is|je m'appelle|je m appelle|appelle[- ]?moi|call me|je suis)\s+([A-Za-z\u00C0-\u024F.' -]{2,30})/i);
  if (nameMatch && /^(?:can|could|do|don|did|am|will|won|is|are|il|elle)\b/i.test(nameMatch[1] ?? '') === false) {
    entities.name = (nameMatch[1] ?? '').trim().split(/\s+/).slice(0, 3).join(' ').replace(/[^A-Za-z\u00C0-\u024F.' -]/g, '');
    if (entities.name) entities.name = entities.name.trim();
  }

  return entities;
}

function addDaysLocal(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Merge an affirmation ("yes", "ok") into a real intent given conversation context. */
function disambiguateAffirmation(text: string, lastRecordedIntent: string | undefined): { intent?: Intent; note?: string } {
  if (!isAffirmation(text)) return {};
  switch (lastRecordedIntent) {
    case 'booking':
      return { intent: 'booking_confirm', note: 'guest confirmed a pending booking' };
    default:
      return {};
  }
}

export function classify(text: string, lastRecordedIntent?: string): Classification {
  const t = normalizeText(text);
  const affirmation = disambiguateAffirmation(text, lastRecordedIntent);

  let best: IntentRule | null = null;
  for (const rule of RULES) {
    for (const p of rule.patterns) {
      const wasShort = t.trim().length <= 12 && /\b(yes|ok|okay|oui|d accord|yes|sure|fine|good)\b/.test(t);
      const matched = wasShort ? false : p.test(t);
      if (matched) {
        if (!best || rule.priority! > best.priority!) {
          best = rule;
        } else if (rule.priority === best.priority && rule.confidence > best.confidence) {
          best = rule;
        }
        break;
      }
    }
  }

  // Special-case price+room-type: "How much is the executive room?" is both price & room ref
  // -> treat as price (caller will also fetch room price).
  let intent: Intent = best?.name ?? 'unknown';
  // Short affirmative replies ("yes", "ok") only make sense against conversation context.
  if (affirmation.intent && (best === null || best.priority === 0 || best.priority === 1)) {
    intent = affirmation.intent;
  }

  const entities = extractEntities(text);
  return {
    intent,
    confidence: intent === 'unknown' ? best?.confidence ?? 0.35 : best?.confidence ?? 0.6,
    entities,
    matches: (best?.patterns ?? []).filter((p) => p.test(t)).map((p) => p.source),
  };
}

/** Extra guard: language of the message for the reply composer. */
export function classifyLanguage(text: string): 'fr' | 'en' {
  return detectLanguage(text);
}