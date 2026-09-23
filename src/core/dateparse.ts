import { addDays, nextWeekday } from './time.ts';

/**
 * Deterministic natural-language date parsing (fr/en) for stay requests.
 * Returns ISO dates (YYYY-MM-DD). Everything here is pure string logic so the
 * agent can never invent a date the guest did not express.
 */

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sundaynight: 0, dimanche: 0, samedi: 6, saturday: 6,
  monday: 1, mondaynight: 1, lundi: 1, tuesday: 2, mardi: 2,
  wednesday: 3, mercredi: 3, thursday: 4, jeudi: 4,
  friday: 5, fridaynight: 5, vendredi: 5,
};

const MONTHS: Record<string, number> = {
  janvier: 1, january: 1, fevrier: 2, février: 2, févr: 2, february: 2, feb: 2,
  mars: 3, march: 3, mar: 3, avril: 4, april: 4, apr: 4,
  mai: 5, may: 5, juin: 6, june: 6, jun: 6,
  juillet: 7, july: 7, jul: 7, aout: 8, août: 8, august: 8, aug: 8,
  septembre: 9, september: 9, sep: 9, october: 10, octobre: 10, oct: 10,
  novembre: 11, november: 11, nov: 11, decembre: 12, décembre: 12, december: 12, dec: 12,
};

export function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[?.,!;:'"]/g, '');
}

export interface ParsedDate {
  checkIn: string;
  /** human description of what was understood */
  description: string;
  explicit: boolean;
}

/** Resolve the first date reference in the text. Null when none expressed. */
export function parseCheckIn(text: string): ParsedDate | null {
  const t = normalizeText(text);

  // "today tonight this evening ce soir aujourd'hui"
  if (/\b(tonight|today|ce soira|ce soir|aujourd['’]hui|ajd)\b/.test(t)) {
    return { checkIn: addDays(new Date().toISOString().slice(0, 10), 0), description: 'aujourd\'hui / ce soir', explicit: true };
  }
  // "tomorrow demain"
  if (/\b(tomorrow|demain)\b/.test(t)) {
    return { checkIn: addDays(new Date().toISOString().slice(0, 10), 1), description: 'demain', explicit: true };
  }
  // "this weekend ce week-end"
  if (/(this weekend|weekend|ce week[ -]?end|ce we)/.test(t)) {
    const d = nextWeekday(6, false);
    return { checkIn: d, description: 'le prochain samedi', explicit: true };
  }

  // "on friday", "friday night", "vendredi soir"
  const weekdayMatch = t.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|samedi|dimanche|lundi|mardi|mercredi|jeudi|vendredi)\b/);
  if (weekdayMatch) {
    const idx = WEEKDAYS[weekdayMatch[0]]!;
    const checkIn = nextWeekday(idx, false);
    return { checkIn, description: `ce ${weekdayMatch[0] === 'friday' || weekdayMatch[0] === 'vendredi' ? 'vendredi' : weekdayMatch[0]}-ci (${checkIn})`, explicit: true };
  }

  // "on 25 january", "le 25 janvier", "12/25", "25/12/2025"
  const monthDay = t.match(/\b(on|le|the)?\s*(\d{1,2})\s*(janvier|january|fevrier|février|february|mars|march|avril|april|mai|may|juin|june|juillet|july|aout|août|august|septembre|september|octobre|october|novembre|november|decembre|décembre|december)\b/);
  if (monthDay) {
    const day = Number(monthDay[2]);
    const month = MONTHS[monthDay[3]!]!;
    const now = new Date();
    let year = now.getUTCFullYear();
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getTime() < now.getTime() - 86_400_000) year += 1;
    return { checkIn: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, description: `le ${day}/${month}`, explicit: true };
  }

  // dd/mm/yyyy or dd/mm
  const numeric = t.match(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const now = new Date();
      let year = now.getUTCFullYear();
      if (numeric[3]) {
        year = (numeric[3] as string).length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
      } else {
        const candidate = new Date(Date.UTC(year, month - 1, day));
        if (candidate.getTime() < now.getTime() - 86_400_000) year += 1;
      }
      return { checkIn: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, description: `le ${day}/${month}`, explicit: true };
    }
  }

  return null;
}

/** Default check-in when the guest did not express a date. */
export function defaultCheckIn(): string {
  return addDays(new Date().toISOString().slice(0, 10), 1);
}

