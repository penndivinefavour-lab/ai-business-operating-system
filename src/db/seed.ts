import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { closeDb, openDb } from './client.ts';
import { migrate } from './schema.ts';
import {
  createCustomer,
  createEscalation,
  createFeedback,
  createFollowup,
  createHotel,
  createHotelUser,
  createKnowledgeItem,
  createLead,
  createReservation,
  createRoom,
  listHotels,
  updateReservationStatus,
  writeAudit,
} from './repositories.ts';
import { addDays, nowIso, todayIso } from '../core/time.ts';
import { slugify } from '../core/format.ts';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split('$');
  if (!salt || !hash) return false;
  const check = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return check.length === expected.length && timingSafeEqual(check, expected);
}

/** Deterministic demo customer phone numbers. */
export const DEMO_PHONES = {
  aicha: '+237677123456',
  jean: '+237699888777',
  marie: '+237655112233',
  david: '+237690445566',
  sonia: '+237671000111',
};

/**
 * Seed a fully realistic demo hotel (deterministic relative to "today").
 * Returns the demo hotel id.
 */
export function seedDemoHotel(reset = false): number {
  const db = openDb();
  migrate();
  if (reset) {
    db.exec('DELETE FROM agent_runs; DELETE FROM audit_log; DELETE FROM messages; DELETE FROM conversations;');
    // cascades clear child rows via FK ON DELETE CASCADE per tenant rows except hotels/users
    db.exec('DELETE FROM reservations; DELETE FROM leads; DELETE FROM feedback; DELETE FROM followups; DELETE FROM escalations; DELETE FROM customers; DELETE FROM knowledge_items; DELETE FROM rooms; DELETE FROM hotel_users; DELETE FROM hotels;');
  }
  const existing = listHotels();
  if (existing.length > 0) return existing[0]!.id;

  const hotelId = createHotel({
    slug: 'demo',
    name: 'Hôtel Le Safran Douala',
    description: 'Hôtel 3 étoiles moderne en plein centre de Douala — chambres climatisées, Wi-Fi inclus, restaurant et piscine. Idéal voyage d’affaires et détente.',
    email: 'contact@safran-douala.com',
    phone: '+237 233 42 88 77',
    whatsappPhone: '+237 671 000 111',
    address: 'Avenue de la République, Bonanjo',
    city: 'Douala',
    country: 'Cameroon',
    currency: 'XAF',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    taxRate: 19.25,
    timezone: 'Africa/Douala',
    demoEnabled: 1,
  });

  createHotelUser(hotelId, 'Staff Démo', 'staff@demo.hotel', hashPassword('demo-staff-123'), 'staff');

  // Rooms (deterministic, realistic Mid-range Douala pricing)
  const roomSpecs: Array<[string, string, string, number, number, number, string]> = [
    ['101', 'Chambre Standard', 'standard', 1, 2, 25000, 'Vue cour, clim, TV, Wi-Fi, salle de bain'],
    ['102', 'Chambre Standard', 'standard', 1, 2, 25000, 'Vue cour, clim, TV, Wi-Fi, salle de bain'],
    ['103', 'Chambre Standard', 'standard', 1, 2, 25000, 'Vue jardin, clim, TV, Wi-Fi'],
    ['201', 'Chambre Exécutive', 'executive', 2, 2, 38000, 'Grand lit, bureau, minibar, clim, Wi-Fi'],
    ['202', 'Chambre Exécutive', 'executive', 2, 2, 38000, 'Grand lit, bureau, minibar, clim, Wi-Fi'],
    ['203', 'Exécutive Vue Mer', 'executive', 2, 2, 40000, 'Vue mer, grand lit, minibar, clim'],
    ['301', 'Suite Junior', 'suite', 3, 3, 55000, 'Salon + chambre, jacuzzi, minibar, clim'],
    ['302', 'Suite Prestige', 'suite', 3, 4, 60000, 'Salon + chambre, vue ville, minibar, clim'],
    ['401', 'Suite Famille', 'family', 4, 5, 70000, '2 pièces, lit king + lits enfants, cuisine'],
    ['402', 'Chambre Standard Supplémentaire', 'standard', 4, 2, 25000, 'Clim, TV, Wi-Fi, bain'],
  ];
  for (const [number, name, type, floor, cap, price, amenities] of roomSpecs) {
    createRoom(hotelId, { number, name, roomType: type, floor, capacity: cap, basePrice: price, amenities });
  }

  // Knowledge base
  const kb: Array<[string, string, string, string]> = [
    ['location', 'Où êtes-vous situés? / Where are you located?', 'Nous sommes à l\’Avenue de la République, Bonanjo, en plein centre-ville de Douala, à 5 minutes de l\’aéroport par la voie rapide et à 10 minutes des berges. Nous pouvons vous envoyer notre position exacte sur WhatsApp.', 'location adresse address situé bonanjo douala centre aéroport directions itinéraire'],
    ['checkin', 'Check-in / Check-out', 'Check-in à partir de 14h00, check-out avant 12h00. Vos bagages peuvent être gardés gratuitement à la réception.', 'checkin check-in arrival arrivee depart departure heure time'],
    ['checkin', 'Peut-on arriver tôt? / Early check-in', 'L\’early check-in est possible selon la disponibilité des chambres. Indiquez-nous votre heure d\’arrivée et nous préparerons votre chambre dès que possible.', 'early check-in arrive tôt tôt plus tôt matin matin'],
    ['amenities', 'Wi-Fi', 'Le Wi-Fi est gratuit et illimité dans tout l\’hôtel (chambres, lobby, restaurant, piscine). Mot de passe communiqué à l\’arrivée.', 'wifi internet connexion réseau'],
    ['amenities', 'Petit-déjeuner', 'Petit-déjeuner continental/buffet servi de 6h00 à 10h30 (inclus dans le tarif). Options locales: beignets, œufs, café, jus de bissap.', 'breakfast petit-déjeuner petit dejeuner petit dejeuner buffet repas nourriture'],
    ['amenities', 'Piscine et détente', 'Piscine extérieure ouverte 7j/7 de 7h00 à 19h00 avec transats et serviettes. Wi-Fi disponible au bord de la piscine.', 'pool piscine nager détente relax'],
    ['amenities', 'Parking', 'Parking privé sécurisé gratuit pour les clients de l\’hôtel (30 places, gardien 24h/24).', 'parking voiture garage sécurisé'],
    ['amenities', 'Restaurant', 'Le restaurant Le Safran sert une cuisine camerounaise et internationale de 12h00 à 22h00. Room service 24h/24.', 'restaurant cuisine manger repas room service bar'],
    ['amenities', 'Navette aéroport', 'Navette aéroport disponible sur demande: 5 000 FCFA par trajet (réservation à l\’accueil).', 'airport shuttle navette aéroport transfert'],
    ['payment', 'Moyens de paiement', 'Nous acceptons les espèces, les cartes Visa/Mastercard et le Mobile Money (MTN MoMo, Orange Money).', 'payment paiement mobile money mtn momo orange money carte visa mastercard espèces cash'],
    ['policies', 'Politique d\’annulation', 'Annulation gratuite jusqu\’à 48h avant l\’arrivée. Passé ce délai, la première nuit peut être facturée.', 'annulation cancel politique réservation remboursement'],
    ['policies', 'Sécurité', 'Sécurité 24h/24, vidéosurveillance aux accès, coffre-fort en chambre et à la réception.', 'securite safety security coffre sur'],
    ['amenities', 'Équipements en chambre', 'Chaque chambre: clim, TV satellite, Wi-Fi, minibar (exécutif et suites), sèche-cheveux, eau offerte.', 'tv clim minibar television equipement seche cheveux'],
    ['policies', 'Animaux', 'Les animaux de compagnie ne sont pas admis dans l\’hôtel. Nous pouvons vous recommander un chenil à proximité.', 'animaux pets dogs chiens animaux interdit'],
    ['booking', 'Tarifs des chambres', 'Standard 25 000 FCFA/nuit, Exécutive 38 000-40 000 FCFA/nuit, Suite 55 000-60 000 FCFA/nuit, Suite famille 70 000 FCFA/nuit. Taxes incluses.', 'tarifs rates prix chambres standard executive suite famille prix'],
  ];
  for (const [category, q, a, kw] of kb) {
    createKnowledgeItem(hotelId, { category, question: q, answer: a, keywords: kw });
  }

  // Customers
  const cAicha = createCustomer(hotelId, { name: 'Aïcha Mbarga', phone: DEMO_PHONES.aicha, email: 'aicha.mbarga@gmail.com', language: 'fr', source: 'walkin' });
  const cJean = createCustomer(hotelId, { name: 'Jean-Paul Etoga', phone: DEMO_PHONES.jean, email: 'jp.etoga@yahoo.fr', language: 'fr', source: 'whatsapp' });
  const cMarie = createCustomer(hotelId, { name: 'Marie Fotso', phone: DEMO_PHONES.marie, email: 'marie.fotso@outlook.com', language: 'fr', source: 'web' });
  const cDavid = createCustomer(hotelId, { name: 'David Tabekon', phone: DEMO_PHONES.david, email: 'david.tabekon@gmail.com', language: 'en', source: 'web' });
  const cSonia = createCustomer(hotelId, { name: 'Sonia Biko', phone: DEMO_PHONES.sonia, email: 'sonia.biko@icloud.com', language: 'fr', source: 'whatsapp' });

  // Past reservations (checked out / for reports)
  const past = createReservation(hotelId, { customerId: cMarie, checkIn: addDays(todayIso(), -8), checkOut: addDays(todayIso(), -6), guests: 1, roomIds: [1], totalAmount: 50000, source: 'ai', notes: 'Past stay' });
  updateReservationStatus(hotelId, past, 'checked_out');
  const past2 = createReservation(hotelId, { customerId: cDavid, checkIn: addDays(todayIso(), -5), checkOut: addDays(todayIso(), -4), guests: 2, roomIds: [4], totalAmount: 38000, source: 'walkin', notes: 'Past stay' });
  updateReservationStatus(hotelId, past2, 'checked_out');
  const past3 = createReservation(hotelId, { customerId: cJean, checkIn: addDays(todayIso(), -3), checkOut: addDays(todayIso(), -2), guests: 1, roomIds: [2], totalAmount: 25000, source: 'ai', notes: 'Past stay' });
  updateReservationStatus(hotelId, past3, 'checked_out');

  // Arrivals today
  const tod1 = createReservation(hotelId, { customerId: cAicha, checkIn: todayIso(), checkOut: addDays(todayIso(), 2), guests: 1, roomIds: [1], totalAmount: 50000, source: 'whatsapp', notes: 'WhatsApp booking' });
  updateReservationStatus(hotelId, tod1, 'checked_in');
  const tod2 = createReservation(hotelId, { customerId: cJean, checkIn: todayIso(), checkOut: addDays(todayIso(), 1), guests: 2, roomIds: [4], totalAmount: 38000, source: 'phone', notes: 'Call-in booking' });
  updateReservationStatus(hotelId, tod2, 'checked_in');

  // Future confirmed (next week, avoiding the demo "friday" scenario rooms)
  const fut1 = createReservation(hotelId, { customerId: cMarie, checkIn: addDays(todayIso(), 7), checkOut: addDays(todayIso(), 9), guests: 1, roomIds: [5], totalAmount: 76000, source: 'ai', notes: 'AI booking' });
  updateReservationStatus(hotelId, fut1, 'confirmed');
  const fut2 = createReservation(hotelId, { customerId: cDavid, checkIn: addDays(todayIso(), 10), checkOut: addDays(todayIso(), 12), guests: 2, roomIds: [2], totalAmount: 50000, source: 'web', notes: 'Web booking' });
  updateReservationStatus(hotelId, fut2, 'confirmed');

  // Pending "requested" reservation (for demoing the confirm step)
  createReservation(hotelId, { customerId: cSonia, checkIn: todayIso(), checkOut: addDays(todayIso(), 1), guests: 1, roomIds: [3], totalAmount: 25000, source: 'ai', notes: 'Awaiting confirmation' });

  // Leads
  createLead(hotelId, { customerId: cJean, name: 'Jean-Patrick Etoga', phone: DEMO_PHONES.jean, email: 'jp.etoga@yahoo.fr', intent: 'corporate', status: 'qualified', notes: 'Société veut un tarif entreprise pour 6 chambres/mois.' });
  createLead(hotelId, { name: 'Agence Congo Tours', phone: '+242066123456', email: 'reservation@congotours.co', intent: 'group', status: 'new', notes: 'Groupe de 25 personnes, juillet.' });

  // Feedback
  createFeedback(hotelId, { customerId: cMarie, reservationId: past, rating: 9, comment: 'Très bon accueil, chambre propre, je reviendrai.' });
  createFeedback(hotelId, { customerId: cDavid, reservationId: past2, rating: 7, comment: 'Good value, breakfast could be better.' });
  createFeedback(hotelId, { customerId: cJean, reservationId: past3, rating: 4, comment: 'Climatisation en panne la première nuit, réponse de la réception longue.' });

  // Follow-up pending
  createFollowup(hotelId, { customerId: cJean, dueAt: todayIso(), task: 'Appeler M. Etoga pour le suivi de la plainte climatisation (feedback 4/10).' });
  createEscalation(hotelId, { customerId: cJean, reason: 'Plainte climatisation non résolue en séance — demande d\’appel du responsable.' });

  writeAudit({ hotelId, actorType: 'system', actorId: 'seeder', action: 'seed', entity: 'hotel', entityId: hotelId, details: 'Demo data initialized' });

  return hotelId;
}

export function isDemoHotelSeeded(): boolean {
  return listHotels().length > 0;
}

export { slugify, todayIso };