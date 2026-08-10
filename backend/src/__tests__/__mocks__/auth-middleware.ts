import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    kitchenId: string | null;
    zoneId: string | null;
    restaurantId: string | null;
    jti: string;
  };
}

// Default: passes as customer. Override per-test via mockAuthenticate.mockImplementation(...)
export const authenticate = jest.fn((req: AuthRequest, _res: Response, next: NextFunction) => {
  req.user = { userId: 'user-test-1', role: 'customer', kitchenId: null, zoneId: 'zone-1', restaurantId: null, jti: 'jti-test' };
  next();
});

export const requireRole = jest.fn((..._roles: string[]) =>
  (_req: Request, _res: Response, next: NextFunction) => next()
);

export const invalidateUserCache = jest.fn();
