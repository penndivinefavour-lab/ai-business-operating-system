// src/demo/simulate.ts

import { createDatabaseClient } from '../adapters/database/index.js';

const PB_URL = process.env.POCKETBASE_URL || 'http://localhost:8090';
const PB_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@hotel.com';
const PB_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || 'admin123456';
const API_URL = process.env.API_URL || 'http://localhost:4000';

const DEMO_CONVERSATIONS = [
  { phone: '+237 690 111 111', message: 'Do you have a room for Friday?' },
  { phone: '+237 690 222 222', message: 'How much is the executive room?' },
  { phone: '+237 690 333 333', message: 'I want to book for two nights' },
  { phone: '+237 690 444 444', message: 'Can I check in early?' },
  { phone: '+237 690 555 555', message: 'Where are you located?' },
  { phone: '+237 690 666 666', message: 'I had a problem with my room' },
  { phone: '+237 690 777 777', message: 'I want to speak to someone' },
  { phone: '+237 690 888 888', message: 'Do you allow pets?' },
];

async function getTenantId(): Promise<string> {
  const db = createDatabaseClient(PB_URL);
  try {
    await db.authenticate(PB_EMAIL, PB_PASSWORD);
  } catch (e) {
    console.error('Cannot authenticate with PocketBase');
    process.exit(1);
  }

  const res = await db.list('tenants', 'slug="hotel-la-paix"');
  if (res.items?.length) return (res.items[0] as any).id;
  
  // Fallback: get first tenant
  const allRes = await db.list('tenants', '', 1, 1);
  if (allRes.items?.length) return (allRes.items[0] as any).id;
  
  throw new Error('No tenant found. Run seed first.');
}

async function simulate() {
  console.log('[Demo] Starting conversation simulation...\n');
  
  let tenantId: string;
  try {
    tenantId = await getTenantId();
  } catch (e: any) {
    console.error('[Demo] Error:', e.message);
    process.exit(1);
  }

  console.log(`[Demo] Using tenant: ${tenantId}\n`);

  for (let i = 0; i < DEMO_CONVERSATIONS.length; i++) {
    const conv = DEMO_CONVERSATIONS[i];
    console.log(`\n--- Scenario ${i + 1} ---`);
    console.log(`Customer (${conv.phone}): "${conv.message}"`);
    
    try {
      const res = await fetch(`${API_URL}/api/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          customer_phone: conv.phone,
          message: conv.message,
        }),
      });
      
      if (!res.ok) {
        console.log(`Error: ${res.status} ${await res.text()}`);
      } else {
        console.log(`✓ Processed`);
      }
    } catch (e: any) {
      console.log(`API not available: ${e.message}`);
    }
    
    // Small delay between messages
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n✅ Demo simulation complete!');
  console.log('\nCheck the dashboard at http://localhost:3000 to see all conversations.');
}

simulate().catch(console.error);
