import { pathToFileURL } from 'node:url';
import { processMessage } from '../core/orchestrator.ts';

/**
 * Offline demo simulator.
 *
 * Replays the canonical guest conversations against the orchestrator using the
 * seeded demo hotel, no LLM, no network. Used by:
 *   - npm run demo          → full transcript printed to stdout
 *   - POST /api/demo/run    → transcript as JSON (dashboard "Demo" page)
 */

export interface DemoScenario {
  id: string;
  name: string;
  language: 'fr' | 'en';
  contact: { phone: string; name: string };
  turns: string[];
}

export const SCENARIOS: DemoScenario[] = [
  {
    id: 'availability',
    name: 'Disponibilité & tarifs',
    language: 'en',
    contact: { phone: '+237677123456', name: 'Aicha' },
    turns: [
      'Do you have a room for friday?',
      'What about a suite?',
    ],
  },
  {
    id: 'price',
    name: 'Demande de prix',
    language: 'en',
    contact: { phone: '+237699888777', name: 'Jean' },
    turns: [
      'How much is the executive room?',
    ],
  },
  {
    id: 'booking',
    name: 'Réservation complète (réserver → confirmer)',
    language: 'en',
    contact: { phone: '+237655112233', name: 'Marie' },
    turns: [
      'I want to book for two nights starting friday',
      'yes',
    ],
  },
  {
    id: 'checkin_policy',
    name: 'Early check-in',
    language: 'en',
    contact: { phone: '+237690445566', name: 'David' },
    turns: [
      'Can I check in early?',
      'Thank you',
    ],
  },
  {
    id: 'location',
    name: 'Localisation',
    language: 'fr',
    contact: { phone: '+237671000111', name: 'Sonia' },
    turns: [
      'Bonjour, où êtes-vous situés ?',
    ],
  },
  {
    id: 'feedback',
    name: 'Plainte / avis',
    language: 'en',
    contact: { phone: '+237677123456', name: 'Aicha' },
    turns: [
      'I had a problem with my room, the air conditioning is not working',
    ],
  },
  {
    id: 'escalation',
    name: 'Demande d’un humain',
    language: 'en',
    contact: { phone: '+237699888777', name: 'Jean' },
    turns: [
      'I want to speak to someone',
    ],
  },
  {
    id: 'lead_capture',
    name: 'Devis groupe / entreprise',
    language: 'en',
    contact: { phone: '+237655112233', name: 'Nadia' },
    turns: [
      'Hello, I would like a quote for 12 people for our company seminar next month',
    ],
  },
];

export interface TranscriptStep {
  scenario: string;
  conversationId: number;
  turn: number;
  guest: string;
  reply: string;
  intent: string;
  changed: boolean;
  tools: string[];
}

export interface ScenarioTranscript {
  id: string;
  name: string;
  steps: TranscriptStep[];
}

export function scenarioIds(): string[] {
  return SCENARIOS.map((s) => s.id);
}

/** Run a single scenario ("all" runs every scenario in its own conversation). */
export async function runScenario(hotelId: number, id: string, language?: 'fr' | 'en'): Promise<ScenarioTranscript[]> {
  const targets = id === 'all' ? SCENARIOS : SCENARIOS.filter((s) => s.id === id);
  const transcripts: ScenarioTranscript[] = [];

  for (const scenario of targets) {
    const steps: TranscriptStep[] = [];
    let conversationId: number | undefined;
    for (let i = 0; i < scenario.turns.length; i += 1) {
      const result = await processMessage({
        hotelId,
        conversationId,
        channel: 'demo',
        text: scenario.turns[i]!,
        contact: scenario.contact,
      });
      conversationId = result.conversationId;
      steps.push({
        scenario: scenario.id,
        conversationId: result.conversationId,
        turn: i + 1,
        guest: scenario.turns[i]!,
        reply: result.reply,
        intent: result.intent,
        changed: result.changed,
        tools: result.actions.filter((a) => a.ok).map((a) => a.tool),
      });
    }
    transcripts.push({ id: scenario.id, name: scenario.name, steps });
  }
  return transcripts;
}

/** Render transcripts as human-readable text (for `npm run demo`). */
export function makeTranscript(transcripts: ScenarioTranscript[]): string {
  const lines: string[] = [];
  lines.push('AI DIGITAL FRONT DESK — DEMO TRANSCRIPT (offline, no LLM)');
  lines.push('');
  for (const t of transcripts) {
    lines.push(`── ${t.name} (${t.id}) ───────────────────────────────`);
    for (const s of t.steps) {
      lines.push('');
      lines.push(`[guest] ${s.guest}`);
      lines.push(`[ai | ${s.intent} | changed=${s.changed}] ${s.reply}`);
      lines.push(`tools: ${s.tools.length ? s.tools.join(', ') : '(none)'}`);
    }
    lines.push('');
  }
  lines.push('DEMO COMPLETE');
  return lines.join('\n');
}

// Direct-run entry point (`npm run demo`): seeds if needed, replays every
// scenario against the demo hotel and prints the transcript.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { openDb, closeDb } = await import('../db/client.ts');
  const { migrate } = await import('../db/schema.ts');
  const { seedDemoHotel } = await import('../db/seed.ts');
  const { getHotelBySlug } = await import('../db/repositories.ts');

  openDb();
  migrate();
  if (!getHotelBySlug('demo')) seedDemoHotel();
  const hotel = getHotelBySlug('demo')!;
  const transcripts = await runScenario(hotel.id, 'all');
  console.log(makeTranscript(transcripts));
  closeDb();
}