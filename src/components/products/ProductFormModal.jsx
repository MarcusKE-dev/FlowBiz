import { AlertTriangle, ImagePlus, Trash2, Package } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { raceWithTimeout } from '../../utils/offlineWrite';
import { optimizeImage, formatBytes } from '../../utils/imageOptimizer';
import { uploadProductImage } from '../../utils/productImages';

const empty = {
  name: '',
  category: '',
  costPrice: '',
  sellingPrice: '',
  stock: '',
  lowStockThreshold: '5',
  supplierId: '',
  barcode: '',
  description: '',
};

const FREE_PLAN_PRODUCT_LIMIT = 100;

export default function ProductFormModal({
  open,
  onClose,
  onSave,
  suppliers = [],
  initialProduct = null,
  prefillBarcode = null,
  prefillSupplierId = null,
  onAddSupplier,
  newSupplierId,
  simplifiedForPurchase = false,
  productCount = 0,
}) {
  const { businessId, isPro } = useAuth();
  const { settings } = useSettings();
  const categories = settings.categories;
  const [form, setForm] = useState(empty);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [busy, setBusy] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);

  // Product image. `imageUrl` is whatever is already stored; `pending`
  // holds a freshly-optimised blob that has not been uploaded yet.
  // Uploading is entirely optional — a product with no image saves
  // exactly as it always has.
  const [imageUrl, setImageUrl] = useState(null);
  const [pendingImage, setPendingImage] = useState(null);
  const [imageWarning, setImageWarning] = useState(null);
  const [imageError, setImageError] = useState(null);
  const [optimising, setOptimising] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);

  // Only true if we are editing an existing product that already has a Firestore document ID
  const isEditing = Boolean(initialProduct && initialProduct.id);

  const previewUrlRef = useRef(null);
  const revokePreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };

  // Sync form state when modal opens
  useEffect(() => {
    setBusy(false);
    setShowAddCategory(false);
    setNewCategoryName('');
    revokePreview();
    setPendingImage(null);
    setImageWarning(null);
    setImageError(null);
    setOptimising(false);
    setRemoveImage(false);
    setImageUrl(open && initialProduct?.imageUrl ? initialProduct.imageUrl : null);
    if (open) {
      if (initialProduct && initialProduct.id) {
        setForm({
          ...empty,
          ...initialProduct,
          category: initialProduct.category || '',
          costPrice: initialProduct.costPrice ?? '',
          sellingPrice: initialProduct.sellingPrice ?? '',
          stock: initialProduct.stock ?? '',
          lowStockThreshold: initialProduct.lowStockThreshold ?? '5',
          supplierId: initialProduct.supplierId || '',
          barcode: initialProduct.barcode || '',
          description: initialProduct.description || '',
        });
      } else {
        setForm({
          ...empty,
          barcode: prefillBarcode || '',
          category: '', // Starts empty with "— Select Category —"
          supplierId: prefillSupplierId || initialProduct?.supplierId || '',
        });
      }
    }
  }, [initialProduct, prefillBarcode, prefillSupplierId, open]);

  useEffect(() => {
    if (newSupplierId) {
      setForm((prev) => ({ ...prev, supplierId: newSupplierId }));
    }
  }, [newSupplierId]);

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const handlePickImage = async (e) => {
    const file = e.target.files?.[0];
    // Let the same file be chosen again after a remove.
    e.target.value = '';
    if (!file) return;
    setImageError(null);
    setImageWarning(null);
    setOptimising(true);
    try {
      const result = await optimizeImage(file);
      // One object URL per pick, revoked as soon as it is replaced.
      revokePreview();
      previewUrlRef.current = URL.createObjectURL(result.blob);
      setPendingImage({ ...result, previewUrl: previewUrlRef.current });
      setImageWarning(result.warning);
      setRemoveImage(false);
    } catch (err) {
      setImageError(err.message || 'That image could not be processed.');
      setPendingImage(null);
    } finally {
      setOptimising(false);
    }
  };

  const handleRemoveImage = () => {
    if (pendingImage) {
      // Only discard the unsaved pick; whatever is already stored stays.
      revokePreview();
      setPendingImage(null);
      setImageWarning(null);
      setImageError(null);
      return;
    }
    setImageUrl(null);
    setRemoveImage(true);
  };

  const shownImage = pendingImage?.previewUrl || imageUrl;

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed || savingCategory) return;
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Category already exists.');
      return;
    }
    const updated = [...categories, trimmed];
    setSavingCategory(true);
    const write = setDoc(
      doc(db, 'businessSettings', businessId),
      { categories: updated },
      { merge: true }
    );
    const { queuedOffline, error } = await raceWithTimeout(write, 4000);
    setSavingCategory(false);
    if (error) {
      toast.error('Failed to add category: ' + error.message);
      return;
    }
    setForm((prev) => ({ ...prev, category: trimmed }));
    setShowAddCategory(false);
    setNewCategoryName('');
    toast.success(queuedOffline ? "Saved — it'll sync once you're back online." : 'Category added');
  };

  const handle = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || busy) return;
    if (!form.category) {
      toast.error('Please select a category.');
      return;
    }
    if (!simplifiedForPurchase && Number(form.costPrice) < 0) {
      toast.error('Cost price cannot be negative.');
      return;
    }
    if (Number(form.sellingPrice) <= 0) {
      toast.error('Selling price must be greater than zero.');
      return;
    }
    if (!isEditing && !simplifiedForPurchase && Number(form.stock) < 0) {
      toast.error('Stock cannot be negative.');
      return;
    }

    if (!isEditing && !isPro && productCount >= FREE_PLAN_PRODUCT_LIMIT) {
      toast.error(`Free plan is limited to ${FREE_PLAN_PRODUCT_LIMIT} products. Upgrade to FlowBiz Pro to add more.`);
      return;
    }

    const barcodeVal = form.barcode.trim();
    if (barcodeVal && /^FB-\d{6}$/i.test(barcodeVal)) {
      toast.error("That looks like an internal code, not a barcode. Scan or enter the item's manufacturer barcode.");
      return;
    }

    setBusy(true);
    try {
      const costPriceVal = simplifiedForPurchase ? 0 : (Number(form.costPrice) || 0);
      const sellingPriceVal = Number(form.sellingPrice) || 0;
      const stockVal = isEditing
        ? (Number(initialProduct.stock) || 0)
        : (simplifiedForPurchase ? 0 : (Number(form.stock) || 0));
      const thresholdVal = simplifiedForPurchase ? 5 : (Number(form.lowStockThreshold) || 5);

      const payload = {
        name: form.name.trim(),
        category: form.category,
        costPrice: costPriceVal,
        sellingPrice: sellingPriceVal,
        stock: stockVal,
        lowStockThreshold: thresholdVal,
        supplierId: form.supplierId || null,
        barcode: form.barcode.trim() || null,
        description: form.description.trim(),
      };
      // Clearing an existing photo is part of the same save.
      if (removeImage && !pendingImage) payload.imageUrl = null;

      const saved = await onSave(payload);

      // The image is uploaded AFTER the product exists, because the
      // storage filename is keyed to the product id. The download URL is
      // then written back as a separate merge — deliberately not base64
      // in the product document, which is read through a live
      // onSnapshot and would re-ship the image to every device on every
      // change.
      if (pendingImage) {
        const productId = isEditing ? initialProduct.id : saved?.id;
        if (!productId) {
          toast.error('The product was saved, but its photo could not be attached. Edit the product to add it.');
        } else {
          try {
            const url = await uploadProductImage({
              businessId,
              productId,
              blob: pendingImage.blob,
              contentType: pendingImage.type,
              extension: pendingImage.extension,
            });
            await setDoc(doc(db, 'products', productId), { imageUrl: url }, { merge: true });
          } catch (err) {
            console.error('Product image upload failed:', err);
            toast.error('The product was saved, but its photo did not upload. Try again from Edit.');
          }
        }
      }
    } catch {
      // Handled by onSave
    } finally {
      // Guarantees the button is never stuck on "Saving..."
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (!busy) onClose();
  };

  const hasSuppliers = suppliers && suppliers.length > 0;

  return (
    <Modal open={open} onClose={handleClose} title={isEditing ? 'Edit product' : 'Add product'}>
      <form onSubmit={handle} className="space-y-3">
        <div>
          <label className="label">Product name</label>
          <input className="input" value={form.name} onChange={set('name')} disabled={busy} required autoFocus />
        </div>

        {isEditing && initialProduct?.internalCode && (
          <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
            Internal code: <span className="font-mono font-semibold text-ink-700">{initialProduct.internalCode}</span>
          </div>
        )}

        <div>
          <label className="label">Barcode <span className="text-ink-300 font-normal normal-case">(optional)</span></label>
          <input className="input font-mono" value={form.barcode} onChange={set('barcode')} placeholder="Scan or type manufacturer barcode" disabled={busy} />
          {!isEditing && <p className="mt-1 text-xs text-ink-400">Leave blank if this product doesn't have a barcode.</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={set('category')} disabled={busy} required>
              <option value="" disabled>— Select Category —</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {showAddCategory ? (
              <div className="mt-2 space-y-2 rounded-lg bg-ink-50 p-2.5">
                <label className="text-[11px] font-semibold text-ink-700 uppercase tracking-wide">New Category</label>
                <input
                  className="input !py-1 !min-h-0 text-xs"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Accessories"
                  disabled={busy || savingCategory}
                  autoFocus
                />
                <div className="flex gap-1.5 justify-end">
                  <button type="button" className="btn-secondary !py-1 !px-2.5 !min-h-0 text-xs" onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }} disabled={busy || savingCategory}>Cancel</button>
                  <button type="button" className="btn-primary !py-1 !px-2.5 !min-h-0 text-xs" onClick={handleAddCategory} disabled={busy || savingCategory}>{savingCategory ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            ) : (
              <button type="button" className="mt-1.5 text-secondary font-medium text-primary-700 hover:underline block" onClick={() => setShowAddCategory(true)} disabled={busy}>+ Add Category</button>
            )}
          </div>

          <div>
            <label className="label">Supplier <span className="text-ink-300 font-normal normal-case">(optional)</span></label>
            <select className="input" value={form.supplierId || ''} onChange={set('supplierId')} disabled={busy}>
              <option value="">{hasSuppliers ? '— Select Supplier —' : '— None (No Suppliers) —'}</option>
              {hasSuppliers && suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {onAddSupplier && (
              <button type="button" className="mt-1.5 text-secondary font-medium text-primary-700 hover:underline block" onClick={onAddSupplier} disabled={busy}>+ Add new supplier</button>
            )}
          </div>
        </div>

        {simplifiedForPurchase ? (
          <div>
            <label className="label">Selling price (KES)</label>
            <input type="number" min="0.01" step="0.01" className="input" value={form.sellingPrice} onChange={set('sellingPrice')} disabled={busy} required />
            <p className="mt-1 text-xs text-ink-400">Stock &amp; buying cost will be recorded in the purchase form.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Buying price (KES)</label>
              <input type="number" min="0" step="0.01" className="input" value={form.costPrice} onChange={set('costPrice')} disabled={busy} required />
            </div>
            <div>
              <label className="label">Selling price (KES)</label>
              <input type="number" min="0.01" step="0.01" className="input" value={form.sellingPrice} onChange={set('sellingPrice')} disabled={busy} required />
            </div>
          </div>
        )}

        {!simplifiedForPurchase && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Stock qty</label>
              <input type="number" min="0" className="input disabled:bg-ink-50 disabled:text-ink-400" value={form.stock} onChange={set('stock')} disabled={isEditing || busy} required={!isEditing} />
              {isEditing && <p className="mt-1 text-[11px] text-ink-400">Stock is managed via Purchases, Sales, or Stock Take.</p>}
            </div>
            <div>
              <label className="label">Low stock alert</label>
              <input type="number" min="0" className="input" value={form.lowStockThreshold} onChange={set('lowStockThreshold')} disabled={busy} />
            </div>
          </div>
        )}

        <div>
          <span className="label">Photo <span className="font-normal normal-case text-ink-400">(optional)</span></span>
          <div className="flex items-start gap-3">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-control border border-line bg-ink-50 text-ink-400">
              {shownImage
                ? <img src={shownImage} alt="" className="h-full w-full object-cover" />
                : <Package className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />}
            </span>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap gap-2">
                <label className="btn-secondary cursor-pointer">
                  <ImagePlus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  {shownImage ? 'Replace photo' : 'Add photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handlePickImage}
                    disabled={busy || optimising}
                  />
                </label>
                {shownImage && (
                  <button
                    type="button"
                    className="btn-ghost text-ink-600 hover:text-danger-700"
                    onClick={handleRemoveImage}
                    disabled={busy || optimising}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Remove
                  </button>
                )}
              </div>

              {optimising && <p className="text-secondary text-ink-500">Compressing…</p>}

              {pendingImage && !optimising && (
                <p className="num text-secondary text-ink-500">
                  {formatBytes(pendingImage.originalBytes)} to {formatBytes(pendingImage.bytes)}
                  {' · '}{pendingImage.width}×{pendingImage.height}
                  {' · '}{pendingImage.extension.toUpperCase()}
                </p>
              )}

              {imageError && (
                <p className="flex items-start gap-1.5 text-secondary text-danger-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  {imageError}
                </p>
              )}
              {imageWarning && !imageError && (
                <p className="flex items-start gap-1.5 text-secondary text-warning-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  {imageWarning}
                </p>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="label">Description <span className="text-ink-300 font-normal normal-case">(optional)</span></label>
          <textarea className="input !min-h-[70px]" rows={2} value={form.description} onChange={set('description')} placeholder="Product details or notes" disabled={busy} />
        </div>

        {Number(form.sellingPrice) > 0 && Number(form.costPrice) > 0 && Number(form.sellingPrice) <= Number(form.costPrice) && (
          <p className="flex items-start gap-1.5 text-secondary text-danger-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />Selling price is at or below cost — you will make no profit on this item.</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={handleClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {isEditing ? 'Saving...' : 'Adding Product...'}
              </span>
            ) : (isEditing ? 'Save changes' : 'Add product')}
          </button>
        </div>
      </form>
    </Modal>
  );
}