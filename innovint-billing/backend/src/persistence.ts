import * as fs from 'fs';
import { AppSettings } from './types';
import { CONFIG_PATH } from './config';

// Firestore imports (lazy-loaded)
let firestoreDb: FirebaseFirestore.Firestore | null = null;

function getFirestore(): FirebaseFirestore.Firestore {
  if (!firestoreDb) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require('firebase-admin') as typeof import('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    }
    firestoreDb = admin.firestore();
  }
  return firestoreDb;
}

const FIRESTORE_DOC = 'settings/config';
const useFirestore = process.env.USE_FIRESTORE === 'true';

export function defaultSettings(): AppSettings {
  return {
    token: '',
    wineryId: '',
    rateRules: [],
    lastUsedMonth: 'January',
    lastUsedYear: new Date().getFullYear(),
    barrelSnapshots: { snap1Day: 1, snap2Day: 15, snap3Day: 'last' },
    fruitIntake: null,
    customerMap: {},
    billableAddOns: [],
    qbExportSettings: {
      excludedCustomers: ['ELE'],
      enabledSources: { actions: true, barrel: true, bulk: true, fruitIntake: true, addOns: true },
    },
    qbExportHistory: [],
    fruitIntakeSettings: {
      actionTypeKey: 'FRUITINTAKE',
      vintageLookback: 3,
      apiPageDelaySeconds: 5,
      contractLengthRules: [
        { color: 'red', varietal: '', months: 22 },
        { color: 'white', varietal: 'chardonnay', months: 12 },
        { color: 'white', varietal: '', months: 9 },
        { color: 'rosé', varietal: '', months: 9 },
        { color: 'rose', varietal: '', months: 9 },
        { color: 'orange', varietal: '', months: 9 },
      ],
      rates: [
        { vintage: 2026, contractMonths: 9, ratePerTon: 3100 },
        { vintage: 2026, contractMonths: 12, ratePerTon: 3150 },
        { vintage: 2026, contractMonths: 22, ratePerTon: 4600 },
        { vintage: 2025, contractMonths: 9, ratePerTon: 2950 },
        { vintage: 2025, contractMonths: 12, ratePerTon: 3150 },
        { vintage: 2025, contractMonths: 22, ratePerTon: 4600 },
        { vintage: 2024, contractMonths: 9, ratePerTon: 2800 },
        { vintage: 2024, contractMonths: 12, ratePerTon: 3000 },
        { vintage: 2024, contractMonths: 22, ratePerTon: 4300 },
      ],
    },
  };
}

function mergeWithDefaults(parsed: Record<string, unknown>): AppSettings {
  const defaults = defaultSettings();
  return {
    token: (parsed.token as string) ?? defaults.token,
    wineryId: (parsed.wineryId as string) ?? defaults.wineryId,
    rateRules: Array.isArray(parsed.rateRules) ? parsed.rateRules : defaults.rateRules,
    lastUsedMonth: (parsed.lastUsedMonth as string) ?? defaults.lastUsedMonth,
    lastUsedYear: (parsed.lastUsedYear as number) ?? defaults.lastUsedYear,
    barrelSnapshots: (parsed.barrelSnapshots as AppSettings['barrelSnapshots']) ?? defaults.barrelSnapshots,
    fruitIntake: (parsed.fruitIntake as AppSettings['fruitIntake']) ?? defaults.fruitIntake,
    customerMap: (parsed.customerMap as Record<string, string>) ?? defaults.customerMap,
    fruitIntakeSettings: (parsed.fruitIntakeSettings as AppSettings['fruitIntakeSettings']) ?? defaults.fruitIntakeSettings,
    billableAddOns: Array.isArray(parsed.billableAddOns) ? parsed.billableAddOns : defaults.billableAddOns,
    qbExportSettings: (parsed.qbExportSettings as AppSettings['qbExportSettings']) ?? defaults.qbExportSettings,
    qbExportHistory: Array.isArray(parsed.qbExportHistory) ? parsed.qbExportHistory : defaults.qbExportHistory,
  };
}

// ─── Firestore persistence ───

async function loadFromFirestore(): Promise<AppSettings> {
  const db = getFirestore();
  const doc = await db.doc(FIRESTORE_DOC).get();
  if (doc.exists) {
    return mergeWithDefaults(doc.data() as Record<string, unknown>);
  }
  return defaultSettings();
}

async function saveToFirestore(settings: AppSettings): Promise<void> {
  const db = getFirestore();
  await db.doc(FIRESTORE_DOC).set(JSON.parse(JSON.stringify(settings)));
}

// ─── File persistence ───

async function loadFromFile(): Promise<AppSettings> {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      return mergeWithDefaults(parsed);
    }
  } catch {
    // Ignore parse errors
  }
  return defaultSettings();
}

async function saveToFile(settings: AppSettings): Promise<void> {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

// ─── Public API ───

export async function loadSettings(): Promise<AppSettings> {
  if (useFirestore) {
    return loadFromFirestore();
  }
  return loadFromFile();
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (useFirestore) {
    return saveToFirestore(settings);
  }
  return saveToFile(settings);
}
