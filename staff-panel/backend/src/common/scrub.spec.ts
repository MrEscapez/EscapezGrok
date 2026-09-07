import { scrubObject, scrubSecrets } from './scrub';

describe('scrubSecrets', () => {
  it('redacts password-like assignments', () => {
    const out = scrubSecrets('login password=supersecret123 ok');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('supersecret123');
  });

  it('redacts API key header values', () => {
    const out = scrubSecrets('X-Escapez-Api-Key: abcdefghijklmnopqrstuvwxyz012345');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('abcdefghijklmnopqrstuvwxyz012345');
  });

  it('scrubObject redacts known secret keys', () => {
    const out = scrubObject({
      username: 'admin',
      password: 'CHANGE_ME',
      apiKey: 'ptero-secret-key-value',
      nested: { token: 'tok_abc' },
    });
    expect(out.username).toBe('admin');
    expect(out.password).toBe('[REDACTED]');
    expect(out.apiKey).toBe('[REDACTED]');
    expect((out.nested as { token: string }).token).toBe('[REDACTED]');
  });
});
