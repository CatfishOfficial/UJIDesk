import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { arrivedVia, supabase } from './supabase';
import { useUI } from './ui';

/** Which form the account dialog shows. */
export type AuthMode = 'signIn' | 'signUp' | 'forgot' | 'newPassword';

interface AccountState {
  /** 'off': no Supabase project in this build, so accounts stay hidden. */
  status: 'off' | 'loading' | 'signedOut' | 'signedIn';
  email: string | null;
  userId: string | null;
  /** The account dialog's form, or null while it's closed. */
  dialog: AuthMode | null;
  openDialog: (mode: AuthMode) => void;
  closeDialog: () => void;
}

export const useAccount = create<AccountState>()((set) => ({
  status: supabase ? 'loading' : 'off',
  email: null,
  userId: null,
  dialog: null,
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
}));

export type AuthResult = { ok: true; message?: string } | { ok: false; message: string };

/** Supabase's auth errors in plain words. Codes from supabase-js; anything unknown gets a generic line. */
export function friendlyAuthError(error: { code?: string; status?: number; message?: string; name?: string }): string {
  switch (error.code) {
    case 'invalid_credentials':
      return "That email and password don't match.";
    case 'email_not_confirmed':
      return 'Confirm your email first: there’s a link in the email we sent you.';
    case 'user_already_exists':
    case 'email_exists':
      return 'There’s already an account with that email. Try signing in.';
    case 'weak_password':
      return 'Pick a stronger password: at least 8 characters.';
    case 'same_password':
      return 'That’s your current password. Pick a new one.';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'That doesn’t look like an email address.';
    case 'over_email_send_rate_limit':
      return 'Too many emails just now. Wait a minute and try again.';
    case 'over_request_rate_limit':
      return 'Too many tries. Wait a minute and try again.';
    case 'signup_disabled':
      return 'New accounts aren’t open right now.';
  }
  if (error.status === 429) return 'Too many tries. Wait a minute and try again.';
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) return 'Couldn’t reach the account server. Check your connection and try again.';
  return 'Something went wrong. Try again in a moment.';
}

const fromSession = (session: Session | null) =>
  session ? { status: 'signedIn' as const, email: session.user.email ?? null, userId: session.user.id } : { status: 'signedOut' as const, email: null, userId: null };

let started = false;

/** Picks up a saved session, then follows sign-ins, sign-outs and email links. Call once at startup. */
export function startAccount() {
  if (!supabase || started) return;
  started = true;
  supabase.auth.onAuthStateChange((event, session) => {
    useAccount.setState(fromSession(session));
    // A forgot-password link signs you in for one job: choosing a new password.
    if (event === 'PASSWORD_RECOVERY') useAccount.setState({ dialog: 'newPassword' });
    else if (event === 'SIGNED_IN' && arrivedVia === 'signup') useUI.getState().toast('Email confirmed. You’re signed in.');
  });
}

const site = () => location.origin;

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: site() } });
  if (error) return { ok: false, message: friendlyAuthError(error) };
  // With email confirmation on there's no session until the link is clicked.
  return data.session ? { ok: true } : { ok: true, message: `Almost there: open the link we sent to ${email} to finish making your account.` };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase!.auth.signInWithPassword({ email, password });
  return error ? { ok: false, message: friendlyAuthError(error) } : { ok: true };
}

export async function sendReset(email: string): Promise<AuthResult> {
  const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: site() });
  if (error) return { ok: false, message: friendlyAuthError(error) };
  // Worded the same whether or not the account exists, so the form can't be used to check emails.
  return { ok: true, message: `If there’s an account for ${email}, a link to choose a new password is on its way.` };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const { error } = await supabase!.auth.updateUser({ password });
  return error ? { ok: false, message: friendlyAuthError(error) } : { ok: true };
}

/** Signs out on this device only; other devices stay signed in. */
export async function signOut(): Promise<void> {
  await supabase?.auth.signOut({ scope: 'local' });
  useUI.getState().toast('Signed out.');
}
