import rateLimit from 'express-rate-limit';

const createLimiter = (windowMs: number, max: number, message: string) => {
    if (process.env.NODE_ENV === 'development') {
        return (req: any, res: any, next: any) => next();
    }
    return rateLimit({
        windowMs,
        max,
        message: { error: 'TOO_MANY_REQUESTS', message },
        standardHeaders: true,
        legacyHeaders: false,
        validate: { default: false },
    });
};

export const generalLimiter = createLimiter(60 * 1000, 1000, 'Too many requests, please try again later.');
export const otpLimiter = createLimiter(10 * 60 * 1000, 20, 'Too many OTP requests, please try again in 10 minutes.');
export const paymentLimiter = createLimiter(60 * 1000, 50, 'Too many payment attempts.');
export const gpsLimiter = createLimiter(60 * 1000, 120, 'GPS update limit exceeded.');
export const broadcastLimiter = createLimiter(24 * 60 * 60 * 1000, 5, 'Broadcast limit reached for today.');
