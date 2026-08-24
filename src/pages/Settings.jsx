import { useEffect, useMemo, useState, useRef } from 'react'; // Added useRef import
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { resetBusinessData } from '../utils/businessReset';
import { restoreProduct, permanentlyDeleteProduct } from '../utils/products';
import { isDemoMode } from '../demo/demoMode';
import { resetDemoData } from '../demo/seedData';
import { formatDateTime } from '../utils/dateRanges';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal'; 
import { raceWithTimeout } from '../utils/offlineWrite';
import { buildExportZip } from '../utils/dataExport';
import { readExportZip, checkExistingData, importBusinessData } from '../utils/dataImport';

const RESET_CONFIRM_PHRASE = 'RESET';
const DELETE_ACCOUNT_CONFIRM_PHRASE = 'DELETE';

export default function Settings() {
  const { profile, businessId, emailVerified, listBusinessSessions, revokeSession, currentSessionId, isPro, deleteOwnAccount } = useAuth();
  const demo = isDemoMode();
  const [loading, setLoading]     = useState(true);
  
  const [shopName, setShopName]   = useState('');
  const [phone, setPhone]         = useState('');
  const [email, setEmail]         = useState('');
  const [address, setAddress]     = useState('');
  const [logoFile, setLogoFile]   = useState(null);
  const [logoUrl, setLogoUrl]     = useState('');
  const [cashierExp, setCashierExp] = useState(true);
  
  const [saving, setSaving]       = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [otherOwnersCount, setOtherOwnersCount] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);

  const fileInputRef = useRef(null);
  const [checkingImport, setCheckingImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [pendingImport, setPendingImport] = useState(null); // { manifest, nonEmptyCollections, fileName }
  const [importConfirmChecked, setImportConfirmChecked] = useState(false);

  const handleImportFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setCheckingImport(true);
    try {
      const manifest = await readExportZip(file);
      const nonEmptyCollections = await checkExistingData(businessId, manifest);
      setPendingImport({ manifest, nonEmptyCollections, fileName: file.name });
      setImportConfirmChecked(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCheckingImport(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImport) return;
    setImporting(true);
    setImportProgress(null);
    try {
      const results = await importBusinessData(businessId, pendingImport.manifest, {
        onProgress: (name, i, total) => setImportProgress(`${name} (${i + 1}/${total})`),
      });
      const totalDocs = Object.values(results).reduce((a, b) => a + b, 0);
      toast.success(`Import complete — ${totalDocs} record(s) restored.`);
      setPendingImport(null);
    } catch (err) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportProgress(null);
    try {
      const blob = await buildExportZip(businessId, {
        onProgress: (name, i, total) => setExportProgress(`${name} (${i + 1}/${total})`),
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `flowbiz-export-${businessId}-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Export downloaded.');
    } catch (err) {
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  const deviceGroups = useMemo(() => {
    const groups = new Map();
    for (const s of sessions) {
      const key = `${s.deviceLabel || 'Unknown device'}|${s.userAgent || ''}`;
      const lastActiveMs = s.lastActiveAt?.toMillis ? s.lastActiveAt.toMillis() : (s.lastActiveAt ? new Date(s.lastActiveAt).getTime() : 0);
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, { key, deviceLabel: s.deviceLabel, lastUserName: s.lastUserName, lastActiveMs, ids: [s.id], anyActive: s.revoked !== true });
      } else {
        existing.ids.push(s.id);
        if (s.revoked !== true) existing.anyActive = true;
        if (lastActiveMs > existing.lastActiveMs) {
          existing.lastActiveMs = lastActiveMs;
          existing.lastUserName = s.lastUserName;
        }
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.lastActiveMs - a.lastActiveMs);
  }, [sessions]);

  const [archived, setArchived] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const settingsRef = useMemo(() => (businessId ? doc(db, 'businessSettings', businessId) : null), [businessId]);

  function compressImage(file, maxDimension = 480, quality = 0.75) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Could not process image.')); return; }
          resolve(blob);
        }, 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image file.')); };
      img.src = url;
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  useEffect(() => {
    if (!settingsRef) {
      setLoading(false);
      return;
    }
    getDoc(settingsRef).then((snap) => {
      if (snap.exists()) { 
        const d = snap.data(); 
        setShopName(d.shopName || ''); 
        setPhone(d.phone || '');
        setEmail(d.email || '');
        setAddress(d.address || '');
        setLogoUrl(d.logoUrl || '');
        setCashierExp(d.cashierCanRecordExpenses !== false); 
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [settingsRef]);

  useEffect(() => {
    if (!businessId) {
      setSessionsLoading(false);
      return;
    }
    listBusinessSessions().then(setSessions).finally(() => setSessionsLoading(false));
  }, [businessId, listBusinessSessions]);

  const loadArchived = async () => {
    if (!businessId) return;
    setArchivedLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'products'), where('businessId', '==', businessId), where('deleted', '==', true)));
      setArchived(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } finally {
      setArchivedLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault(); 
    if (!settingsRef) return;
    setSaving(true);
    try {
      let finalLogoUrl = logoUrl;

      if (logoFile) {
        try {
          const compressed = await compressImage(logoFile, 480, 0.75);
          if (compressed.size > 700 * 1024) {
            toast.error('Logo is still too large after compression, try a simpler image.');
          } else {
            finalLogoUrl = await blobToDataUrl(compressed);
          }
        } catch (logoErr) {
          toast.error(`Logo processing failed, but the rest of your settings will still be saved: ${logoErr.message}`);
        }
      }

      const write = setDoc(settingsRef, { 
        shopName: shopName.trim(), 
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        logoUrl: finalLogoUrl,
      }, { merge: true });

      const { queuedOffline, error } = await raceWithTimeout(write, 4000);
      if (error) throw error;

      setLogoUrl(finalLogoUrl);
      toast.success(queuedOffline ? "Saved, it'll sync once you're back online." : 'Business information saved');
      setLogoFile(null);
    } catch (err) { 
      toast.error(err.message); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleSavePermissions = async () => {
    if (!settingsRef) return;
    setSavingPermissions(true);
    const write = setDoc(settingsRef, { cashierCanRecordExpenses: cashierExp }, { merge: true });
    const { queuedOffline, error } = await raceWithTimeout(write, 4000);
    setSavingPermissions(false);
    if (error) { toast.error(error.message); return; }
    toast.success(queuedOffline ? "Saved, it'll sync once you're back online." : 'Permissions saved');
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      if (demo) {
        resetDemoData();
        toast.success('Demo data reset. Reloading…');
      } else {
        await resetBusinessData(businessId, profile?.uid);
        toast.success('Business data reset. Reloading…');
      }
      window.location.href = '/';
    } catch (err) {
      toast.error(`Reset failed: ${err.message}`);
      setResetting(false);
      setResetDialogOpen(false);
    }
  };

  const openDeleteAccount = async () => {
    setDeleteAccountPassword('');
    setDeleteAccountConfirmText('');
    setOtherOwnersCount(null);
    setDeleteAccountOpen(true);
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('businessId', '==', businessId), where('role', '==', 'owner')));
      const others = snap.docs.filter((d) => d.id !== profile.uid && d.data().active !== false);
      setOtherOwnersCount(others.length);
    } catch {
      setOtherOwnersCount(0); // fail toward showing the more serious warning
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await deleteOwnAccount({ password: deleteAccountPassword });
      toast.success('Your account has been removed.');
    } catch (err) {
      toast.error(err.message);
      setDeletingAccount(false);
    }
  };

  const handleRevokeGroup = async (group) => {
    try {
      await Promise.all(group.ids.map((id) => revokeSession(id)));
      setSessions((s) => s.map((x) => (group.ids.includes(x.id) ? { ...x, revoked: true } : x)));
      toast.success('Device signed out.');
    } catch (err) { toast.error(err.message); }
  };

  const handleRestore = async (productId) => {
    const target = archived.find(p => p.id === productId);
    try {
      const { barcodeCleared } = await restoreProduct(productId, target?.barcode, businessId);
      setArchived(a => a.filter(p => p.id !== productId));
      toast.success(barcodeCleared
        ? 'Product restored, its old barcode is now used by another product, so it was cleared. Add a new one from Products if needed.'
        : 'Product restored');
    } catch (err) { toast.error(err.message); }
  };

  const handlePermanentDelete = async (productId) => {
    const target = archived.find(p => p.id === productId);
    try {
      await permanentlyDeleteProduct(productId, target?.barcode, businessId);
      setArchived(a => a.filter(p => p.id !== productId));
      toast.success('Product permanently deleted');
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <div className="mx-auto max-w-xl"><p className="text-sm text-ink-400">Loading…</p></div>;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="font-display text-xl font-bold text-ink-900">Settings</h1>

      <div className="card p-5 space-y-2">
        <h2 className="font-display text-base font-bold text-ink-800">Account &amp; Security</h2>
        <Row label="Email verification" value={demo ? 'Not applicable (Demo Mode)' : emailVerified ? 'Verified ✓' : 'Not verified'} tone={!demo && !emailVerified ? 'text-rust-600' : ''} />
        <Row label="Your role" value={profile?.role === 'owner' ? 'Owner' : 'Cashier'} />
        <Row label="Business ID" value={businessId || '—'} mono />
      </div>

      <form onSubmit={handleSave} className="card space-y-4 p-5">
        <h2 className="font-display text-base font-bold text-ink-800">Business Information</h2>
        <p className="text-sm text-ink-500 mb-2">This info dynamically populates your customer-facing documents (receipts, invoices).</p>
        
        <div><label className="label">Business name</label><input className="input" value={shopName} onChange={e=>setShopName(e.target.value)} placeholder="Your Business Name" /></div>
        
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Business Phone</label><input className="input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Official Contact Number" /></div>
          <div><label className="label">Business Email</label><input type="email" className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="contact@example.com" /></div>
        </div>

        <div><label className="label">Business Address</label><input className="input" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Physical location" /></div>
        
        <div>
          <label className="label">Business Logo</label>
          <div className="flex items-center gap-4">
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 w-12 object-cover rounded-lg border border-ink-200" />}
            <input type="file" accept="image/*" className="text-sm" onChange={(e) => setLogoFile(e.target.files ? e.target.files[0] : null)} />
          </div>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
      </form>

      <div className="card p-5 space-y-3">
        <h2 className="font-display text-base font-bold text-ink-800">Permissions</h2>
        <div className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-3">
          <div><p className="text-sm font-semibold text-ink-800">Let cashiers record expenses</p><p className="text-xs text-ink-400">Turn off if only owners should log expenses.</p></div>
          <button type="button" onClick={()=>setCashierExp(v=>!v)} className={`h-6 w-11 shrink-0 rounded-full transition-colors ${cashierExp?'bg-moss-600':'bg-ink-200'}`} role="switch" aria-checked={cashierExp}>
            <span className={`block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform ${cashierExp?'translate-x-5':''}`} />
          </button>
        </div>
        <button type="button" className="btn-primary w-full" onClick={handleSavePermissions} disabled={savingPermissions}>
          {savingPermissions ? 'Saving…' : 'Save permissions'}
        </button>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-display text-base font-bold text-ink-800">Team Management</h2>
        <p className="text-sm text-ink-500">Invite owners or cashiers, and manage pending invites and access.</p>
        <Link to="/users" className="btn-outline w-full flex items-center justify-center gap-2">Manage users &amp; invites</Link>
      </div>

      {!demo && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-ink-800">Logged-in Devices</h2>
          </div>
          <p className="text-sm text-ink-500 mb-2">Devices currently or recently associated with your business.</p>
          {sessionsLoading ? (
            <p className="text-sm text-ink-400">Loading…</p>
          ) : deviceGroups.length === 0 ? (
            <p className="text-sm text-ink-400">No device sessions recorded yet.</p>
          ) : (
            <div className="divide-y divide-ink-100">
              {deviceGroups.map((group) => {
                const isCurrent = group.ids.includes(currentSessionId);
                const isActiveNow = isCurrent || (Date.now() - group.lastActiveMs < 20 * 60 * 1000);
                const isRevoked = !group.anyActive;
                return (
                  <div key={group.key} className="flex items-center justify-between py-3 text-sm">
                    <div className="min-w-0 pr-3">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-semibold text-ink-800 truncate">{group.deviceLabel || 'Unknown device'}</p>
                        {isCurrent && <span className="badge bg-ink-900 text-white border border-ink-900 shrink-0">This device</span>}
                        {!isCurrent && isActiveNow && !isRevoked && <span className="badge bg-moss-50 text-moss-700 border border-moss-200 shrink-0">Active</span>}
                        {!isCurrent && !isActiveNow && !isRevoked && <span className="badge bg-ink-50 text-ink-600 border border-ink-200 shrink-0">Inactive</span>}
                      </div>
                      <p className="text-[11px] text-ink-500 truncate">
                        <span className="font-medium text-ink-700">{group.lastUserName || 'Unknown User'}</span> &middot; {isActiveNow ? 'Last seen: Just now' : `Last seen: ${formatDateTime(group.lastActiveMs)}`}
                      </p>
                    </div>
                    {isRevoked ? (
                      <span className="badge bg-rust-50 text-rust-600 border border-rust-200 shrink-0">Signed out</span>
                    ) : (
                      !isCurrent && <button className="btn-outline !px-3 !py-1.5 !min-h-0 text-xs shrink-0" onClick={() => handleRevokeGroup(group)}>Sign out</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-ink-800">Data</h2>
          <div className="flex gap-2">
            <button className="btn-outline !px-2.5 !py-1 !min-h-0 text-xs" onClick={() => { setArchivedOpen(o => !o); if (!archivedOpen) loadArchived(); }}>
              {archivedOpen ? 'Hide' : 'View archive'}
            </button>
          </div>
        </div>
        <p className="text-sm text-ink-500">Deleted products are archived here first, never destroyed immediately.</p>
        {archivedOpen && (
          archivedLoading ? <p className="text-sm text-ink-400">Loading…</p> : archived.length === 0 ? (
            <p className="text-sm text-ink-400">Nothing archived.</p>
          ) : (
            <div className="divide-y divide-ink-100">
              {archived.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-ink-700">{p.name}</span>
                  <div className="flex gap-2">
                    <button className="btn-outline !px-2.5 !py-1 !min-h-0 text-xs" onClick={() => handleRestore(p.id)}>Restore</button>
                    <button className="btn-danger !px-2.5 !py-1 !min-h-0 text-xs" onClick={() => handlePermanentDelete(p.id)}>Delete forever</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <div className="card p-5 space-y-2">
        <h2 className="font-display text-base font-bold text-ink-800">Subscription</h2>
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-500">Status: <span className={`font-semibold ${isPro ? 'text-amber-600' : 'text-ink-600'}`}>{isPro ? 'FlowBiz Pro' : 'Free'}</span></p>
          <Link to="/pro" className="btn-outline text-xs !px-2 !py-1 !min-h-0">Manage</Link>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-display text-base font-bold text-ink-800">Help &amp; Guide</h2>
        <Link to="/help" className="btn-outline w-full flex items-center justify-center gap-2"><span>View Help &amp; Guide</span></Link>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-display text-base font-bold text-ink-800">Backup & Restore</h2>
        <p className="text-sm text-ink-500">
          Download everything this business has stored as a .zip (CSVs plus a FlowBiz backup file), or restore a previous FlowBiz export back into this business.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-outline" onClick={handleExport} disabled={exporting || importing || checkingImport}>
            {exporting ? (exportProgress || 'Preparing…') : 'Export (.zip)'}
          </button>
          <button type="button" className="btn-outline" onClick={() => fileInputRef.current?.click()} disabled={exporting || importing || checkingImport}>
            {checkingImport ? 'Reading file…' : 'Import (.zip)'}
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={handleImportFileSelected} />
      </div>

      <Modal open={!!pendingImport} onClose={() => { if (!importing) setPendingImport(null); }} title="Import this backup?">
        <div className="space-y-4">
          <p className="text-sm text-ink-600">
            <span className="font-mono text-xs">{pendingImport?.fileName}</span> contains:
          </p>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-ink-100 divide-y divide-ink-100">
            {pendingImport && Object.entries(pendingImport.manifest.collections)
              .filter(([, docs]) => docs.length > 0)
              .map(([name, docs]) => (
                <div key={name} className="flex justify-between px-3 py-1.5 text-xs">
                  <span className="text-ink-500">{name}</span>
                  <span className="font-semibold text-ink-800">{docs.length}</span>
                </div>
              ))}
          </div>

          {pendingImport?.nonEmptyCollections.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              This business already has data in: {pendingImport.nonEmptyCollections.join(', ')}. Importing will add these records alongside what's already there — any record that shares the exact same ID as one you already have will be overwritten.
            </div>
          )}

          <label className="flex items-start gap-2 text-sm text-ink-600">
            <input type="checkbox" checked={importConfirmChecked} onChange={(e) => setImportConfirmChecked(e.target.checked)} disabled={importing} className="mt-0.5" />
            I understand and want to proceed with this import.
          </label>

          {importing && <p className="text-xs text-ink-400">{importProgress || 'Starting…'}</p>}

          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setPendingImport(null)} disabled={importing}>Cancel</button>
            <button type="button" className="btn-primary flex-1" onClick={handleConfirmImport} disabled={!importConfirmChecked || importing}>
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>
      </Modal>

      <div className="card space-y-3 border-rust-200 p-5">
        <div>
          <h2 className="font-display text-base font-bold text-rust-700">Danger Zone</h2>
          <p className="mt-1 text-sm text-ink-500">
            {demo
              ? 'Demo Reset clears all sample data stored in this browser.'
              : "Business Reset permanently deletes ALL of this business's data and removes cashier staff accounts. The owner account and Pro subscription remain active."}
          </p>
        </div>
        <button type="button" className="btn-danger w-full" onClick={() => { setResetConfirmText(''); setResetDialogOpen(true); }}>
          {demo ? 'Demo Reset' : 'Business Reset'}
        </button>
      </div>

      <div className="card space-y-3 border-rust-200 p-5">
        <div>
          <h2 className="font-display text-base font-bold text-rust-700">Delete My Account</h2>
          <p className="mt-1 text-sm text-ink-500">
            Removes your own FlowBiz sign-in permanently. What happens to the business depends on whether other owners exist. Export your data first if you're the only owner.
          </p>
        </div>
        <button type="button" className="btn-danger w-full" onClick={openDeleteAccount}>
          Delete my account
        </button>
      </div>

      <div className="pt-6 pb-2 text-center space-y-3">
        <div className="flex items-center justify-center gap-4 text-sm font-semibold">
          <Link to="/privacy" className="text-ink-500 hover:text-ink-800 transition-colors">Privacy Policy</Link>
          <span className="text-ink-300">&middot;</span>
          <Link to="/terms" className="text-ink-500 hover:text-ink-800 transition-colors">Terms of Service</Link>
        </div>
        <p className="text-xs text-ink-400">FlowBiz ensures all data handling complies with Kenyan Data Protection Act.</p>
      </div>

      <ConfirmDialog
        open={resetDialogOpen}
        title={demo ? 'Reset the demo data?' : 'This will permanently delete all store data & staff'}
        message={
          demo ? (
            <p>All sample data in this browser will be cleared and replaced with the original demo dataset.</p>
          ) : (
            <>
              <p className="mb-2">All products, sales, debt, expenses, and cashier staff will be deleted. Your owner account and Pro plan will remain intact.</p>
              <label className="label mt-3">Type <span className="font-mono font-bold">{RESET_CONFIRM_PHRASE}</span> to confirm</label>
              <input className="input" value={resetConfirmText} onChange={(e) => setResetConfirmText(e.target.value)} autoFocus />
            </>
          )
        }
        confirmLabel={resetting ? 'Resetting…' : demo ? 'Reset demo data' : 'Delete everything'}
        danger
        onConfirm={demo ? (!resetting ? handleReset : () => {}) : (resetConfirmText === RESET_CONFIRM_PHRASE && !resetting ? handleReset : () => {})}
        onCancel={() => { if (!resetting) setResetDialogOpen(false); }}
      />

      <Modal open={deleteAccountOpen} onClose={() => { if (!deletingAccount) setDeleteAccountOpen(false); }} title="Delete your account">
        <div className="space-y-4">
          {otherOwnersCount === null ? (
            <p className="text-sm text-ink-400">Checking your business…</p>
          ) : otherOwnersCount > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              Another owner is on this account. The business and all its data stay intact, and they'll take over as the business's main contact. Only your own sign-in will be removed.
            </div>
          ) : (
            <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2.5 text-sm text-rust-700">
              <strong>You're the only owner.</strong> Deleting your account permanently erases every product, sale, customer, and record this business has. This cannot be undone.
            </div>
          )}

          <div>
            <label className="label">Confirm your password</label>
            <input type="password" className="input" value={deleteAccountPassword} onChange={(e) => setDeleteAccountPassword(e.target.value)} autoComplete="current-password" disabled={deletingAccount} />
          </div>

          <div>
            <label className="label">Type <span className="font-mono font-bold">{DELETE_ACCOUNT_CONFIRM_PHRASE}</span> to confirm</label>
            <input className="input" value={deleteAccountConfirmText} onChange={(e) => setDeleteAccountConfirmText(e.target.value)} disabled={deletingAccount} />
          </div>

          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setDeleteAccountOpen(false)} disabled={deletingAccount}>Cancel</button>
            <button
              type="button"
              className="btn-danger flex-1"
              disabled={deletingAccount || deleteAccountConfirmText !== DELETE_ACCOUNT_CONFIRM_PHRASE || !deleteAccountPassword || otherOwnersCount === null}
              onClick={handleDeleteAccount}
            >
              {deletingAccount ? 'Deleting…' : 'Delete my account'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value, tone = '', mono = false }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className={`font-semibold ${mono ? 'font-mono text-xs' : ''} ${tone || 'text-ink-800'}`}>{value}</span>
    </div>
  );
}