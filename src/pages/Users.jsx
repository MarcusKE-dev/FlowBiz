// src/pages/Users.jsx
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2, Copy, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { tenantQuery } from '../lib/tenant';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PageHeader from '../components/ui/PageHeader';
import Section from '../components/ui/Section';
import DataTable from '../components/ui/DataTable';
import StatusPill from '../components/ui/StatusPill';
import EmptyState from '../components/common/EmptyState';
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
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Team"
        description="Who has access to this business."
        actions={
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
            Invite someone
          </button>
        }
      />

      {invites.length > 0 && (
        <Section title="Pending invites" hint="Anyone with one of these links can join the business.">
          <DataTable
            caption="Invites that have not been accepted yet"
            rows={invites}
            rowKey={(inv) => inv.id}
            columns={[
              {
                key: 'displayName',
                header: 'Name',
                primary: true,
                render: (inv) => <span className="font-medium text-ink-900">{inv.displayName}</span>,
              },
              {
                key: 'role',
                header: 'Role',
                render: (inv) => (
                  <StatusPill tone={inv.role === 'owner' ? 'info' : 'neutral'}>
                    {inv.role === 'owner' ? 'Owner' : 'Cashier'}
                  </StatusPill>
                ),
              },
              {
                key: 'link',
                header: 'Invite link',
                render: (inv) => (
                  <span className="block max-w-xs truncate font-mono text-secondary text-ink-500">
                    {inviteLink(inv.id)}
                  </span>
                ),
              },
            ]}
            rowActions={(inv) => (
              <>
                <button className="btn-ghost !px-2 text-ink-600" onClick={() => copyLink(inv.id)}>
                  <Copy className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Copy
                </button>
                <button
                  className="btn-ghost !px-2 text-ink-500 hover:text-danger-700"
                  title="Cancel this invite"
                  aria-label={`Cancel the invite for ${inv.displayName}`}
                  onClick={() => setPendCancelInvite(inv)}
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </>
            )}
          />
        </Section>
      )}

      <Section title="People">
        {loading || invitesLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            caption="People with access to this business"
            rows={users}
            rowKey={(u) => u.id}
            columns={[
              {
                key: 'displayName',
                header: 'Name',
                primary: true,
                render: (u) => (
                  <span className="font-medium text-ink-900">
                    {u.displayName || u.email?.split('@')[0] || 'Unnamed'}
                    {u.id === profile?.uid && <span className="font-normal text-ink-500"> (you)</span>}
                  </span>
                ),
              },
              { key: 'email', header: 'Email', render: (u) => <span className="text-ink-600">{u.email || 'No email'}</span> },
              {
                key: 'role',
                header: 'Role',
                render: (u) => (
                  <StatusPill tone={u.role === 'owner' ? 'info' : 'neutral'}>
                    {u.role === 'owner' ? 'Owner' : 'Cashier'}
                  </StatusPill>
                ),
              },
              {
                key: 'active',
                header: 'Status',
                render: (u) => (
                  <StatusPill tone={u.active !== false ? 'positive' : 'neutral'}>
                    {u.active !== false ? 'Active' : 'Deactivated'}
                  </StatusPill>
                ),
              },
            ]}
            rowActions={(u) => (
              <>
                <button className="btn-ghost !px-2 text-ink-600" onClick={() => setPendToggle(u)}>
                  {u.active !== false ? 'Deactivate' : 'Reactivate'}
                </button>
                {u.id !== profile?.uid && (
                  <button
                    className="btn-ghost !px-2 text-ink-500 hover:text-danger-700"
                    title="Remove this account"
                    aria-label={`Remove ${u.displayName || u.email || 'this account'}`}
                    onClick={() => setPendDelete(u)}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                )}
              </>
            )}
            empty={<EmptyState title="No team members yet" description="Invite someone to give them access to this business." />}
          />
        )}
      </Section>

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
                  className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${newRole === 'cashier' ? 'border-success-600 bg-success-50 text-success-800' : 'border-ink-200 text-ink-500'}`}
                >
                  Cashier
                </button>
                <button
                  type="button"
                  onClick={() => setNewRole('owner')}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${newRole === 'owner' ? 'border-success-600 bg-success-50 text-success-800' : 'border-ink-200 text-ink-500'}`}
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
              <button type="button" className="btn-secondary shrink-0" onClick={() => copyLink(freshInvite.id)}>
                <Copy className="h-4 w-4" strokeWidth={1.75} /> Copy
              </button>
            </div>
            <button type="button" className="btn-primary w-full" onClick={() => setModal(false)}>Done</button>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!pendToggle} title="Change this account status?" confirmLabel="Change status" onConfirm={handleToggle} onCancel={() => setPendToggle(null)} />
      <ConfirmDialog open={!!pendDelete} title="Remove this account?" confirmLabel="Remove account" danger onConfirm={handleDelete} onCancel={() => setPendDelete(null)} />
      <ConfirmDialog open={!!pendCancelInvite} title="Cancel this invite?" confirmLabel="Cancel invite" danger onConfirm={handleCancelInvite} onCancel={() => setPendCancelInvite(null)} />
    </div>
  );
}