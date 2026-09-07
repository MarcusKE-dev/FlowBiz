import { useEffect, useMemo, useState, useRef } from 'react'; // Added useRef import
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Copy } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useIndustry } from '../hooks/useIndustry';
import { resetBusinessData } from '../utils/businessReset';
import { restoreProduct, permanentlyDeleteProduct } from '../utils/products';
import { isDemoMode } from '../demo/demoMode';
import { resetDemoData } from '../demo/seedData';
import { formatDateTime } from '../utils/dateRanges';
import { isContinuousScanEnabled, setContinuousScanEnabled } from '../utils/scannerService';
import ConfirmDialog from '../components/common/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import StatusPill from '../components/ui/StatusPill';
import Modal from '../components/common/Modal'; 
import { raceWithTimeout } from '../utils/offlineWrite';
import {
  SUPPORT_EMAIL, SUPPORT_EMAIL_HREF, SUPPORT_WHATSAPP_LABEL, whatsappHref,
} from '../lib/support';
import { buildExportZip } from '../utils/dataExport';
import { readExportZip, checkExistingData, importBusinessData } from '../utils/dataImport';
import { printReceipt } from '../utils/documentService';
import LicensingSummary from '../components/licensing/LicensingSummary';


const RESET_CONFIRM_PHRASE = 'RESET';
const DELETE_ACCOUNT_CONFIRM_PHRASE = 'DELETE';

// Used only by the Devices card's "Test Print" button — runs through the
// exact same buildDocument()/jsPDF pipeline a real receipt uses, just
// with made-up sample items, so a Test Print genuinely proves your
// printer works with FlowBiz's real receipt output (not a mockup).
const TEST_PRINT_SAMPLE = {
  id: 'test-print-sample',
  customerName: '',
  soldByName: 'Test Print',
  soldAt: new Date(),
  isCredit: false,
  paymentMethod: 'Cash',
  totalAmount: 450,
  items: [
    { productName: 'Sample Product A', quantity: 2, unitPrice: 150, lineTotal: 300 },
    { productName: 'Sample Product B', quantity: 1, unitPrice: 150, lineTotal: 150 },
  ],
};

