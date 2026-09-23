// src/demo/run-demo.ts
import { createDatabaseClient } from '../adapters/database/index.js';
import { createAiAdapter } from '../adapters/ai/AiAdapter.js';
import { createMockWhatsAppAdapter } from '../adapters/whatsapp/WhatsAppAdapter.js';
import { Orchestrator } from '../orchestrator/Orchestrator.js';
import type { IncomingMessage } from '../types/index.js';

const TENANT_ID = 'xon49wv0gardewq';
const SCENARIOS = [
  { phone: '+237 690 111 111', message: 'Do you have a room for Friday?', expectedIntent: 'check_availability' },
  { phone: '+237 690 222 222', message: 'How much is the executive room?', expectedIntent: 'get_price' },
  { phone: '+237 690 333 333', message: 'I want to book for two nights', expectedIntent: 'booking_request' },
  { phone: '+237 690 444 444', message: 'Can I check in early?', expectedIntent: 'policy_question' },
  { phone: '+237 690 555 555', message: 'Where are you located?', expectedIntent: 'location_question' },
  { phone: '+237 690 666 666', message: 'I had a problem with my room', expectedIntent: 'feedback_complaint' },
  { phone: '+237 690 777 777', message: 'I want to speak to someone', expectedIntent: 'human_escalation' },
  { phone: '+237 690 888 888', message: 'Do you allow pets?', expectedIntent: 'policy_question' },
];

async function runDemo() {
  const db = createDatabaseClient('http://localhost:8090');
  await db.authenticate('admin@hotel.com', 'admin123456');
  
  const ai = createAiAdapter('mock');
  const whatsapp = createMockWhatsAppAdapter();
  const orchestrator = new Orchestrator(db, ai, whatsapp);

  console.log('🧪 AI Digital Front Desk - Demo Mode\n');
  console.log('═══════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < SCENARIOS.length; i++) {
    const s = SCENARIOS[i];
    console.log(`\n── Scenario ${i + 1} ──────────────────────────────────`);
    console.log(`  Customer: "${s.message}"`);
    
    try {
      const msg: IncomingMessage = {
        id: `msg-demo-${i}`,
        tenant_id: TENANT_ID,
        customer_phone: s.phone,
        content: s.message,
        channel: 'whatsapp',
        timestamp: new Date().toISOString(),
      };

      await orchestrator.handleMessage(msg);
      
      // Verify message was stored
      const messages = await db.list('messages', `tenant_id="${TENANT_ID}" && conversation_id!=""`);
      const conversationMessages = messages.items.filter(
        (m: any) => m.direction === 'out'
      );
      
      if (conversationMessages.length > 0) {
        const lastReply = conversationMessages[conversationMessages.length - 1] as any;
        console.log(`  AI Response: "${lastReply.content?.substring(0, 100)}..."`);
        console.log(`  ✓ PASSED`);
        passed++;
      } else {
        console.log(`  ✗ FAILED - No AI response stored`);
        failed++;
      }
    } catch (e: any) {
      console.log(`  ✗ ERROR: ${e.message}`);
      failed++;
    }
  }

  // Final summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`\n📊 Demo Results: ${passed} passed, ${failed} failed`);
  
  const conversations = await db.list('conversations', `tenant_id="${TENANT_ID}"`);
  const allMessages = await db.list('messages', `tenant_id="${TENANT_ID}"`);
  const escalations = await db.list('escalations', `tenant_id="${TENANT_ID}"`);
  
  console.log(`\n📈 Data Summary:`);
  console.log(`  Conversations: ${conversations.totalItems}`);
  console.log(`  Messages: ${allMessages.totalItems}`);
  console.log(`  Escalations: ${escalations.totalItems}`);
  
  if (failed === 0) {
    console.log('\n✅ All scenarios completed successfully!');
  } else {
    console.log(`\n⚠️  ${failed} scenario(s) had issues.`);
  }
}

runDemo().catch(console.error);
