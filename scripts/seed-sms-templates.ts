import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env before importing services that initialize firebase
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { seedSMSTemplates } from '../src/services/sendMessageService';

async function main() {
  console.log('Seeding SMS templates...');
  try {
    const result = await seedSMSTemplates('default', 'system-seeder');
    console.log(`Success! Seeded: ${result.count}, Skipped: ${result.skipped}`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed templates:', err);
    process.exit(1);
  }
}

main();
