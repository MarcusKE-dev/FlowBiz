import { useEffect, useState } from 'react';
import Modal from '../common/Modal';
const empty = { name:'', contactPerson:'', phone:'', email:'', address:'', notes:'' };
export default function SupplierFormModal({ open, onClose, onSave, initialSupplier }) {
  const [form, setForm] = useState(empty);
  useEffect(() => { setForm(initialSupplier ? {...empty,...initialSupplier} : empty); }, [initialSupplier, open]);
  const set = f => e => setForm(p=>({...p,[f]:e.target.value}));
  const handle = e => { e.preventDefault(); if (!form.name.trim()) return; onSave({...form,name:form.name.trim()}); };
  return (
    <Modal open={open} onClose={onClose} title={initialSupplier ? 'Edit supplier' : 'Add supplier'}>
      <form onSubmit={handle} className="space-y-3">
        <div><label className="label">Business name</label><input className="input" value={form.name} onChange={set('name')} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Contact person</label><input className="input" value={form.contactPerson} onChange={set('contactPerson')} /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={set('phone')} placeholder="07xx xxx xxx" /></div>
        </div>
        <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={set('email')} /></div>
        <div><label className="label">Address</label><input className="input" value={form.address} onChange={set('address')} /></div>
        <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={set('notes')} /></div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">{initialSupplier ? 'Save changes' : 'Add supplier'}</button>
        </div>
      </form>
    </Modal>
  );
}
