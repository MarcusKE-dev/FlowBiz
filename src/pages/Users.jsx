// src/pages/Users.jsx
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2, Copy, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { tenantQuery } from '../lib/tenant';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { friendlyErrorMessage } from '../utils/errorMessages';

export default function Users() {
  const { createStaffInvite, cancelStaffInvite, removeStaffAccount, toggleMemberActive, profile, businessId, isPro } = useAuth();
  
  // Scoped tenant query with in-memory sorting to avoid composite index requirement
  const usersQ = useMemo(() => (businessId ? tenantQuery('users', businessId) : null), [businessId]);
  const { data: rawUsers, loading } = useFirestoreCollection(usersQ);
  const users = useMemo(() => [...rawUsers].sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')), [rawUsers]);

  const invitesQ = useMemo(() => (businessId ? tenantQuery('staffInvites', businessId) : null), [businessId]);
  const { data: allInvites, loading: invitesLoading } = useFirestoreCollection(invitesQ);
  const invites = useMemo(() => allInvites.filter((i) => !i.claimed), [allInvites]);

  const ownerCount = useMemo(() => users.filter((u) => u.role === 'owner' && u.active !== false).length, [users]);
  const totalUsersCount = useMemo(() => users.filter((u) => u.active !== false).length, [users]);

  const [modal, setModal]                     = useState(false);
  const [newName, setNewName]                 = useState('');
  const [newRole, setNewRole]                 = useState('cashier');
  const [busy, setBusy]                       = useState(false);
  const [freshInvite, setFreshInvite]         = useState(null);
  const [pendToggle, setPendToggle]           = useState(null);
  const [pendDelete, setPendDelete]           = useState(null);
  const [pendCancelInvite, setPendCancelInvite] = useState(null);

  const inviteLink = (inviteId) => `${window.location.origin}/join/${inviteId}`;

  const copyLink = async (inviteId) => {
    try {
      await navigator.clipboard.writeText(inviteLink(inviteId));
      toast.success('Invite link copied');
    } catch {
      toast.error('Could not copy — long-press the link to copy it manually.');
    }
  };

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    if (!isPro && (totalUsersCount + invites.length) >= 2) {
      toast.error('Free plan allows a maximum of 1 Owner and 1 additional Staff member. Upgrade to FlowBiz Pro to add more, or cancel a pending invite first.');
      return;
    }

    setBusy(true);
    try {
      const invite = await createStaffInvite({ displayName: newName.trim(), role: newRole });
      if (invite.queuedOffline) {
        toast.success("Invite saved — the link will be ready once you're back online.");
        setModal(false);
      } else {
        setFreshInvite({ id: invite.id, displayName: newName.trim(), role: newRole });
      }
      setNewName('');
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCancelInvite = async () => {
    if (!pendCancelInvite) return;
    try {
      await cancelStaffInvite(pendCancelInvite.id);
      toast.success('Invite cancelled');
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setPendCancelInvite(null);
    }
  };

  const handleToggle = async () => {
    if (!pendToggle) return;
    if (pendToggle.role === 'owner' && pendToggle.active !== false && ownerCount <= 1) {
      toast.error("This is the only active owner — deactivating them would lock everyone out. Invite another owner first.");
      setPendToggle(null);
      return;
    }
    try {
      await toggleMemberActive(pendToggle.id, pendToggle.active === false);
      toast.success(pendToggle.active !== false ? 'Account deactivated' : 'Account reactivated');
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setPendToggle(null);
    }
  };

  const handleDelete = async () => {
    if (!pendDelete) return;
    if (pendDelete.role === 'owner' && ownerCount <= 1) {
      toast.error('You cannot remove the only owner. Invite another owner first.');
      setPendDelete(null);
      return;
    }
    try {
      await removeStaffAccount(pendDelete.id);
      toast.success('Account removed.');
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setPendDelete(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">Team</h1>
          <p className="text-sm text-ink-400">Manage who has access to this business.</p>
        </div>
        <button
          className="btn-primary"
          type="button"
          onClick={() => {
            setFreshInvite(null);
            setNewName('');
            setNewRole('cashier');
            setModal(true);
          }}
        >
          + Invite someone
        </button>
      </div>

      {invites.length > 0 && (
        <div className="card p-4 space-y-2">
          <h2 className="font-display text-sm font-bold text-ink-800">Pending invites</h2>
          <div className="divide-y divide-ink-100">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-800">
                    {inv.displayName}
                    <span className={`badge ml-2 ${inv.role === 'owner' ? 'bg-ink-900 text-white' : 'bg-moss-100 text-moss-700'}`}>{inv.role}</span>
                  </p>
                  <p className="text-xs text-ink-400 truncate font-mono">{inviteLink(inv.id)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button className="btn-outline !px-2.5 !py-1 !min-h-0 text-xs" onClick={() => copyLink(inv.id)}>
                    <Copy className="h-3.5 w-3.5" strokeWidth={1.75} /> Copy link
                  </button>
                  <button
                    className="rounded-lg p-2 text-rust-400 hover:bg-rust-50 min-h-[40px] min-w-[40px] flex items-center justify-center"
                    title="Cancel invite"
                    onClick={() => setPendCancelInvite(inv)}
                  >
                    <X className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading || invitesLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="card divide-y divide-ink-100">
          {users.map((u) => (
            <div key={u.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink-800 truncate">
                  {u.displayName || u.email?.split('@')[0] || 'Unnamed'}
                  {u.id === profile?.uid && <span className="text-xs font-normal text-ink-400"> (you)</span>}
                </p>
                <p className="text-xs text-ink-400 truncate">{u.email || 'No email'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge ${u.role === 'owner' ? 'bg-ink-900 text-white' : 'bg-moss-100 text-moss-700'}`}>{u.role || '—'}</span>
                <span className={`badge ${u.active !== false ? 'bg-moss-100 text-moss-700' : 'bg-rust-100 text-rust-700'}`}>{u.active !== false ? 'Active' : 'Deactivated'}</span>
                <button className="btn-outline !px-2.5 !py-1 !min-h-0 text-xs" onClick={() => setPendToggle(u)}>
                  {u.active !== false ? 'Deactivate' : 'Reactivate'}
                </button>
                {u.id === profile?.uid ? (
                  <span className="text-xs text-ink-300 px-2">You</span>
                ) : (
                  <button
                    className="rounded-lg p-2 text-rust-400 hover:bg-rust-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Remove account"
                    onClick={() => setPendDelete(u)}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={freshInvite ? 'Invite ready' : 'Invite someone'}>
        {!freshInvite ? (
          <form onSubmit={handleCreateInvite} className="space-y-3">
            <div>
              <label className="label">Full name</label>
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} required autoComplete="off" autoFocus />
            </div>
            <div>
              <label className="label">Role</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewRole('cashier')}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${newRole === 'cashier' ? 'border-moss-600 bg-moss-50 text-moss-800' : 'border-ink-200 text-ink-500'}`}
                >
                  Cashier
                </button>
                <button
                  type="button"
                  onClick={() => setNewRole('owner')}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${newRole === 'owner' ? 'border-moss-600 bg-moss-50 text-moss-800' : 'border-ink-200 text-ink-500'}`}
                >
                  Owner
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create invite'}</button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-600">Send this link to <span className="font-semibold">{freshInvite.displayName}</span> ({freshInvite.role}).</p>
            <div className="flex items-center gap-2">
              <input className="input font-mono text-xs" readOnly value={inviteLink(freshInvite.id)} onFocus={(e) => e.target.select()} />
              <button type="button" className="btn-outline shrink-0" onClick={() => copyLink(freshInvite.id)}>
                <Copy className="h-4 w-4" strokeWidth={1.75} /> Copy
              </button>
            </div>
            <button type="button" className="btn-primary w-full" onClick={() => setModal(false)}>Done</button>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!pendToggle} title="Change Account Status?" confirmLabel="Confirm" onConfirm={handleToggle} onCancel={() => setPendToggle(null)} />
      <ConfirmDialog open={!!pendDelete} title="Remove Account?" confirmLabel="Remove" danger onConfirm={handleDelete} onCancel={() => setPendDelete(null)} />
      <ConfirmDialog open={!!pendCancelInvite} title="Cancel Invite?" confirmLabel="Cancel" danger onConfirm={handleCancelInvite} onCancel={() => setPendCancelInvite(null)} />
    </div>
  );
}