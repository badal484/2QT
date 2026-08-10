export const query = jest.fn();
export const withTransaction = jest.fn(async (cb: (client: any) => Promise<any>) => {
  const client = {
    query: jest.fn(),
    release: jest.fn(),
  };
  try {
    await client.query('BEGIN');
    const result = await cb(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
});
export default { query };
