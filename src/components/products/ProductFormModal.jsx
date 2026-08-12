import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

const empty = {
  name: '', category: '', costPrice: '', sellingPrice: '', stock: '',
  lowStockThreshold: '5', supplierId: '', barcode: '', description: '',
};

export default function ProductFormModal({
   open, onClose, onSave, suppliers, initialProduct, prefillBarcode, onAddSupplier, newSupplierId,
simplifiedForPurchase = false,
 }) {
  const { businessId } = useAuth();
  const [form, setForm] = useState(empty);
  const [categories, setCategories] = useState([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [busy, setBusy] = useState(false);

  // MULTI-TENANT CHANGE: categories used to live in a single global
  // settings/categories doc shared by every business in the project.
  // They now live inside this business's own businessSettings/{businessId}
  // document, alongside shopName and cashierCanRecordExpenses.
  useEffect(() => {
    if (!open || !businessId) return;
    const unsub = onSnapshot(doc(db, 'businessSettings', businessId), (snap) => {
      if (snap.exists() && snap.data().categories) {
        setCategories(snap.data().categories);
      } else {
        const defaults = ['Groceries', 'Beverages', 'Hardware', 'Household', 'Personal Care', 'Stationery', 'Airtime/Float', 'Other'];
        setCategories(defaults);
        setDoc(doc(db, 'businessSettings', businessId), { categories: defaults }, { merge: true }).catch(console.error);
      }
    });
    return unsub;
  }, [open, businessId]);

  useEffect(() => {
    setBusy(false);
    if (open) {
      if (initialProduct) {
        setForm({
          ...empty, ...initialProduct,
          costPrice: initialProduct.costPrice ?? '',
          sellingPrice: initialProduct.sellingPrice ?? '',
          stock: initialProduct.stock ?? '',
          lowStockThreshold: initialProduct.lowStockThreshold ?? '5',
          supplierId: initialProduct.supplierId ?? '',
          barcode: initialProduct.barcode ?? '',
          description: initialProduct.description ?? '',
        });
      } else {
        setForm({ ...empty, barcode: prefillBarcode || '', category: categories[0] || '' });
      }
    }
  }, [initialProduct, prefillBarcode, open]);

  useEffect(() => {
    if (open && !initialProduct && !form.category && categories.length > 0) {
      setForm(prev => ({ ...prev, category: categories[0] }));
    }
  }, [categories, open, initialProduct, form.category]);

  useEffect(() => {
    if (newSupplierId) setForm((prev) => ({ ...prev, supplierId: newSupplierId }));
  }, [newSupplierId]);

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) { toast.error('Category already exists.'); return; }
    const updated = [...categories, trimmed];
    try {
      await setDoc(doc(db, 'businessSettings', businessId), { categories: updated }, { merge: true });
      setForm(prev => ({ ...prev, category: trimmed }));
      setShowAddCategory(false);
      setNewCategoryName('');
      toast.success('Category added');
    } catch (err) {
      toast.error('Failed to add category: ' + err.message);
    }
  };

  const handle = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (!form.category) return toast.error('Please select or add a category.');
    if (!simplifiedForPurchase && Number(form.costPrice) < 0) return toast.error('Cost price cannot be negative.');
    if (Number(form.sellingPrice) <= 0) return toast.error('Selling price must be greater than zero.');
    if (!initialProduct && !simplifiedForPurchase && Number(form.stock) < 0) return toast.error('Stock cannot be negative.');


    setBusy(true);
    try {
      await onSave({
        name: form.name.trim(),
        category: form.category,
        costPrice: simplifiedForPurchase ? 0 : Number(form.costPrice),
        sellingPrice: Number(form.sellingPrice),
        stock: initialProduct ? initialProduct.stock : (simplifiedForPurchase ? 0 : Number(form.stock)),
       lowStockThreshold: simplifiedForPurchase ? 5 : (Number(form.lowStockThreshold) || 5),
        supplierId: simplifiedForPurchase ? null : (form.supplierId || null),
        barcode: form.barcode.trim() || null,
        description: form.description.trim(),
      });
    } catch (err) {
      setBusy(false);
    }
  };

  const handleClose = () => { if (!busy) onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title={initialProduct ? 'Edit product' : 'Add product'}>
      <form onSubmit={handle} className="space-y-3">
        <div><label className="label">Product name</label><input className="input" value={form.name} onChange={set('name')} disabled={busy} required /></div>

        {initialProduct?.internalCode && (
          <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
            Internal code: <span className="font-mono font-semibold text-ink-700">{initialProduct.internalCode}</span>
          </div>
        )}

        <div>
          <label className="label">Barcode <span className="text-ink-300 font-normal normal-case">(optional)</span></label>
          <input className="input font-mono" value={form.barcode} onChange={set('barcode')} placeholder="Scan or type manufacturer barcode" disabled={busy} />
          {!initialProduct && <p className="mt-1 text-xs text-ink-400">Leave blank if this product doesn't have a manufacturer barcode.</p>}
        </div>

        <div className={simplifiedForPurchase ? '' : 'grid grid-cols-2 gap-3'}>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={set('category')} disabled={busy} required>
              <option value="" disabled>— Select Category —</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {showAddCategory ? (
              <div className="mt-2 space-y-2 rounded-lg bg-ink-50 p-2.5">
                <label className="text-[11px] font-semibold text-ink-700 uppercase tracking-wide">New Category</label>
                <input className="input !py-1 !min-h-0 text-xs" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="e.g. Fruits" disabled={busy} autoFocus />
                <div className="flex gap-1.5 justify-end">
                  <button type="button" className="btn-secondary !py-1 !px-2.5 !min-h-0 text-xs" onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }} disabled={busy}>Cancel</button>
                  <button type="button" className="btn-primary !py-1 !px-2.5 !min-h-0 text-xs" onClick={handleAddCategory} disabled={busy}>Save</button>
                </div>
              </div>
            ) : (
             <button type="button" className="mt-1.5 text-xs font-semibold text-moss-700 hover:underline block" onClick={() => setShowAddCategory(true)} disabled={busy}>+ Add Category</button>
            )}
          </div>
          {!simplifiedForPurchase && (
           <div>
              <label className="label">Supplier</label>
             <select className="input" value={form.supplierId} onChange={set('supplierId')} disabled={busy}>
                <option value="">— None —</option>
               {(suppliers || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {onAddSupplier && <button type="button" className="mt-1.5 text-xs font-semibold text-moss-700 hover:underline block" onClick={onAddSupplier} disabled={busy}>+ Add new supplier</button>}
            </div>
          )}
        </div>

        {simplifiedForPurchase ? (
          <div>
            <label className="label">Selling price (KES)</label>
            <input type="number" min="0.01" step="0.01" className="input" value={form.sellingPrice} onChange={set('sellingPrice')} disabled={busy} required />
            <p className="mt-1 text-xs text-ink-400">Stock starts at 0. Go back to the purchase form to record what was actually received and its cost.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Buying price (KES)</label><input type="number" min="0" step="0.01" className="input" value={form.costPrice} onChange={set('costPrice')} disabled={busy} required /></div>
            <div><label className="label">Selling price (KES)</label><input type="number" min="0.01" step="0.01" className="input" value={form.sellingPrice} onChange={set('sellingPrice')} disabled={busy} required /></div>
          </div>
        )}

        {!simplifiedForPurchase && (
         <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Stock qty</label>
              <input type="number" min="0" className="input disabled:bg-ink-50 disabled:text-ink-400" value={form.stock} onChange={set('stock')} disabled={!!initialProduct || busy} required={!initialProduct} />
              {initialProduct && <p className="mt-1 text-[11px] text-ink-400">Stock quantity is changed via Purchases, Sales, or Stock Take.</p>}
            </div>
            <div><label className="label">Low stock alert</label><input type="number" min="0" className="input" value={form.lowStockThreshold} onChange={set('lowStockThreshold')} disabled={busy} /></div>
          </div>
        )}

        <div>
          <label className="label">Description <span className="text-ink-300 font-normal normal-case">(optional)</span></label>
          <textarea className="input !min-h-[70px]" rows={2} value={form.description} onChange={set('description')} placeholder="Product details or specifications" disabled={busy} />
        </div>

        {Number(form.sellingPrice) > 0 && Number(form.costPrice) > 0 && Number(form.sellingPrice) <= Number(form.costPrice) && (
          <p className="text-xs text-rust-600 font-medium">⚠️ Selling price is at or below cost — you'll make no profit on this item.</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={handleClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {initialProduct ? 'Saving...' : 'Adding Product...'}
              </span>
            ) : (initialProduct ? 'Save changes' : 'Add product')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
