import * as admin from 'firebase-admin';

const ADMIN_EMAIL = 'michael.szymczak@innovint.us';

async function seedAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }

  const db = admin.firestore();
  const auth = admin.auth();

  let uid: string;
  let isNew = false;

  try {
    const existing = await auth.getUserByEmail(ADMIN_EMAIL);
    uid = existing.uid;
    console.log(`User ${ADMIN_EMAIL} already exists (uid: ${uid})`);
  } catch (err: any) {
    if (err.code === 'auth/user-not-found') {
      const created = await auth.createUser({ email: ADMIN_EMAIL });
      uid = created.uid;
      isNew = true;
      console.log(`Created user ${ADMIN_EMAIL} (uid: ${uid})`);
    } else {
      throw err;
    }
  }

  // Ensure Firestore user doc exists
  const userDoc = await db.doc(`users/${uid}`).get();
  if (!userDoc.exists) {
    await db.doc(`users/${uid}`).set({
      email: ADMIN_EMAIL,
      role: 'admin',
      createdAt: new Date().toISOString(),
      createdBy: 'seed-script',
    });
    console.log(`Created Firestore user doc with role: admin`);
  } else {
    console.log(`Firestore user doc already exists (role: ${userDoc.data()?.role})`);
  }

  // Generate password reset link if newly created
  if (isNew) {
    const resetLink = await auth.generatePasswordResetLink(ADMIN_EMAIL);
    console.log(`\nPassword set link:\n${resetLink}\n`);
  }

  console.log('Done.');
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
