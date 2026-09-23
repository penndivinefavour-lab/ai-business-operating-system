import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.ts';
import { closeDb, openDb } from '../db/client.ts';
import { seedDemoHotel, isDemoHotelSeeded } from '../db/seed.ts';

openDb();
if (!isDemoHotelSeeded()) {
  seedDemoHotel();
  console.log('[seed] demo hotel created');
}
closeDb();

try {
  rmSync(join(config.dataDir, 'frontdesk.db'), { force: true });
  rmSync(join(config.dataDir, 'frontdesk.db-wal'), { force: true });
  rmSync(join(config.dataDir, 'frontdesk.db-shm'), { force: true });
} catch {
  // ignore
}

openDb();
const hotelId = seedDemoHotel();
console.log(`[seed:reset] re-seeded demo hotel #${hotelId}`);
closeDb();