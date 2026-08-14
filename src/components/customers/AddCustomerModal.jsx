import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import { isValidWhatsAppPhone } from '../../utils/whatsapp';

export default function AddCustomerModal({ open, onClose, onSave, existingCustomers = [], initialData }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialData?.name || '');
      setPhone(initialData?.phone || '');
    }
  }, [open, initialData]);

  const reset = () => { setName(''); setPhone(''); };
  const handleClose = () => { if (!busy) { reset(); onClose(); } };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) { toast.error('Enter a customer name.'); return; }
    if (trimmedPhone && !isValidWhatsAppPhone(trimmedPhone)) {
      toast.error("That phone number doesn't look right — check it and try again.");
      return;
    }

    if (!initialData) {
      const duplicate = existingCustomers.find((c) => {
        const sameName = (c.name || '').trim().toLowerCase() === trimmedName.toLowerCase();
        if (!sameName) return false;
        return !trimmedPhone || !c.phone || c.phone === trimmedPhone;
      });
      if (duplicate) {
        toast.error(`"${trimmedName}" already exists in your customer list.`);
        return;
      }
    }

    setBusy(true);
    try {
      await onSave({ name: trimmedName, phone: trimmedPhone });
      reset();
      onClose();
    } catch {
      // onSave already surfaces its own error toast
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={initialData ? 'Edit customer' : 'Add customer'} widthClass="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="label">Customer name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. John Kamau"
            disabled={busy}
            autoFocus
            required
          />
        </div>
        <div>
          <label className="label">Phone number <span className="text-ink-300 font-normal normal-case">(recommended)</span></label>
          <input
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07xx xxx xxx"
            disabled={busy}
          />
          <p className="mt-1 text-xs text-ink-400">Needed later to send WhatsApp reminders and receipts.</p>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={handleClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : (initialData ? 'Save changes' : 'Save customer')}</button>
        </div>
      </form>
    </Modal>
  );
}