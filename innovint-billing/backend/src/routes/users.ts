import { Router, Request, Response } from 'express';
import { authenticate, requireRole, clearRoleCache } from '../middleware/auth';
import { UserRole, UserRecord } from '../types';

const router = Router();

// Lazy firebase-admin init
let adminInstance: typeof import('firebase-admin') | null = null;

function getAdmin(): typeof import('firebase-admin') {
  if (!adminInstance) {
    adminInstance = require('firebase-admin') as typeof import('firebase-admin');
    if (!adminInstance.apps.length) {
      adminInstance.initializeApp({ credential: adminInstance.credential.applicationDefault() });
    }
  }
  return adminInstance;
}

// GET /api/users/me — return current user info
router.get('/me', authenticate, async (req: Request, res: Response) => {
  res.json(req.user);
});

// GET /api/users — list all users (admin only)
router.get('/', authenticate, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const admin = getAdmin();
    const db = admin.firestore();
    const snapshot = await db.collection('users').get();
    const users: UserRecord[] = snapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    })) as UserRecord[];
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// POST /api/users — create a new user (admin only)
router.post('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const { email, role } = req.body as { email: string; role: UserRole };
  if (!email || !role) {
    res.status(400).json({ error: 'email and role are required' });
    return;
  }
  if (!['admin', 'team_member', 'cellar'].includes(role)) {
    res.status(400).json({ error: 'Invalid role' });
    return;
  }

  try {
    const admin = getAdmin();

    // Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({ email });

    // Store role in Firestore
    const db = admin.firestore();
    const userDoc: Omit<UserRecord, 'uid'> = {
      email,
      role,
      createdAt: new Date().toISOString(),
      createdBy: req.user!.uid,
    };
    await db.doc(`users/${userRecord.uid}`).set(userDoc);

    // Generate password reset link (used as welcome link)
    const resetLink = await admin.auth().generatePasswordResetLink(email);

    res.json({ uid: userRecord.uid, email, role, resetLink });
  } catch (err: any) {
    if (err.code === 'auth/email-already-exists') {
      res.status(409).json({ error: 'A user with this email already exists' });
    } else {
      res.status(500).json({ error: err.message || 'Failed to create user' });
    }
  }
});

// PUT /api/users/:uid/role — update user role (admin only)
router.put('/:uid/role', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const { uid } = req.params;
  const { role } = req.body as { role: UserRole };

  if (!role || !['admin', 'team_member', 'cellar'].includes(role)) {
    res.status(400).json({ error: 'Valid role is required' });
    return;
  }

  // Prevent self-demotion
  if (uid === req.user!.uid && role !== 'admin') {
    res.status(400).json({ error: 'Cannot change your own role' });
    return;
  }

  try {
    const admin = getAdmin();
    const db = admin.firestore();
    await db.doc(`users/${uid}`).update({ role });
    clearRoleCache(uid);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// DELETE /api/users/:uid — delete a user (admin only)
router.delete('/:uid', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const { uid } = req.params;

  // Prevent self-deletion
  if (uid === req.user!.uid) {
    res.status(400).json({ error: 'Cannot delete your own account' });
    return;
  }

  try {
    const admin = getAdmin();
    const db = admin.firestore();

    await admin.auth().deleteUser(uid);
    await db.doc(`users/${uid}`).delete();
    clearRoleCache(uid);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// POST /api/users/:uid/reset-link — regenerate password reset link (admin only)
router.post('/:uid/reset-link', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const { uid } = req.params;

  try {
    const admin = getAdmin();
    const userRecord = await admin.auth().getUser(uid);
    const resetLink = await admin.auth().generatePasswordResetLink(userRecord.email!);
    res.json({ resetLink });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate reset link' });
  }
});

export default router;
