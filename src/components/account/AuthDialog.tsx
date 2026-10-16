import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import { sendReset, signIn, signUp, updatePassword, useAccount, type AuthMode, type AuthResult } from '../../state/account';
import { useUI } from '../../state/ui';

const TITLE: Record<AuthMode, string> = {
  signIn: 'Sign in',
  signUp: 'Create an account',
  forgot: 'Reset your password',
  newPassword: 'Choose a new password',
};

const MIN_PASSWORD = 8;
const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** The account dialog: sign in, create an account, ask for a reset link, or set a new password. */
export function AuthDialog() {
  const mode = useAccount((s) => s.dialog);
  // Keyed by mode so switching forms starts each one fresh.
  return mode ? <AuthForm key={mode} mode={mode} /> : null;
}

function AuthForm({ mode }: { mode: AuthMode }) {
  const close = useAccount((s) => s.closeDialog);
  const open = useAccount((s) => s.openDialog);
  const signedInAs = useAccount((s) => s.email);
  const toast = useUI((s) => s.toast);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [oldEnough, setOldEnough] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Shown in place of the form once it's done something that needs an email clicked. */
  const [done, setDone] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  useEffect(() => firstRef.current?.focus(), []);

  const needsEmail = mode !== 'newPassword';
  const needsPassword = mode !== 'forgot';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const em = email.trim();
    if (needsEmail && !looksLikeEmail(em)) return setError('That doesn’t look like an email address.');
    if (needsPassword && mode !== 'signIn' && password.length < MIN_PASSWORD) return setError(`Pick a password with at least ${MIN_PASSWORD} characters.`);
    if (needsPassword && !password) return setError('Type your password.');
    if (mode === 'signUp' && !oldEnough) return setError('UJI accounts are for students 13 and older.');
    setBusy(true);
    setError(null);
    let result: AuthResult;
    try {
      result =
        mode === 'signIn' ? await signIn(em, password) : mode === 'signUp' ? await signUp(em, password) : mode === 'forgot' ? await sendReset(em) : await updatePassword(password);
    } catch {
      result = { ok: false, message: 'Couldn’t reach the account server. Check your connection and try again.' };
    }
    setBusy(false);
    if (!result.ok) return setError(result.message);
    if (result.message) return setDone(result.message);
    close();
    toast(mode === 'newPassword' ? 'Password changed.' : 'Signed in.');
  };

  return (
    <div className="auth-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <form className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title" onSubmit={submit} onKeyDown={(e) => e.key === 'Escape' && close()} noValidate>
        <header className="auth-head">
          <h2 id="auth-title">{TITLE[mode]}</h2>
          <button type="button" className="btn btn-quiet btn-sm btn-icon" onClick={close} aria-label="Close">
            <X size={15} />
          </button>
        </header>

        {done ? (
          <>
            <p className="auth-done">{done}</p>
            <div className="auth-row">
              <button type="button" className="btn btn-primary" onClick={close}>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted small">
              {mode === 'signIn' || mode === 'signUp'
                ? 'Back up your tokens, fish, stickers and desks, and pick up where you left off on any device.'
                : mode === 'forgot'
                  ? 'We’ll email you a link to choose a new password.'
                  : signedInAs
                    ? `For ${signedInAs}.`
                    : 'Pick something you haven’t used before.'}
            </p>

            {needsEmail && (
              <label className="auth-field">
                <span className="field-label">Email</span>
                <input ref={firstRef} className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
              </label>
            )}
            {needsPassword && (
              <label className="auth-field">
                <span className="field-label">{mode === 'newPassword' ? 'New password' : 'Password'}</span>
                <span className="auth-password">
                  <input
                    ref={needsEmail ? undefined : firstRef}
                    className="field"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                    aria-describedby={mode === 'signIn' ? undefined : 'auth-password-hint'}
                  />
                  <button type="button" className="btn btn-quiet btn-sm btn-icon" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </span>
                {mode !== 'signIn' && (
                  <span id="auth-password-hint" className="muted small">
                    At least {MIN_PASSWORD} characters.
                  </span>
                )}
              </label>
            )}
            {mode === 'signUp' && (
              <label className="setting">
                <input type="checkbox" checked={oldEnough} onChange={(e) => setOldEnough(e.target.checked)} disabled={busy} />
                <span>I’m 13 or older</span>
              </label>
            )}

            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}

            <div className="auth-row">
              {mode === 'signIn' && (
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => open('forgot')}>
                  Forgot password?
                </button>
              )}
              <span style={{ flex: 1 }} />
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy && <Loader2 size={14} className="spin" aria-hidden="true" />}
                {mode === 'signIn' ? 'Sign in' : mode === 'signUp' ? 'Create account' : mode === 'forgot' ? 'Send the link' : 'Save password'}
              </button>
            </div>

            {mode === 'signUp' && <p className="muted small">Your email is only used to sign you in and to reset your password.</p>}
            {(mode === 'signIn' || mode === 'signUp' || mode === 'forgot') && (
              <p className="auth-switch small">
                {mode === 'signIn' ? (
                  <>
                    New here?{' '}
                    <button type="button" className="link-btn" onClick={() => open('signUp')}>
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    {mode === 'signUp' ? 'Already have an account?' : 'Remembered it?'}{' '}
                    <button type="button" className="link-btn" onClick={() => open('signIn')}>
                      Sign in
                    </button>
                  </>
                )}
              </p>
            )}
          </>
        )}
      </form>
    </div>
  );
}
