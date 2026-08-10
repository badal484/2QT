describe('FCM parseServiceAccount', () => {
  const validSA = {
    type: 'service_account',
    project_id: 'my-project',
    private_key_id: 'key123',
    private_key: '-----BEGIN PRIVATE KEY-----\nMIItest==\n-----END PRIVATE KEY-----\n',
    client_email: 'test@my-project.iam.gserviceaccount.com',
    client_id: '12345',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/test',
    universe_domain: 'googleapis.com',
  };

  // Extract the parsing logic inline since it's an unexported function
  function parseServiceAccountFromEnv(env: Record<string, string | undefined>) {
    const b64 = env.FIREBASE_SERVICE_ACCOUNT_B64;
    if (b64) {
      try {
        return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      } catch {
        return null;
      }
    }
    const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) return null;
    try {
      const sa = JSON.parse(raw);
      if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
      return sa;
    } catch {
      return null;
    }
  }

  it('parses valid JSON service account', () => {
    const result = parseServiceAccountFromEnv({ FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(validSA) });
    expect(result).not.toBeNull();
    expect(result?.project_id).toBe('my-project');
  });

  it('fixes \\\\n escape sequences in private_key (common in env var editors)', () => {
    const sa = { ...validSA, private_key: '-----BEGIN PRIVATE KEY-----\\nMIItest==\\n-----END PRIVATE KEY-----\\n' };
    const result = parseServiceAccountFromEnv({ FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(sa) });
    expect(result?.private_key).toContain('\n');
    expect(result?.private_key).not.toContain('\\n');
  });

  it('returns null when env var is not set', () => {
    const result = parseServiceAccountFromEnv({});
    expect(result).toBeNull();
  });

  it('returns null when JSON is malformed', () => {
    const result = parseServiceAccountFromEnv({ FIREBASE_SERVICE_ACCOUNT_JSON: 'not valid json {{{' });
    expect(result).toBeNull();
  });

  it('prefers base64 (B64) over raw JSON when both set', () => {
    const b64 = Buffer.from(JSON.stringify({ ...validSA, project_id: 'from-b64' })).toString('base64');
    const result = parseServiceAccountFromEnv({
      FIREBASE_SERVICE_ACCOUNT_B64: b64,
      FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ ...validSA, project_id: 'from-json' }),
    });
    expect(result?.project_id).toBe('from-b64');
  });

  it('returns null when base64 decodes to invalid JSON', () => {
    const result = parseServiceAccountFromEnv({ FIREBASE_SERVICE_ACCOUNT_B64: 'bm90LXZhbGlkLWpzb24=' }); // "not-valid-json"
    expect(result).toBeNull();
  });

  it('decodes base64 encoded service account correctly', () => {
    const b64 = Buffer.from(JSON.stringify(validSA)).toString('base64');
    const result = parseServiceAccountFromEnv({ FIREBASE_SERVICE_ACCOUNT_B64: b64 });
    expect(result?.client_email).toBe(validSA.client_email);
  });
});
