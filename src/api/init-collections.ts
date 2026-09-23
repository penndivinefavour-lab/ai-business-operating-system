// src/api/init-collections.ts

import { PocketBaseClient } from '../adapters/database/PocketBaseClient.js';

const PB_URL = process.env.POCKETBASE_URL || 'http://localhost:8090';
const PB_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@hotel.com';
const PB_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || 'admin123456';

const collections = [
  {
    name: 'tenants',
    type: 'base',
    schema: [
      { name: 'name', type: 'text', required: true },
      { name: 'slug', type: 'text', required: true },
      { name: 'description', type: 'text', required: false },
      { name: 'address', type: 'text', required: false },
      { name: 'phone', type: 'text', required: false },
      { name: 'email', type: 'text', required: false },
      { name: 'website', type: 'text', required: false },
      { name: 'check_in_time', type: 'text', required: false },
      { name: 'check_out_time', type: 'text', required: false },
      { name: 'currency', type: 'text', required: false },
    ],
  },
  {
    name: 'rooms',
    type: 'base',
    schema: [
      { name: 'tenant_id', type: 'text', required: true },
      { name: 'type', type: 'text', required: true },
      { name: 'name', type: 'text', required: true },
      { name: 'description', type: 'text', required: false },
      { name: 'price_cents', type: 'number', required: true },
      { name: 'amenities', type: 'json', required: false },
      { name: 'total_count', type: 'number', required: true },
      { name: 'images', type: 'json', required: false },
    ],
  },
  {
    name: 'customers',
    type: 'base',
    schema: [
      { name: 'tenant_id', type: 'text', required: true },
      { name: 'name', type: 'text', required: true },
      { name: 'phone', type: 'text', required: true },
      { name: 'email', type: 'text', required: false },
      { name: 'total_stays', type: 'number', required: false },
      { name: 'total_spent_cents', type: 'number', required: false },
      { name: 'preferences', type: 'text', required: false },
      { name: 'notes', type: 'text', required: false },
    ],
  },
  {
    name: 'conversations',
    type: 'base',
    schema: [
      { name: 'tenant_id', type: 'text', required: true },
      { name: 'customer_id', type: 'text', required: false },
      { name: 'channel', type: 'text', required: false },
      { name: 'status', type: 'text', required: false },
      { name: 'metadata', type: 'json', required: false },
    ],
  },
  {
    name: 'messages',
    type: 'base',
    schema: [
      { name: 'tenant_id', type: 'text', required: true },
      { name: 'conversation_id', type: 'text', required: true },
      { name: 'direction', type: 'text', required: true },
      { name: 'content', type: 'text', required: true },
      { name: 'actor', type: 'text', required: false },
      { name: 'metadata', type: 'json', required: false },
    ],
  },
  {
    name: 'leads',
    type: 'base',
    schema: [
      { name: 'tenant_id', type: 'text', required: true },
      { name: 'name', type: 'text', required: false },
      { name: 'phone', type: 'text', required: false },
      { name: 'email', type: 'text', required: false },
      { name: 'interest', type: 'text', required: false },
      { name: 'status', type: 'text', required: false },
      { name: 'source', type: 'text', required: false },
      { name: 'converted_to_customer_id', type: 'text', required: false },
    ],
  },
  {
    name: 'bookings',
    type: 'base',
    schema: [
      { name: 'tenant_id', type: 'text', required: true },
      { name: 'customer_id', type: 'text', required: true },
      { name: 'room_id', type: 'text', required: true },
      { name: 'check_in', type: 'text', required: true },
      { name: 'check_out', type: 'text', required: true },
      { name: 'status', type: 'text', required: false },
      { name: 'total_cents', type: 'number', required: false },
      { name: 'special_requests', type: 'text', required: false },
    ],
  },
  {
    name: 'feedback',
    type: 'base',
    schema: [
      { name: 'tenant_id', type: 'text', required: true },
      { name: 'customer_id', type: 'text', required: false },
      { name: 'booking_id', type: 'text', required: false },
      { name: 'rating', type: 'number', required: false },
      { name: 'comment', type: 'text', required: false },
      { name: 'status', type: 'text', required: false },
    ],
  },
  {
    name: 'escalations',
    type: 'base',
    schema: [
      { name: 'tenant_id', type: 'text', required: true },
      { name: 'conversation_id', type: 'text', required: true },
      { name: 'reason', type: 'text', required: false },
      { name: 'status', type: 'text', required: false },
      { name: 'assigned_to', type: 'text', required: false },
      { name: 'context', type: 'json', required: false },
    ],
  },
  {
    name: 'audit_logs',
    type: 'base',
    schema: [
      { name: 'tenant_id', type: 'text', required: true },
      { name: 'actor', type: 'text', required: true },
      { name: 'action', type: 'text', required: true },
      { name: 'entity', type: 'text', required: false },
      { name: 'entity_id', type: 'text', required: false },
      { name: 'details', type: 'json', required: false },
    ],
  },
  {
    name: 'knowledge',
    type: 'base',
    schema: [
      { name: 'tenant_id', type: 'text', required: true },
      { name: 'type', type: 'text', required: true },
      { name: 'title', type: 'text', required: true },
      { name: 'content', type: 'text', required: true },
      { name: 'embedding', type: 'json', required: false },
      { name: 'metadata', type: 'json', required: false },
    ],
  },
];

async function init() {
  const pb = new PocketBaseClient(PB_URL);
  
  console.log('[Init] Authenticating...');
  await pb.authenticate(PB_EMAIL, PB_PASSWORD);
  console.log('[Init] Authenticated');

  for (const collection of collections) {
    try {
      // Check if collection exists
      const res = await fetch(`${PB_URL}/api/collections/${collection.name}`, {
        headers: pb.getAuthToken() ? { Authorization: pb.getAuthToken()! } : {},
      });
      if (res.ok) {
        console.log(`[Init] Collection '${collection.name}' already exists`);
        continue;
      }
    } catch {}

    try {
      const res = await fetch(`${PB_URL}/api/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.getAuthToken() || '',
        },
        body: JSON.stringify(collection),
      });
      if (res.ok) {
        console.log(`[Init] Created collection '${collection.name}'`);
      } else {
        console.log(`[Init] Failed to create '${collection.name}': ${res.status}`);
      }
    } catch (e: any) {
      console.log(`[Init] Error creating '${collection.name}': ${e.message}`);
    }
  }

  console.log('\n✅ Collections initialized!');
}

init().catch(console.error);