const NIGHTS_WORDS: Record<string, number> = {
  one: 1, une: 1, un: 1, two: 2, deux: 2, three: 3, trois: 3, four: 4, quatre: 4,
  five: 5, cinq: 5, six: 6, sept: 7, seven: 7, eight: 8, huit: 8, nine: 9, neuf: 9, ten: 10, dix: 10,
};

/** Parse "two nights", "3 nuits", "a week", "une semaine". Default 1 night. */
export function parseNights(text: string): number {
  const t = normalizeText(text);
  // explicit numeric: "2 nights"
  const num = t.match(/(\d+)\s*(night|nuit|nuits|joue|day|days|jours|semaine|week)/);
  if (num) {
    const n = Number(num[1]);
    if (/(week|semaine)/.test(num[2] ?? '')) return 7;
    return Math.max(1, Math.min(30, n));
  }
  const word = t.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|une|un|deux|trois|quatre|cinq|six)\b\s*(night|nuit|nuits|day|days|jours|week|semaine)/);
  if (word) {
    const w = NIGHTS_WORDS[word[1]!];
    if (typeof w === 'number') {
      if (/(week|semaine)/.test(word[2] ?? '')) return 7;
      return w;
    }
  }
  if (/(a few|quelques)\s*(night|nuit|nuits|day|days|jours)/.test(t)) return 2;
  return 1;
}

/** Parse guest count. Default 1. */
export function parseGuests(text: string): number {
  const t = normalizeText(text);
  const num = t.match(/(\d+)\s*(guest|guests|person|people|personne|personnes|adult|adults|adultes|voyage|voyageur|voyageurs|pax)/);
  if (num) {
    const n = Number(num[1]);
    if (n >= 1 && n <= 50) return n;
  }
  if (/\b(one|a|une|un)\s*(adult|adults|adulte|adultes)\b/.test(t)) return 1;
  if (/\b(two|deux)\s*(person|personne|people|adult|adults|adulte|adultes)\b/.test(t)) return 2;
  if (/\b(for|pour)\s*(one|a|une|un)\s*(person|personne|guest)\b/.test(t)) return 1;
  return 1;
}

/** Parse room type keywords (basic). Returns normalized keyword or undefined. */
const ROOM_TYPE_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(executive|exécutif|executif)\b/, 'executive'],
  [/\b(deluxe|de luxe|deluxe)\b/, 'deluxe'],
  [/\b(suite)\b/, 'suite'],
  [/\b(family|famille|familiale)\b/, 'family'],
  [/\b(presidential|présidentielle|presidentielle)\b/, 'presidential'],
  [/\b(standard)\b/, 'standard'],
  [/\b(double|twin)\b/, 'double'],
  [/\b(single|simple)\b/, 'single'],
  [/\b(apartment|appartement|apt)\b/, 'apartment'],
];

export function parseRoomType(text: string): string | undefined {
  const t = normalizeText(text);
  for (const [re, val] of ROOM_TYPE_KEYWORDS) {
    if (re.test(t)) return val;
  }
  return undefined;
}

/** Parse a rating 1-10 / 1-5 with stars. */
export function parseRating(text: string): number | undefined {
  const t = normalizeText(text);
  const match = t.match(/(\d{1,2})\s*(\/10|\/5|sur 10|sur 5|stars|etoiles|étoiles)?/);
  if (match && /(rating|score|note|complaint|problem|problème|probleme|probl)/.test(t)) {
    const n = Number(match[1]);
    if (n >= 1 && n <= 10) return n;
  }
  return undefined;
}

/** Is this message essentially affirm/confirm language? */
export function isAffirmation(text: string): boolean {
  const t = normalizeText(text);
  return /^(yes|yeah|yep|ok|okay|fine|good|perfect|great|go ahead|let'?s do it|d accord|d'accord|oui|ouais|super|tres bien|très bien|ca marche|ça marche|c bon|c'est bon|c est bon|alright|sure)\b/.test(t.trim()) || ['yes', 'ok', 'okay', 'oui', 'd accord', 'd accord'].includes(t.trim());
}

export function isNegation(text: string): boolean {
  const t = normalizeText(text);
  return /^(no|non|nope|pas|not)\b/.test(t.trim()) || ['no', 'non', 'pas', 'not'].includes(t.trim());
}