// src/config/jwt.ts
/**
 * Simple JWT helper for our own session tokens.
 * Uses HS256 with a secret stored in env variable `JWT_SECRET`.
 */
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET ?? 'change_this_secret';

export interface SessionPayload {
  _id: string; // MongoDB user ID
  phone: string;
  role: 'buyer' | 'kitchen' | 'rider' | 'admin';
}

export const signSessionToken = (payload: SessionPayload, expiresIn = '7d'): string => {
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn });
};

export const verifySessionToken = (token: string): SessionPayload => {
  return jwt.verify(token, JWT_SECRET) as SessionPayload;
};
