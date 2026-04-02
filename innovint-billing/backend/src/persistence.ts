import * as fs from 'fs';
import { AppSettings, CustomerRecord, SessionData } from './types';
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
    barrelSnapshots: { snap1Day: 1, snap2Day: 15, snap3Day: 'last', barrelRate: 0, puncheonRate: 0, tirageRate: 0 },
    bulkStorageRate: 0,
    bulkStorageMinimum: 0,
    fruitIntake: null,
    customers: [],
    billableAddOns: [],
    fruitIntakeSettings: {
      actionTypeKey: 'FRUITINTAKE',
      vintageLookback: 3,
      apiPageDelaySeconds: 5,
      programs: [
        { id: 'prog_1', name: 'Program #1', description: 'Red Wine', ratePerTon: 2300 },
        { id: 'prog_2', name: 'Program #2', description: 'White Wine', ratePerTon: 2200 },
        { id: 'prog_3', name: 'Program #3', description: 'Rose/White in Tank', ratePerTon: 2000 },
        { id: 'prog_4', name: 'Program #4', description: 'Sparkling Rose/White', ratePerTon: 2200 },
        { id: 'prog_5', name: 'Program #5', description: 'Sparkling Wine Crush & Go 14 Days', ratePerTon: 2000 },
        { id: 'prog_6', name: 'Program #6', description: 'Red Wine', ratePerTon: 1590 },
        { id: 'prog_7', name: 'Program #7', description: 'White Wine', ratePerTon: 1520 },
        { id: 'prog_8', name: 'Program #8', description: 'Rose/White aged in tank', ratePerTon: 1470 },
        { id: 'prog_1ai', name: 'Program #1 AI', description: 'Red Wine All-Inclusive', ratePerTon: 2400 },
        { id: 'prog_2ai', name: 'Program #2 AI', description: 'White Wine All-Inclusive', ratePerTon: 2328 },
        { id: 'prog_3ai', name: 'Program #3 AI', description: 'Rose/White in Tank All-Inclusive', ratePerTon: 2256 },
      ],
      minProcessingFee: 1000,
      defaultContractMonths: 9,
      smallLotFee: 1000,
      smallLotThresholdTons: 2.0,
    },
  };
}

function migrateLegacyCustomerMaps(parsed: Record<string, unknown>): CustomerRecord[] {
  const customerMap = (parsed.customerMap as Record<string, string>) || {};
  const qbCustomerMap = (parsed.qbCustomerMap as Record<string, string>) || {};

  // Build records from customerMap (ownerName → code)
  const byCode = new Map<string, CustomerRecord>();
  for (const [ownerName, code] of Object.entries(customerMap)) {
    if (!ownerName || !code) continue;
    byCode.set(code, {
      ownerName,
      code,
      displayName: qbCustomerMap[code] || '',
      address: '',
      phone: '',
      email: '',
    });
  }

  // Add any qbCustomerMap entries that don't have a customerMap entry
  for (const [code, displayName] of Object.entries(qbCustomerMap)) {
    if (!byCode.has(code)) {
      byCode.set(code, {
        ownerName: '',
        code,
        displayName,
        address: '',
        phone: '',
        email: '',
      });
    }
  }

  return [...byCode.values()];
}

function mergeWithDefaults(parsed: Record<string, unknown>): AppSettings {
  const defaults = defaultSettings();

  // Migrate legacy customerMap + qbCustomerMap → customers[]
  let customers: CustomerRecord[];
  if (Array.isArray(parsed.customers)) {
    customers = parsed.customers;
  } else if (parsed.customerMap || parsed.qbCustomerMap) {
    customers = migrateLegacyCustomerMaps(parsed);
  } else {
    customers = defaults.customers;
  }

  return {
    token: (parsed.token as string) ?? defaults.token,
    wineryId: (parsed.wineryId as string) ?? defaults.wineryId,
    rateRules: Array.isArray(parsed.rateRules) ? parsed.rateRules : defaults.rateRules,
    lastUsedMonth: (parsed.lastUsedMonth as string) ?? defaults.lastUsedMonth,
    lastUsedYear: (parsed.lastUsedYear as number) ?? defaults.lastUsedYear,
    barrelSnapshots: parsed.barrelSnapshots
      ? { ...defaults.barrelSnapshots, ...(parsed.barrelSnapshots as Partial<AppSettings['barrelSnapshots']>) }
      : defaults.barrelSnapshots,
    bulkStorageRate: (parsed.bulkStorageRate as number) ?? defaults.bulkStorageRate,
    bulkStorageMinimum: (parsed.bulkStorageMinimum as number) ?? defaults.bulkStorageMinimum,
    fruitIntake: (parsed.fruitIntake as AppSettings['fruitIntake']) ?? defaults.fruitIntake,
    customers,
    fruitIntakeSettings: parsed.fruitIntakeSettings
      ? {
          ...defaults.fruitIntakeSettings,
          ...(parsed.fruitIntakeSettings as Partial<AppSettings['fruitIntakeSettings']>),
        }
      : defaults.fruitIntakeSettings,
    billableAddOns: Array.isArray(parsed.billableAddOns) ? parsed.billableAddOns : defaults.billableAddOns,
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

// ─── Session persistence (Firestore only, no file fallback) ───

export async function saveSessionResult(sessionId: string, data: SessionData): Promise<void> {
  if (!useFirestore) return;
  const db = getFirestore();
  await db.doc(`sessions/${sessionId}`).set(JSON.parse(JSON.stringify(data)));
}

export async function loadSessionResult(sessionId: string): Promise<SessionData | null> {
  if (!useFirestore) return null;
  const db = getFirestore();
  const doc = await db.doc(`sessions/${sessionId}`).get();
  if (doc.exists) {
    return doc.data() as SessionData;
  }
  return null;
}
