// Tests for the DB layer logic without importing the actual pg Pool
// We extract and unit-test the retry logic and transaction wrapper behaviour

describe('DB withTransaction', () => {
  function makeClient() {
    return {
      query: jest.fn(),
      release: jest.fn(),
    };
  }

  async function withTransaction<T>(client: ReturnType<typeof makeClient>, callback: (c: typeof client) => Promise<T>): Promise<T> {
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  it('commits when callback succeeds', async () => {
    const client = makeClient();
    client.query.mockResolvedValue({ rows: [] });

    const result = await withTransaction(client, async (c) => {
      await c.query('UPDATE orders SET status = $1 WHERE id = $2', ['confirmed', 'order-1']);
      return 'ok';
    });

    expect(result).toBe('ok');
    const calls = client.query.mock.calls.map((c: any[]) => c[0]);
    expect(calls[0]).toBe('BEGIN');
    expect(calls).toContain('COMMIT');
    expect(calls).not.toContain('ROLLBACK');
  });

  it('rolls back when callback throws', async () => {
    const client = makeClient();
    client.query.mockResolvedValue({ rows: [] });

    await expect(
      withTransaction(client, async () => {
        throw new Error('ITEM_SOLD_OUT');
      })
    ).rejects.toThrow('ITEM_SOLD_OUT');

    const calls = client.query.mock.calls.map((c: any[]) => c[0]);
    expect(calls[0]).toBe('BEGIN');
    expect(calls).toContain('ROLLBACK');
    expect(calls).not.toContain('COMMIT');
  });

  it('always releases client even after error', async () => {
    const client = makeClient();
    client.query.mockResolvedValue({ rows: [] });

    await expect(
      withTransaction(client, async () => { throw new Error('DB_FAIL'); })
    ).rejects.toThrow();

    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('always releases client on success', async () => {
    const client = makeClient();
    client.query.mockResolvedValue({ rows: [] });

    await withTransaction(client, async () => 'done');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('re-throws the original error after rollback', async () => {
    const client = makeClient();
    client.query.mockResolvedValue({ rows: [] });

    const error = new Error('PROMO_USAGE_LIMIT_REACHED');
    await expect(
      withTransaction(client, async () => { throw error; })
    ).rejects.toBe(error);
  });
});

describe('DB query retry logic', () => {
  // Extracted retry logic that mirrors db/index.ts
  async function queryWithRetry(executeQuery: () => Promise<any>, maxAttempts = 3): Promise<any> {
    let attempts = 0;
    while (attempts < maxAttempts) {
      try {
        return await executeQuery();
      } catch (error: any) {
        attempts++;
        const isTransient =
          error.code === '57P01' || // admin_shutdown
          error.code === '08006' || // connection_failure
          error.message?.includes('timeout') ||
          error.message?.includes('Connection terminated');

        if (attempts < maxAttempts && isTransient) {
          await new Promise(res => setTimeout(res, 10)); // short delay in tests
          continue;
        }
        throw error;
      }
    }
    throw new Error('DB query failed after max retries');
  }

  it('returns result on first successful attempt', async () => {
    const mockFn = jest.fn().mockResolvedValue({ rows: [{ id: 1 }] });
    const result = await queryWithRetry(mockFn);
    expect(result).toEqual({ rows: [{ id: 1 }] });
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('retries on 57P01 (admin_shutdown) and succeeds on second attempt', async () => {
    const transientError: any = new Error('admin shutdown');
    transientError.code = '57P01';
    const mockFn = jest.fn()
      .mockRejectedValueOnce(transientError)
      .mockResolvedValue({ rows: [] });

    const result = await queryWithRetry(mockFn);
    expect(result).toEqual({ rows: [] });
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('retries on 08006 (connection_failure) up to max attempts', async () => {
    const connError: any = new Error('connection failure');
    connError.code = '08006';
    const mockFn = jest.fn().mockRejectedValue(connError);

    await expect(queryWithRetry(mockFn)).rejects.toThrow('connection failure');
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('retries on timeout message', async () => {
    const timeoutError = new Error('query timeout exceeded');
    const mockFn = jest.fn()
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValue({ rows: [{ ok: true }] });

    const result = await queryWithRetry(mockFn);
    expect(result.rows[0].ok).toBe(true);
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on non-transient errors (e.g. syntax error)', async () => {
    const syntaxError: any = new Error('syntax error at or near "SLECT"');
    syntaxError.code = '42601';
    const mockFn = jest.fn().mockRejectedValue(syntaxError);

    await expect(queryWithRetry(mockFn)).rejects.toThrow('syntax error');
    expect(mockFn).toHaveBeenCalledTimes(1); // no retry
  });

  it('does NOT retry on unique constraint violations', async () => {
    const uniqueError: any = new Error('duplicate key value violates unique constraint');
    uniqueError.code = '23505';
    const mockFn = jest.fn().mockRejectedValue(uniqueError);

    await expect(queryWithRetry(mockFn)).rejects.toThrow('duplicate key');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('retries on Connection terminated message', async () => {
    const termError = new Error('Connection terminated unexpectedly');
    const mockFn = jest.fn()
      .mockRejectedValueOnce(termError)
      .mockRejectedValueOnce(termError)
      .mockResolvedValue({ rows: [{ value: 42 }] });

    const result = await queryWithRetry(mockFn);
    expect(result.rows[0].value).toBe(42);
    expect(mockFn).toHaveBeenCalledTimes(3);
  });
});
