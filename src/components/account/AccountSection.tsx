import { signOut, useAccount } from '../../state/account';

/** Settings → Account. Hidden entirely when this build has no Supabase project. */
export function AccountSection() {
  const status = useAccount((s) => s.status);
  const email = useAccount((s) => s.email);
  const open = useAccount((s) => s.openDialog);
  if (status === 'off') return null;
  return (
    <>
      <div className="inv-group-name">Account</div>
      {status === 'loading' ? (
        <p className="muted small">Checking your account…</p>
      ) : status === 'signedOut' ? (
        <section className="account">
          <p className="muted small">Sign in to back up your tokens, fish, stickers and desks, and pick up where you left off on any device.</p>
          <div className="account-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => open('signIn')}>
              Sign in
            </button>
            <button type="button" className="btn btn-sm" onClick={() => open('signUp')}>
              Create account
            </button>
          </div>
        </section>
      ) : (
        <section className="account">
          <p className="account-who">
            Signed in as <strong>{email}</strong>
          </p>
          <div className="account-actions">
            <button type="button" className="btn btn-sm" onClick={() => open('newPassword')}>
              Change password
            </button>
            <button type="button" className="btn btn-sm" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </section>
      )}
    </>
  );
}
