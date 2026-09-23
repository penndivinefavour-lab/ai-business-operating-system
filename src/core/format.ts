/** Formatting + normalization helpers shared across agents & API. */

export function formatMoney(amount: number, currency = 'XAF'): string {
  const rounded = Math.round(amount);
  const grouped = rounded.toLocaleString('fr-FR').replace(/\u202f/g, ' ').replace(/\u00a0/g, ' ');
  if (currency === 'XAF' || currency === 'FCFA' || currency === '') {
    return `${grouped} FCFA`;
  }
  return `${grouped} ${currency}`;
}

export function formatDateHuman(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toISOString().slice(0, 10);
}

/** French weekday name for an ISO date. */
export function weekdayFr(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const names = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  return names[d.getUTCDay()]!;
}

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Nice human date, e.g. "vendredi 25 septembre" or "Friday 25 September". */
export function formatDateNice(iso: string, lang: 'fr' | 'en' = 'fr'): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (lang === 'en') {
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${names[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_EN[d.getUTCMonth()]}`;
  }
  return `${weekdayFr(iso)} ${d.getUTCDate()} ${MONTHS_FR[d.getUTCMonth()]}`;
}

/** Short ISO date, e.g. "25/09/2026". */
export function formatDateDmy(iso: string): string {
  return iso.split('-').reverse().join('/');
}

/** Normalize a phone number to an international-ish key: digits only, +237 prefixed if Cameroonian-looking. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.length === 9 && digits.startsWith('6')) return `+237${digits}`;
  if (digits.length === 9) return `+237${digits}`;
  return digits.length >= 8 ? `+${digits}` : digits;
}

export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

/** Detects fr vs en quickly. Returns 'fr' | 'en'. */
export function detectLanguage(text: string): 'fr' | 'en' {
  const frWords = ['bonjour', 'salut', 'combien', 'pourriez', 'chambre', 'vous', 'merci', 'nuit', 'nuits', 'oui', 'oui', 'prix', 'tarif', 'situé', 'voulez', 'réserver', 'reserver', 'arriver', 'problème', 'probleme', "aujourd'hui", 'demain', 'étage', 'étage', 'voyage', 'voyageurs', 'disponible', 'disponibili'];
  const enWords = ['hello', 'hi', 'thanks', 'please', 'how much', 'room', 'available', 'book', 'booking', 'night', 'nights', 'yes', 'located', 'want', 'arrive', 'problem', 'today', 'tomorrow', 'floor', 'check-in', 'check-out', 'breakfast', 'suite'];
  const lower = text.toLowerCase();
  let en = 0;
  let fr = 0;
  for (const w of frWords) if (lower.includes(w)) fr += 1;
  for (const w of enWords) if (lower.includes(w)) en += 1;
  if (fr > en) return 'fr';
  return 'en';
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}