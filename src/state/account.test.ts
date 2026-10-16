import { describe, expect, it } from 'vitest';
import { friendlyAuthError, useAccount } from './account';

describe('accounts', () => {
  it('stay off in a build with no Supabase project', () => {
    expect(useAccount.getState().status).toBe('off');
  });

  it('put auth errors in plain words', () => {
    expect(friendlyAuthError({ code: 'invalid_credentials' })).toBe("That email and password don't match.");
    expect(friendlyAuthError({ code: 'email_not_confirmed' })).toMatch(/confirm your email/i);
    expect(friendlyAuthError({ code: 'user_already_exists' })).toMatch(/already an account/i);
    expect(friendlyAuthError({ status: 429 })).toMatch(/too many/i);
    expect(friendlyAuthError({ name: 'AuthRetryableFetchError' })).toMatch(/couldn’t reach/i);
    expect(friendlyAuthError({ code: 'something_new', message: 'raw' })).toBe('Something went wrong. Try again in a moment.');
  });
});
