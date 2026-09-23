// tests/setup.ts
// Shared test setup - runs once before all tests
import { openDb } from '../src/db/client.ts';
import { migrate } from '../src/db/schema.ts';
import { seedDemoHotel } from '../src/db/seed.ts';
import { listHotels } from '../src/db/repositories.ts';

openDb();
migrate();

// Ensure demo hotel exists (idempotent)
const existing = listHotels();
const demo = existing.find((h) => h.slug === 'demo');
if (!demo) {
  seedDemoHotel();
}
