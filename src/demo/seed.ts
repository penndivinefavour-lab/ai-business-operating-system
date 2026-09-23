// src/demo/seed.ts

import { createDatabaseClient } from '../adapters/database/index.js';
import type { PBRecord } from '../adapters/database/PocketBaseClient.js';

const PB_URL = process.env.POCKETBASE_URL || 'http://localhost:8090';
const PB_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@hotel.com';
const PB_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || 'admin123456';

async function seed() {
  const db = createDatabaseClient(PB_URL);
  
  try {
    await db.authenticate(PB_EMAIL, PB_PASSWORD);
  } catch (e) {
    console.error('Cannot authenticate with PocketBase. Make sure it is running.');
    console.error('Run: ./pocketbase/pocketbase serve');
    process.exit(1);
  }

  console.log('[Demo] Seeding database...');

  // Create demo hotel tenant
  const tenant = (await db.create('tenants', {
    name: 'Hotel La Paix',
    slug: 'hotel-la-paix',
    description: 'A premier hotel in the heart of Yaoundé, Cameroon. Offering comfortable rooms, excellent service, and a prime location.',
    address: '45 Avenue Ahidjo, Yaoundé, Cameroon',
    phone: '+237 672 536 260',
    email: 'contact@lapaixhotel.com',
    website: 'https://lapaixhotel.com',
    check_in_time: '14:00',
    check_out_time: '12:00',
    currency: 'FCFA',
    created_at: new Date().toISOString(),
  })) as unknown as PBRecord;
  console.log(`[Demo] Created tenant: ${tenant.id}`);

  const tenantId = tenant.id;

  // Create rooms
  const rooms = [
    { type: 'Standard', name: 'Standard Room', description: 'Comfortable room with queen bed, AC, and WiFi', price_cents: 2500000, amenities: ['WiFi', 'AC', 'TV', 'Mini-bar'], total_count: 5 },
    { type: 'Executive', name: 'Executive Room', description: 'Spacious room with king bed, work desk, and city view', price_cents: 7500000, amenities: ['WiFi', 'AC', 'TV', 'Mini-bar', 'Work Desk', 'City View'], total_count: 3 },
    { type: 'Deluxe', name: 'Deluxe Suite', description: 'Luxury suite with living room, bedroom, and premium amenities', price_cents: 12000000, amenities: ['WiFi', 'AC', 'TV', 'Mini-bar', 'Living Room', 'Jacuzzi', 'Balcony'], total_count: 2 },
    { type: 'Family', name: 'Family Room', description: 'Large room with two double beds, ideal for families', price_cents: 4500000, amenities: ['WiFi', 'AC', 'TV', 'Mini-bar', 'Extra Space', 'Kids Friendly'], total_count: 4 },
  ];

  for (const room of rooms) {
    await db.create('rooms', { ...room, tenant_id: tenantId, images: [], created_at: new Date().toISOString() });
  }
  console.log(`[Demo] Created ${rooms.length} rooms`);

  // Create knowledge base
  const knowledgeDocs = [
    { type: 'location', title: 'Hotel Location', content: 'Hotel La Paix is located at 45 Avenue Ahidjo, Yaoundé, Cameroon. We are in the city center, close to major businesses, restaurants, and attractions. The hotel is approximately 30 minutes from Yaoundé Nsimalen International Airport.' },
    { type: 'policy', title: 'Check-in Policy', content: 'Standard check-in time is 2:00 PM. Early check-in is available subject to availability and may incur a supplementary charge of 10,000 FCFA. To request early check-in, please contact us 24 hours before arrival.' },
    { type: 'policy', title: 'Check-out Policy', content: 'Standard check-out time is 12:00 PM (noon). Late check-out is available upon request, subject to availability, and may incur a charge of 10,000 FCFA per hour.' },
    { type: 'policy', title: 'Cancellation Policy', content: 'Cancellations made 48 hours or more before check-in are fully refunded. Cancellations within 48 hours are subject to a one-night charge. No-shows will be charged the full booking amount.' },
    { type: 'policy', title: 'Pet Policy', content: 'Small pets (under 10kg) are allowed in designated rooms for a supplementary fee of 5,000 FCFA per night. Pets must be supervised at all times. Service animals are welcome free of charge.' },
    { type: 'policy', title: 'Smoking Policy', content: 'Hotel La Paix is a non-smoking property. Smoking is prohibited in all indoor areas. Designated smoking areas are available on the terrace and balcony areas.' },
    { type: 'policy', title: 'Payment Policy', content: 'We accept cash (FCFA), mobile money (MTN Mobile Money, Orange Money), and credit cards (Visa, Mastercard). Payment is due at check-in unless otherwise arranged.' },
    { type: 'service', title: 'WiFi', content: 'Complimentary high-speed WiFi is available throughout the hotel. Network: HotelLaPaix_Guest, password provided at check-in.' },
    { type: 'service', title: 'Parking', content: 'Free secure parking is available on-site for hotel guests. 24/7 security surveillance. Valet parking available for 2,000 FCFA per day.' },
    { type: 'service', title: 'Restaurant', content: 'Our restaurant "Le Palais" serves breakfast (6:30-10:30 AM), lunch (12:00-3:00 PM), and dinner (6:00-10:00 PM). Local and international cuisine. Room service available 24/7.' },
    { type: 'service', title: 'Pool', content: 'Outdoor swimming pool open daily from 7:00 AM to 8:00 PM. Pool towels provided. Children must be accompanied by an adult.' },
    { type: 'service', title: 'Gym', content: '24-hour fitness center with modern equipment. Free for all hotel guests.' },
    { type: 'service', title: 'Spa', content: 'Full-service spa offering massages, facials, and body treatments. Open 9:00 AM to 8:00 PM. Advance booking recommended.' },
    { type: 'service', title: 'Airport Transfer', content: 'Airport pickup and drop-off available for 15,000 FCFA one-way. Please book at least 24 hours in advance by calling +237 672 536 260.' },
    { type: 'service', title: 'Taxi Service', content: 'We can arrange taxi service to any destination in Yaoundé. Please contact the front desk for assistance.' },
    { type: 'faq', title: 'Breakfast', content: 'Breakfast is included in Executive and Deluxe rooms. For Standard and Family rooms, breakfast is available for 5,000 FCFA per person. Breakfast is served from 6:30 to 10:30 AM.' },
    { type: 'faq', title: 'Room Service', content: 'Room service is available 24 hours. A 2,000 FCFA delivery charge applies for orders under 10,000 FCFA.' },
    { type: 'general', title: 'Welcome Message', content: 'Welcome to Hotel La Paix! We are delighted to have you as our guest. Our team is here to ensure you have a comfortable and memorable stay. Do not hesitate to reach out for any assistance.' },
  ];

  for (const doc of knowledgeDocs) {
    await db.create('knowledge', { ...doc, tenant_id: tenantId, metadata: {}, created_at: new Date().toISOString() });
  }
  console.log(`[Demo] Created ${knowledgeDocs.length} knowledge documents`);

  // Create demo customers
  const customers = [
    { name: 'Jean-Pierre Atangana', phone: '+237 690 123 456', email: 'jp.atangana@email.com', total_stays: 3, total_spent_cents: 15000000, preferences: 'High floor, extra pillows' },
    { name: 'Marie Nkeng', phone: '+237 677 987 654', email: 'marie.nkeng@email.com', total_stays: 1, total_spent_cents: 7500000, preferences: 'Quiet room' },
    { name: 'Paul Biya Jr', phone: '+237 655 111 222', email: 'p.biya@email.com', total_stays: 5, total_spent_cents: 35000000, preferences: 'Executive room, late check-out' },
  ];

  for (const customer of customers) {
    await db.create('customers', { ...customer, tenant_id: tenantId, notes: 'Demo customer', created_at: new Date().toISOString() });
  }
  console.log(`[Demo] Created ${customers.length} customers`);

  // Get room IDs to link bookings
  const roomList = await db.getRooms(tenantId);
  
  // Get customer IDs
  const customerRes = await db.list('customers', `tenant_id="${tenantId}"`);

  // Create demo bookings
  const bookings = [
    { room_idx: 0, customer_idx: 0, check_in: '2026-09-25', check_out: '2026-09-27', status: 'confirmed', total_cents: 5000000, special_requests: 'Airport pickup at 10 AM' },
    { room_idx: 1, customer_idx: 1, check_in: '2026-09-26', check_out: '2026-09-28', status: 'pending', total_cents: 15000000, special_requests: 'Champagne on arrival' },
  ];

  for (const b of bookings) {
    const roomId = roomList[b.room_idx]?.id;
    const custId = (customerRes.items?.[b.customer_idx] as any)?.id;
    if (roomId && custId) {
      await db.create('bookings', {
        tenant_id: tenantId,
        customer_id: custId,
        room_id: roomId,
        ...b,
        created_at: new Date().toISOString(),
      });
    }
  }
  console.log(`[Demo] Created ${bookings.length} bookings`);

  // Create demo feedback
  const feedback = [
    { customer_idx: 0, rating: 5, comment: 'Excellent service! The staff was very friendly and the room was spotless.' },
    { customer_idx: 1, rating: 4, comment: 'Good location and comfortable bed. WiFi could be faster.' },
  ];

  for (const fb of feedback) {
    const custId = (customerRes.items?.[fb.customer_idx] as any)?.id;
    if (custId) {
      await db.create('feedback', {
        tenant_id: tenantId,
        customer_id: custId,
        booking_id: '',
        rating: fb.rating,
        comment: fb.comment,
        status: 'new',
        created_at: new Date().toISOString(),
      });
    }
  }
  console.log(`[Demo] Created ${feedback.length} feedback entries`);

  console.log('\n✅ Demo database seeded successfully!');
  console.log(`\nHotel: Hotel La Paix (${tenantId})`);
  console.log(`Knowledge docs: ${knowledgeDocs.length}`);
  console.log(`Rooms: ${rooms.length}`);
  console.log(`Customers: ${customers.length}`);
  console.log(`Bookings: ${bookings.length}`);
}

seed().catch(console.error);
