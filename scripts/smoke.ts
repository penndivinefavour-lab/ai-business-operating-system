import { seedDemoHotel } from '../src/db/seed.ts';
import { closeDb } from '../src/db/client.ts';
import { processMessage } from '../src/core/orchestrator.ts';
import { DEMO_PHONES } from '../src/db/seed.ts';

const hotelId = seedDemoHotel();

const msgs = [
  'Bonjour',
  'Do you have a room for friday?',
  'How much is the executive room?',
  'I want to book for two nights starting friday',
  'yes',
  'Where are you located?',
  'Can I check in early?',
  'I had a problem with my room, the air conditioning is not working',
  'I want to speak to someone',
];

for (const text of msgs) {
  const r = await processMessage({
    hotelId,
    channel: 'smoke',
    text,
    contact: { phone: DEMO_PHONES.marie, name: 'Marie Fotso' },
    conversationId: 1,
  });
  console.log(`\n[guest] ${text}`);
  console.log(`[ai | ${r.intent} | ${r.provider} | changed=${r.changed}] ${r.reply}`);
  console.log(`tools used: ${r.actions.map((a) => `${a.tool}(${a.ok ? 'ok' : 'FAIL:' + a.error})`).join(', ') || '(none)'}`);
}

closeDb();
console.log('\nSMOKE OK');