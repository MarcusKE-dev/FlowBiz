import { useEffect, useState } from 'react';
import Modal from '../common/Modal';

const empty = { name:'', contactPerson:'', phone:'', email:'', address:'', notes:'' };
export default function SupplierFormModal({ open, onClose, onSave, initialSupplier }) {
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm(initialSupplier ? {...empty,...initialSupplier} : empty); setBusy(false); }, [initialSupplier, open]);
  const set = f => e => setForm(p=>({...p,[f]:e.target.value}));

  // FIX (stuck "Saving…" bug): onSave (each page's handleSupplierSave)
  // shows its own error toast and now re-throws on failure. Previously
  // this component only reset `busy` inside the catch block, but the
  // pages calling onSave used to swallow the error instead of throwing
  // it — so on a failed save this button never left "Saving…" and the
  // form looked frozen, with the toast the only (easy-to-miss) sign
  // anything went wrong. `finally` now resets it regardless of outcome,
  // so a failed save leaves the form open and immediately usable again.
  const handle = async e => {
    e.preventDefault();
    if (!form.name.trim() || busy) return;
    setBusy(true);
    try {
      await onSave({...form,name:form.name.trim()});
    } catch (err) {
      // Already surfaced via toast by onSave — nothing further to do
      // here besides letting the form become usable again (below).
    } finally {
      setBusy(false);
    }
  };
  const handleClose = () => { if (!busy) onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title={initialSupplier ? 'Edit supplier' : 'Add supplier'}>
      <form onSubmit={handle} className="space-y-3">
        <div><label className="label">Business name</label><input className="input" value={form.name} onChange={set('name')} required disabled={busy} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Contact person</label><input className="input" value={form.contactPerson} onChange={set('contactPerson')} disabled={busy} /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={set('phone')} placeholder="07xx xxx xxx" disabled={busy} /></div>
        </div>
        <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={set('email')} disabled={busy} /></div>
        <div><label className="label">Address</label><input className="input" value={form.address} onChange={set('address')} disabled={busy} /></div>
        <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={set('notes')} disabled={busy} /></div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={handleClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : (initialSupplier ? 'Save changes' : 'Add supplier')}</button>
        </div>
      </form>
    </Modal>
  );
}