export default function Settings() {
  const { profile, businessId, emailVerified, listBusinessSessions, revokeSession, currentSessionId, isPro, isLifetime, deleteOwnAccount } = useAuth();
  const industry = useIndustry();
  const demo = isDemoMode();
  const [loading, setLoading]     = useState(true);
  
  const [shopName, setShopName]   = useState('');
  const [phone, setPhone]         = useState('');
  const [email, setEmail]         = useState('');
  const [address, setAddress]     = useState('');
  const [logoFile, setLogoFile]   = useState(null);
  const [logoUrl, setLogoUrl]     = useState('');

  // Devices card — printer paper width + live scanner/printer test state
  const [paperWidth, setPaperWidth] = useState(80);
  const [savingDevices, setSavingDevices] = useState(false);
  const [scanTestValue, setScanTestValue] = useState('');
  const [lastScan, setLastScan] = useState('');
  // Per-device, not per-business: the phone at the counter and the
  // owner's laptop want different things. localStorage only — no
  // Firestore field, so there is nothing to save and nothing to sync.
  const [continuousScan, setContinuousScan] = useState(() => isContinuousScanEnabled());
  
  const [saving, setSaving]       = useState(false);
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
      toast.success(`Import complete. ${totalDocs} record(s) restored.`);
      setPendingImport(null);
    } catch (err) {
      toast.error(`The import could not be completed: ${err.message}`);
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
      toast.error(`The export could not be completed: ${err.message}`);
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
        setPaperWidth(d.receiptPaperWidth === 58 ? 58 : 80);
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
            toast.error('That logo is still too large after compression. Try a smaller or simpler image.');
          } else {
            finalLogoUrl = await blobToDataUrl(compressed);
          }
        } catch (logoErr) {
          toast.error(`The logo could not be processed, so it was not changed. Everything else was saved: ${logoErr.message}`);
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
      toast.success(queuedOffline ? 'Saved offline. It will sync when you reconnect.' : 'Business information saved');
      setLogoFile(null);
    } catch (err) { 
      toast.error(err.message); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleSaveDeviceSettings = async () => {
    if (!settingsRef) return;
    setSavingDevices(true);
    const write = setDoc(settingsRef, { receiptPaperWidth: paperWidth }, { merge: true });
    const { queuedOffline, error } = await raceWithTimeout(write, 4000);
    setSavingDevices(false);
    if (error) { toast.error(error.message); return; }
    toast.success(queuedOffline ? 'Saved offline. It will sync when you reconnect.' : 'Printer settings saved');
  };

  const handleTestPrint = async () => {
    try {
      await printReceipt(TEST_PRINT_SAMPLE, {
        shopName: shopName || 'FlowBiz Store',
        phone, email, address, logoUrl,
        receiptPaperWidth: paperWidth,
      });
      toast.success('Test receipt sent. Check your printer.');
    } catch {
      toast.error('The test receipt could not be generated. Check that a printer is connected, then try again.');
    }
  };

  const handleScanTestKeyDown = (e) => {
    // Hardware barcode scanners work by "typing" into whatever field
    // currently has focus, then sending an Enter keystroke — a plain
    // text input already receives that correctly with no special code,
    // exactly the same way it would receive someone typing by hand. This
    // just watches for that trailing Enter to know a scan finished.
    if (e.key === 'Enter') {
      e.preventDefault();
      if (scanTestValue.trim()) {
        setLastScan(scanTestValue.trim());
        setScanTestValue('');
      }
    }
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
        ? 'Product restored. Another product now uses its old barcode, so it was cleared. Add a new one from Products.'
        : 'Product restored');
    } catch (err) { toast.error(err.message); }
  };

  const handlePermanentDelete = async (productId) => {
    const target = archived.find(p => p.id === productId);
    try {
      await permanentlyDeleteProduct(productId, target?.barcode, businessId);
      setArchived(a => a.filter(p => p.id !== productId));
      toast.success('Product permanently deleted.');
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <div className="mx-auto max-w-2xl"><p className="text-body text-ink-400">Loading…</p></div>;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Settings"
        description="Your business profile, hardware, team, data and account."
      />

      {/* One panel, banded. A single hairline between two identically
          coloured blocks was not enough separation for a page this long,
          so each section is now a full-width band and the fill alternates.
          The alternation is driven by nth-child rather than an index prop
          because "Logged-in devices" is conditional — with an index the
          parity would have to be recomputed for demo mode, and with
          nth-child the browser just does it. */}
      <div className="mt-6 overflow-hidden rounded-panel border border-line
                      [&>*:nth-child(even)]:bg-canvas">
        <Section title="Account and security">
          <Row label="Email verification" value={demo ? 'Not applicable in demo mode' : emailVerified ? 'Verified' : 'Not verified'} tone={!demo && !emailVerified ? 'text-danger-700' : ''} />
          <Row label="Your role" value={profile?.role === 'owner' ? 'Owner' : 'Cashier'} />
          <CopyRow
            label="Business ID"
            value={businessId || '-'}
            copyValue={businessId}
            copiedMessage="Business ID copied."
            mono
          />
        </Section>

        {/* CONTACT SUPPORT.
            The WhatsApp line shows the WORD, never the number — it is a
            business line, not a published switchboard, and the number
            lives only in the href. See lib/support.js.

            THE EMAIL CARRIES A COPY BUTTON, and that is not decoration.
            FlowBiz is installed as a standalone PWA (`display:
            'standalone'`), so a `mailto:` has to be handed off to an
            external mail app — and on a device with no mail handler
            registered, that hand-off fails SILENTLY. Nothing opens and
            nothing says why, which is exactly what an owner reported.
            The link stays, because it is right when it works; the copy
            button is what makes the address reachable when it does not.
            `target="_blank"` is the other half: from inside a standalone
            window it routes the protocol through the browser, which is
            more likely to find a handler than the app window is. */}
        <Section title="Support" description="Stuck on something? Reach us directly.">
 <SupportRow label="Email">
  <a
    className="font-semibold text-primary-600 underline underline-offset-2 hover:text-primary-700"
    href="mailto:support@flowbiz.co.ke"
  >
    support@flowbiz.co.ke
  </a>
</SupportRow>

  <SupportRow label="Chat">
    <a
      className="font-semibold text-primary-600 underline underline-offset-2 hover:text-primary-700"
      href={whatsappHref('Hello FlowBiz support, I need help with my account.')}
      target="_blank"
      rel="noopener noreferrer"
    >
      {SUPPORT_WHATSAPP_LABEL}
    </a>
  </SupportRow>
</Section>

        <Section
          title="Business information"
          description="Appears on your receipts and invoices."
          as="form"
          onSubmit={handleSave}
        >
          <div className="space-y-4">
            <div><label className="label">Business name</label><input className="input" value={shopName} onChange={e=>setShopName(e.target.value)} placeholder="Your Business Name" /></div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Business phone</label><input className="input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Official Contact Number" /></div>
              <div><label className="label">Business email</label><input type="email" className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="contact@example.com" /></div>
            </div>

            <div><label className="label">Business address</label><input className="input" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Physical location" /></div>

            <div>
              <label className="label">Business logo</label>
              <div className="flex items-center gap-4">
                {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 w-12 rounded-control border border-line object-cover" />}
                <input type="file" accept="image/*" className="text-body" onChange={(e) => setLogoFile(e.target.files ? e.target.files[0] : null)} />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
          </div>
        </Section>

        {/* Industry customization moved to its own page. Settings answers
            "what are my details and who may do what"; that page answers
            "how should FlowBiz work for my business". Keeping both here was
            crowding a page that already holds the shop name, the logo,
            permissions, receipts and data export.

            The business type is SHOWN here and on that page, and is
            editable on neither: it is settled when the business is created.
            See the header of CustomizeBusiness.jsx. */}
        <Section
          title="Customize your business"
          hint="Pages, units, dashboard, words and categories."
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-surface px-3 py-3">
            <div className="min-w-0">
              <p className="text-body font-medium text-ink-900">{industry.label}</p>
              <p className="text-secondary text-ink-500">{industry.tagline}</p>
            </div>
            <Link to="/customize" className="btn-secondary shrink-0">Customize</Link>
          </div>
        </Section>

        {/* Cashier permissions live on the Team page now. One switch here
            could not describe a real job — see
            src/industry/permissions.js — and "who may do what" belongs
            beside "who works here" rather than beside the shop logo. */}
        <Section title="Permissions" hint="What cashiers can do.">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-surface px-3 py-3">
            <p className="text-secondary text-ink-500">Set on the Team page, beside the people it applies to.</p>
            <Link to="/users" className="btn-secondary shrink-0">Open Team</Link>
          </div>
        </Section>

        <Section
          title="Printer and scanner"
          description="Set your receipt size and check your hardware."
        >
          <div className="space-y-4">
            <div className="rounded-panel border border-line bg-surface p-3.5 space-y-2.5">
              <p className="text-body font-semibold text-ink-800">Barcode scanner</p>
              <p className="text-secondary text-ink-500">
                Most scanners work like a keyboard, with no setup. Click the box, then scan to test.
              </p>
              <input
                className="input font-mono"
                value={scanTestValue}
                onChange={(e) => setScanTestValue(e.target.value)}
                onKeyDown={handleScanTestKeyDown}
                placeholder="Click here, then scan a barcode…"
                autoComplete="off"
              />
              {lastScan && (
                <p className="text-secondary font-medium text-ink-700">Received <span className="num font-mono text-ink-900">{lastScan}</span>. Your scanner is working.</p>
              )}
            </div>

            <div className="rounded-panel border border-line bg-surface p-3.5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p id="continuous-scan-label" className="text-body font-semibold text-ink-800">Continuous scanning</p>
                  <p className="mt-1 text-secondary text-ink-500">
                    Keep the phone camera open between scans. This device only.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !continuousScan;
                    setContinuousScan(next);
                    setContinuousScanEnabled(next);
                  }}
                  className={`mt-0.5 h-6 w-11 shrink-0 rounded-pill transition-colors ${continuousScan ? 'bg-primary-600' : 'bg-ink-300'}`}
                  role="switch"
                  aria-checked={continuousScan}
                  aria-labelledby="continuous-scan-label"
                >
                  <span className={`block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform ${continuousScan ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </div>

            <div className="rounded-panel border border-line bg-surface p-3.5 space-y-3">
              <p className="text-body font-semibold text-ink-800">Receipt printer</p>
              <p className="text-secondary text-ink-500">
                Any printer set up on this device works, thermal receipt printers included.
              </p>
              <div>
                <label className="label">Receipt paper width</label>
                <div className="grid grid-cols-2 gap-2">
                  {[58, 80].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setPaperWidth(w)}
                      className={`rounded-control border px-3 py-2.5 text-button transition-colors ${paperWidth === w ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-line text-ink-600 hover:bg-ink-50 hover:text-ink-900'}`}
                    >
                      {w}mm
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn-outline" onClick={handleTestPrint}>Test print</button>
                <button type="button" className="btn-primary" onClick={handleSaveDeviceSettings} disabled={savingDevices}>
                  {savingDevices ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Team" description="Invites, roles and access.">
          <Link to="/users" className="btn-outline w-full flex items-center justify-center gap-2">Manage users &amp; invites</Link>
        </Section>

        {!demo && (
          <Section title="Devices" description="Signed in to this business.">
            {sessionsLoading ? (
              <p className="text-body text-ink-400">Loading…</p>
            ) : deviceGroups.length === 0 ? (
              <p className="text-body text-ink-400">No device sessions recorded yet.</p>
            ) : (
              <div className="divide-y divide-divider rounded-panel border border-line bg-surface px-3">
                {deviceGroups.map((group) => {
                  const isCurrent = group.ids.includes(currentSessionId);
                  const isActiveNow = isCurrent || (Date.now() - group.lastActiveMs < 20 * 60 * 1000);
                  const isRevoked = !group.anyActive;
                  return (
                    <div key={group.key} className="flex items-center justify-between py-3 text-body">
                      <div className="min-w-0 pr-3">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="font-semibold text-ink-800 truncate">{group.deviceLabel || 'Unknown device'}</p>
                          {isCurrent && <StatusPill tone="info" className="shrink-0">This device</StatusPill>}
                          {!isCurrent && isActiveNow && !isRevoked && <StatusPill tone="positive" className="shrink-0">Active</StatusPill>}
                          {!isCurrent && !isActiveNow && !isRevoked && <StatusPill tone="neutral" className="shrink-0">Inactive</StatusPill>}
                        </div>
                        <p className="text-label text-ink-500 truncate">
                          <span className="font-medium text-ink-700">{group.lastUserName || 'Unknown User'}</span> &middot; {isActiveNow ? 'Last seen: Just now' : `Last seen: ${formatDateTime(group.lastActiveMs)}`}
                        </p>
                      </div>
                      {isRevoked ? (
                        <StatusPill tone="negative" className="shrink-0">Signed out</StatusPill>
                      ) : (
 !isCurrent && <button className="btn-outline !px-3 text-secondary shrink-0" onClick={() => handleRevokeGroup(group)}>Sign out</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        <Section
          title="Data"
          description="Deleted products are archived here first."
          action={
            <button className="btn-secondary" onClick={() => { setArchivedOpen(o => !o); if (!archivedOpen) loadArchived(); }}>
              {archivedOpen ? 'Hide' : 'View archive'}
            </button>
          }
        >
          {archivedOpen && (
            archivedLoading ? <p className="text-body text-ink-400">Loading…</p> : archived.length === 0 ? (
              <p className="text-body text-ink-400">Nothing archived.</p>
            ) : (
              <div className="divide-y divide-divider rounded-panel border border-line bg-surface px-3">
                {archived.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2.5 text-body">
                    <span className="font-medium text-ink-700">{p.name}</span>
                    <div className="flex gap-2">
 <button className="btn-outline !px-2.5 text-secondary" onClick={() => handleRestore(p.id)}>Restore</button>
 <button className="btn-danger !px-2.5 text-secondary" onClick={() => handlePermanentDelete(p.id)}>Delete forever</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </Section>

        {/* LICENCE AND SERVICES, NEVER ONE STATUS LINE.
            A business that owns a perpetual licence has two separate
            things to look at — what it owns and what it renews — so it
            gets the full summary. Everybody else has one plan and one
            line, exactly as before. */}
        {isLifetime ? (
          <Section
            title="Licence and services"
            action={<Link to="/pro" className="btn-outline text-secondary !px-2">Manage</Link>}
          >
            <LicensingSummary />
          </Section>
        ) : (
          <Section
            title="Subscription"
            action={<Link to="/pro" className="btn-outline text-secondary !px-2">Manage</Link>}
          >
            <p className="text-body text-ink-500">Status: <span className={`font-semibold ${isPro ? 'text-warning-600' : 'text-ink-600'}`}>{isPro ? 'FlowBiz Pro' : 'Free'}</span></p>
          </Section>
        )}

        <Section title="Help and guide">
          <Link to="/help" className="btn-outline w-full flex items-center justify-center gap-2"><span>Open the help guide</span></Link>
        </Section>

        <Section
          title="Backup and restore"
          description="Download everything as a .zip, or restore a previous FlowBiz export."
        >
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-outline" onClick={handleExport} disabled={exporting || importing || checkingImport}>
              {exporting ? (exportProgress || 'Preparing…') : 'Export (.zip)'}
            </button>
            <button type="button" className="btn-outline" onClick={() => fileInputRef.current?.click()} disabled={exporting || importing || checkingImport}>
              {checkingImport ? 'Reading file…' : 'Import (.zip)'}
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={handleImportFileSelected} />
        </Section>


        <Section title="Danger zone" tone="danger">
          <div className="space-y-3 rounded-panel border border-danger-200 bg-danger-50 p-4">
            <p className="text-body text-ink-600">
              {demo
                ? 'Resetting the demo clears all sample data stored in this browser.'
                : "Resetting the business permanently deletes all of its data and removes cashier staff accounts. The owner account and Pro subscription remain active."}
            </p>
            <button type="button" className="btn-danger w-full" onClick={() => { setResetConfirmText(''); setResetDialogOpen(true); }}>
              {demo ? 'Reset demo data' : 'Reset business data'}
            </button>
          </div>

          <div className="space-y-3 rounded-panel border border-danger-200 bg-danger-50 p-4">
            <p className="text-body font-semibold text-ink-800">Delete my account</p>
            <p className="text-body text-ink-600">
              Removes your FlowBiz sign-in permanently. If you are the only owner, the business goes with it. Export your data first.
            </p>
            <button type="button" className="btn-danger w-full" onClick={openDeleteAccount}>
              Delete my account
            </button>
          </div>
        </Section>
      </div>

      {/* The panel's own border closes the list now, so this no longer
          draws a rule of its own. It sits on the canvas, below the panel. */}
      <div className="pb-2 pt-6 text-center space-y-3 lg:pt-8">
        <div className="flex items-center justify-center gap-4 text-body font-semibold">
          <Link to="/privacy" className="text-ink-500 hover:text-ink-800 transition-colors">Privacy policy</Link>
          <span className="text-ink-300">&middot;</span>
          <Link to="/terms" className="text-ink-500 hover:text-ink-800 transition-colors">Terms of Service</Link>
        </div>
        <p className="text-secondary text-ink-400">FlowBiz ensures all data handling complies with Kenyan Data Protection Act.</p>
      </div>

      <Modal open={!!pendingImport} onClose={() => { if (!importing) setPendingImport(null); }} title="Import this backup?">
        <div className="space-y-4">
          <p className="text-body text-ink-600">
            <span className="font-mono text-secondary">{pendingImport?.fileName}</span> contains:
          </p>
          <div className="max-h-40 divide-y divide-divider overflow-y-auto rounded-panel border border-line">
            {pendingImport && Object.entries(pendingImport.manifest.collections)
              .filter(([, docs]) => docs.length > 0)
              .map(([name, docs]) => (
                <div key={name} className="flex justify-between px-3 py-1.5 text-secondary">
                  <span className="text-ink-500">{name}</span>
                  <span className="font-semibold text-ink-800">{docs.length}</span>
                </div>
              ))}
          </div>

          {pendingImport?.nonEmptyCollections.length > 0 && (
            <div className="rounded-panel border border-warning-200 bg-warning-50 px-3 py-2.5 text-body text-warning-800">
              This business already has data in: {pendingImport.nonEmptyCollections.join(', ')}. Importing adds to it, and overwrites any record with the same ID.
            </div>
          )}

          <label className="flex items-start gap-2 text-body text-ink-600">
            <input type="checkbox" checked={importConfirmChecked} onChange={(e) => setImportConfirmChecked(e.target.checked)} disabled={importing} className="mt-0.5" />
            I understand and want to proceed with this import.
          </label>

          {importing && <p className="text-secondary text-ink-400">{importProgress || 'Starting…'}</p>}

          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setPendingImport(null)} disabled={importing}>Cancel</button>
            <button type="button" className="btn-primary flex-1" onClick={handleConfirmImport} disabled={!importConfirmChecked || importing}>
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>
      </Modal>

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
            <p className="text-body text-ink-400">Checking your business…</p>
          ) : otherOwnersCount > 0 ? (
            <div className="rounded-panel border border-warning-200 bg-warning-50 px-3 py-2.5 text-body text-warning-800">
              Another owner is on this account. The business and its data stay intact, and they take over as the main contact. Only your sign-in is removed.
            </div>
          ) : (
            <div className="rounded-panel border border-danger-200 bg-danger-50 px-3 py-2.5 text-body text-danger-700">
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

// One band in the Settings panel: a full-bleed block with a title /
// description row (and an optional right-aligned action, e.g. "View
// archive"), a hairline under it, and an explicit surface fill. The
// container alternates that fill to canvas on every even band, which is
// why this sets bg-surface rather than inheriting — a band has to state
// its own colour for the override to have something to override.
//
// The last band drops its rule: the panel's own border closes the list.
//
// `as="form"` plus the rest of the props being spread lets the Business
// Information section stay a real <form> so its existing onSubmit
// handler keeps working unchanged.
function Section({ title, description, action, tone, as = 'div', children, ...rest }) {
  const Tag = as;
  return (
    <Tag
      className="space-y-3 border-b border-line bg-surface px-4 py-6 last:border-b-0 sm:px-6 lg:py-8"
      {...rest}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={`section-title ${tone === 'danger' ? 'text-danger-700' : 'text-ink-900'}`}>
            {title}
          </h2>
          {description && <p className="section-hint mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Tag>
  );
}

/**
 * A row whose value can be copied to the clipboard.
 *
 * Used for the two values on this page a person needs to hand to somebody
 * else — the business id support will ask for, and the support address
 * itself. `children` renders the value when it should be a link (the
 * support email); otherwise `value` is rendered as plain text.
 *
 * The clipboard write is guarded because it genuinely fails: it needs a
 * secure context and, in some browsers, a permission the person may have
 * refused. A silent no-op would be the same bug this row exists to fix,
 * so a failure says so and tells them what to do instead.
 */
function CopyRow({ label, value, copyValue, copiedMessage, mono = false, children }) {
  const copy = async () => {
    const text = String(copyValue ?? value ?? '');
    if (!text || text === '-') return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(copiedMessage);
    } catch {
      toast.error('Could not copy automatically. Press and hold the text to copy it.');
    }
  };

  return (
    <div className="flex items-baseline justify-between gap-4 py-1 text-body">
      <span className="text-ink-600">{label}</span>

      <span className="flex items-baseline gap-2">
        {children || (
          <span className={`num font-semibold ${mono ? 'font-mono text-secondary' : ''} text-ink-900`}>
            {value}
          </span>
        )}

        <button
          type="button"
          onClick={copy}
          className="shrink-0 self-center rounded p-1 text-ink-400 transition-colors hover:bg-canvas hover:text-ink-700"
          title={`Copy ${label.toLowerCase()}`}
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          <Copy className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}

/** Same shape as Row, but the right-hand side is a link rather than text. */
function SupportRow({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1 text-body">
      <span className="text-ink-600">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function Row({ label, value, tone = '', mono = false }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1 text-body">
      <span className="text-ink-600">{label}</span>
      <span className={`num font-semibold ${mono ? 'font-mono text-secondary' : ''} ${tone || 'text-ink-900'}`}>{value}</span>
    </div>
  );
}