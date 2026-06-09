import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // High-performance pool for Bengaluru pilot
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
    console.error('--- SYSTEMATIC DB ERROR: Unexpected error on idle client ---', err);
});

pool.on('connect', () => {
    if (process.env.NODE_ENV === 'development') {
        console.log('--- SYSTEMATIC DB: New client connected to pool ---');
    }
});

export const query = async (text: string, params?: any[]) => {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        try {
            return await pool.query(text, params);
        } catch (error: any) {
            attempts++;
            // Retry only on transient connection errors
            if (attempts < maxAttempts && (error.code === '57P01' || error.code === '08006')) {
                console.warn(`--- SYSTEMATIC DB: Transient error, retrying attempt ${attempts}... ---`);
                await new Promise(res => setTimeout(res, 1000 * attempts));
                continue;
            }
            throw error;
        }
    }
    throw new Error('DB query failed after max retries');
};

export const withTransaction = async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('--- SYSTEMATIC TRANSACTION ROLLBACK ---', error);
        throw error;
    } finally {
        client.release();
    }
};

export default pool;
