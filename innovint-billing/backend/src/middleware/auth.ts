import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';

// Lazy firebase-admin init (same pattern as persistence.ts)
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

// 5-minute in-memory role cache
const roleCache = new Map<string, { role: UserRole; email: string; cachedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export function clearRoleCache(uid?: string): void {
  if (uid) {
    roleCache.delete(uid);
  } else {
    roleCache.clear();
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const admin = getAdmin();
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;

    // Check cache first
    const cached = roleCache.get(uid);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      req.user = { uid, email: cached.email, role: cached.role };
      next();
      return;
    }

    // Look up role from Firestore
    const db = admin.firestore();
    const userDoc = await db.doc(`users/${uid}`).get();
    if (!userDoc.exists) {
      res.status(403).json({ error: 'User not registered in system' });
      return;
    }

    const userData = userDoc.data()!;
    const role = userData.role as UserRole;
    const email = decoded.email || userData.email || '';

    // Cache the result
    roleCache.set(uid, { role, email, cachedAt: Date.now() });

    req.user = { uid, email, role };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
