import { LogOut } from 'lucide-react';
import { useAccount } from '../../state/account';
import { signOutAndClear } from '../../state/sync';
import { ArmedButton } from '../ui/ArmedButton';

const SYNC_NOTE = {
  idle: null,
  saving: 'Saving to your account…',
  saved: 'Everything is saved to your account.',
  offline: 'Offline. Your changes are kept here and save when you’re back.',
  error: 'Couldn’t save just now. Trying again…',
} as const;

/** Settings → Account. Hidden entirely when this build has no Supabase project. */
export function AccountSection() {
  const status = useAccount((s) => s.status);
  const email = useAccount((s) => s.email);
  const sync = useAccount((s) => s.sync);
  const open = useAccount((s) => s.openDialog);
  if (status === 'off') return null;
  return (
    <>
      <div className="inv-group-name">Account</div>
      {status === 'loading' ? (
        <p className="muted small">Checking your account…</p>
      ) : status === 'signedOut' ? (
        <section className="account">
          <p className="muted small">Sign in to back up your tokens, fish, stickers and desks, and pick up where you left off on any device. Everything already here comes with you.</p>
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
          {SYNC_NOTE[sync] && (
            <p className={`small account-sync is-${sync}`} aria-live="polite">
              {SYNC_NOTE[sync]}
            </p>
          )}
          <div className="account-actions">
            <button type="button" className="btn btn-sm" onClick={() => open('newPassword')}>
              Change password
            </button>
            <ArmedButton label="Sign out" icon={<LogOut size={13} />} onConfirm={() => void signOutAndClear()} />
          </div>
          <p className="muted small">Signing out clears this device. Everything stays in your account for next time.</p>
        </section>
      )}
    </>
  );
}
