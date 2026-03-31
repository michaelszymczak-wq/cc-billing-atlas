import * as fs from 'fs';
import * as admin from 'firebase-admin';
import { CONFIG_PATH } from './config';

const FIRESTORE_DOC = 'settings/config';

async function migrate() {
  // 1. Read local config file
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`Config file not found: ${CONFIG_PATH}`);
    console.error('Nothing to migrate.');
    process.exit(1);
  }

  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  const parsed = JSON.parse(raw);

  // 2. Strip sensitive fields — user will re-enter token in the UI
  delete parsed.token;

  console.log(`Read config from ${CONFIG_PATH}`);
  console.log(`  rateRules: ${(parsed.rateRules || []).length}`);
  console.log(`  customers: ${(parsed.customers || []).length}`);
  console.log(`  billableAddOns: ${(parsed.billableAddOns || []).length}`);
  console.log(`  bulkStorageRate: ${parsed.bulkStorageRate ?? 'not set'}`);
  console.log(`  fruitIntake records: ${parsed.fruitIntake?.records?.length ?? 0}`);

  // 3. Initialize Firebase Admin
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  const db = admin.firestore();

  // 4. Check if Firestore already has settings
  const existing = await db.doc(FIRESTORE_DOC).get();
  if (existing.exists) {
    const data = existing.data()!;
    const existingRules = (data.rateRules || []).length;
    if (existingRules > 0) {
      console.warn(`\nWarning: Firestore ${FIRESTORE_DOC} already has ${existingRules} rate rules.`);
      console.warn('This will OVERWRITE the existing config. Press Ctrl+C within 5s to abort...');
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  // 5. Write to Firestore (set token to empty string so the field exists)
  const toWrite = { ...parsed, token: '' };
  await db.doc(FIRESTORE_DOC).set(JSON.parse(JSON.stringify(toWrite)));

  console.log(`\nMigrated settings to Firestore (${FIRESTORE_DOC}).`);
  console.log('Remember to re-enter the InnoVint access token in Settings after logging in.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
