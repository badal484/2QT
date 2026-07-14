// src/middleware/firebaseAuth.ts
import { Request, Response, NextFunction } from 'express';
import { firebaseAdmin } from '../config/firebaseAdmin';
import { ObjectId } from 'mongodb';
import { db } from '../db'; // assume this exports a connected MongoDB instance

/**
 * Express middleware that validates a Firebase ID token sent in the
 * `Authorization` header as `Bearer <token>`.
 *
 * On success it attaches `req.firebaseUser` containing the decoded
 * token (including `uid` and `phone_number`).
 */
export interface FirebaseUser {
  uid: string;
  phone_number?: string;
  email?: string;
  [key: string]: any;
}

export const verifyFirebaseToken = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return _res.status(401).json({ error: 'Missing Authorization header' });
  }

  const idToken = authHeader.split(' ')[1];
  try {
    const decoded = (await firebaseAdmin.auth().verifyIdToken(idToken)) as FirebaseUser;
    // Attach to request for downstream handlers
    (req as any).firebaseUser = decoded;
    next();
  } catch (err) {
    console.error('Firebase token verification error:', err);
    return _res.status(401).json({ error: 'Invalid Firebase ID token' });
  }
};
