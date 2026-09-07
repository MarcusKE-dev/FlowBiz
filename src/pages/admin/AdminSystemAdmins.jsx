import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { fetchSystemAdmins, addSystemAdmin, deactivateSystemAdmin } from '../../utils/adminService';
import { useAdmin } from '../../components/admin/AdminProtectedRoute';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorBanner from '../../components/common/ErrorBanner';
import Modal from '../../components/common/Modal';
import { UserPlus, Trash2 } from 'lucide-react';
import { formatDateTime } from '../../utils/dateRanges';
import StatusPill from '../../components/ui/StatusPill';

export default function AdminSystemAdmins() {
  const { isSuperAdmin, admin: currentAdmin } = useAdmin();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [addModal, setAddModal] = useState(false);
  const [uid, setUid] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('SUPPORT');
  const [saving, setSaving] = useState(false);

  const loadAdmins = () => {
    setLoading(true);
    fetchSystemAdmins()
      .then(setAdmins)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addSystemAdmin({ uid: uid.trim(), email: email.trim(), name: name.trim(), role });
      toast.success('Administrator added.');
      setAddModal(false);
      setUid('');
      setEmail('');
      setName('');
      loadAdmins();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (targetUid, targetName) => {
    if (!confirm(`Are you sure you want to deactivate administrator access for "${targetName}"?`)) return;
    try {
      await deactivateSystemAdmin(targetUid);
      toast.success('Administrator deactivated.');
      loadAdmins();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-page-title font-bold text-ink-900">System administrators</h1>
          <p className="text-secondary sm:text-body text-ink-500 mt-0.5">Manage operator credentials and platform privilege tiers.</p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setAddModal(true)}
 className="btn-primary !px-3.5 text-secondary font-bold flex items-center gap-1.5"
          >
            <UserPlus className="h-3.5 w-3.5" /> Add System Admin
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <LoadingSpinner label="Loading administrators…" />
      ) : (
        <div className="rounded-panel border border-line bg-surface overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-secondary text-left">
              <thead className="bg-ink-50 uppercase text-label font-bold text-ink-400 border-b border-divider">
                <tr>
                  <th className="px-4 py-3">Administrator</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last active</th>
                  {isSuperAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-divider font-medium">
                {admins.map((adm) => (
                  <tr key={adm.id} className="hover:bg-ink-50/50">
                    <td className="px-4 py-3 font-bold text-ink-900">
                      {adm.name}
                      {adm.id === currentAdmin.uid && <span className="ml-2 text-label text-ink-500">You</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-600">{adm.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-label leading-4 ${adm.role === 'SUPER_ADMIN' ? 'text-deep-600 font-bold' : 'text-ink-600'}`}>
                        {adm.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={adm.active !== false ? 'positive' : 'negative'}>
                        {adm.active !== false ? 'Active' : 'Deactivated'}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3 text-ink-500">
                      {adm.lastLoginAt ? formatDateTime(adm.lastLoginAt) : 'Never'}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3 text-right">
                        {adm.id !== currentAdmin.uid && adm.active !== false && (
                          <button
                            type="button"
                            onClick={() => handleDeactivate(adm.id, adm.name)}
                            className="text-danger-600 hover:text-danger-800 p-1"
                            title="Deactivate Admin"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Admin Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Platform Administrator">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="label">Firebase Auth UID</label>
            <input
              type="text"
              required
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder="e.g. qwer1234asdf..."
              className="input font-mono text-secondary"
            />
          </div>
          <div>
            <label className="label">Admin email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@flowbiz.co.ke"
              className="input text-secondary"
            />
          </div>
          <div>
            <label className="label">Display name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah Kimani"
              className="input text-secondary"
            />
          </div>
          <div>
            <label className="label">Privilege</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="input text-secondary font-semibold">
              <option value="SUPER_ADMIN">SUPER_ADMIN (Full Platform Privileges)</option>
              <option value="ADMIN">ADMIN (Operations &amp; Subscriptions)</option>
              <option value="SUPPORT">SUPPORT (Read-Only Diagnostics)</option>
              <option value="FINANCE">FINANCE (Billing &amp; Reports)</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setAddModal(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Adding…' : 'Add Administrator'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}