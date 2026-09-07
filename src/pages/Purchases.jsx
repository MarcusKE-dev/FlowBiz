import { useEffect, useMemo, useState } from 'react';
import { doc, writeBatch, serverTimestamp, orderBy, where, limit, addDoc, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { tenantQuery, tenantCollection, withBusiness } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { findProductByCode } from '../utils/scannerService';
import { productUnit, normalizeQuantity } from '../utils/lineItems';
import { DEFAULT_UNIT, getUnit, unitStep, formatQuantityWithUnit } from '../industry/units';
import { useIndustry } from '../hooks/useIndustry';
import { buildBatchDocument, isValidExpiryDate, todayISO } from '../utils/batches';
import { createProduct } from '../utils/products';
import { variantsOf } from '../utils/variants';
import { resolveReceiptDeltas, hasPackSize, packSizeOf, packUnitOf, toBaseQuantity } from '../utils/inventory';
import { applyStockDeltas } from '../utils/stockWrites';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ProductFormModal from '../components/products/ProductFormModal';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import ScannerModal from '../components/scanner/ScannerModal';
import ScanFab from '../components/scanner/ScanFab';
import PageHeader from '../components/ui/PageHeader';
import Section from '../components/ui/Section';
import DataTable from '../components/ui/DataTable';
import StatusPill from '../components/ui/StatusPill';
import Money from '../components/ui/Money';
import { formatDateTime } from '../utils/dateRanges';
import { roundMoney } from '../utils/currency';
import { raceWithTimeout } from '../utils/offlineWrite';
import { friendlyErrorMessage } from '../utils/errorMessages';

const empty = {
  supplierId: '', productId: '', variantId: '', quantity: '', costPricePerUnit: '',
  // Is `quantity` counted in packs or in singles? Only ever asked when
  // the selected product actually has a pack size.
  receiveAsPack: false,
  paymentStatus: 'paid', paymentMethod: 'Cash', mpesaCode: '',
  // Pharmacy only. Absent from every other profile's form and from every
  // purchase document those profiles write.
  batchNumber: '', expiryDate: '',
};

export default function Purchases() {
  const { profile, businessId } = useAuth();
  const industry = useIndustry();
  const batchesOn = industry.can('batches');
  const productsQ = useMemo(() => (businessId ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name')) : null), [businessId]);
  const suppliersQ = useMemo(() => (businessId ? tenantQuery('suppliers', businessId, orderBy('name')) : null), [businessId]);
  const purchasesQ = useMemo(() => (businessId ? tenantQuery('purchases', businessId, orderBy('purchasedAt', 'desc'), limit(50)) : null), [businessId]);

  const { data: products } = useFirestoreCollection(productsQ);
  const { data: suppliers, refetch: refetchSuppliers } = useFirestoreCollection(suppliersQ);
  const { data: purchases, loading } = useFirestoreCollection(purchasesQ);

  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [productModal, setProductModal] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState(null);
  const [prefillBarcode, setPrefillBarcode] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));
  // Changing the product clears the chosen version — a "Black / M" picked
  // on a shirt must never survive into a delivery of shoes. Done in the
  // handler rather than an effect so there is no render where the form
  // holds a version that belongs to a different product.
  const setProductId = (e) => setForm((p) => ({ ...p, productId: e.target.value, variantId: '', receiveAsPack: false }));

  useEffect(() => {
    if (newSupplierId) setForm((p) => ({ ...p, supplierId: newSupplierId }));
  }, [newSupplierId]);


  const selProd = products.find((p) => p.id === form.productId);
  const selSupp = suppliers.find((s) => s.id === form.supplierId);
  // A boutique can define sizes and colours, but until now had no way to
  // RECEIVE any: this form wrote `stock` and never `variantStock`, so the
  // per-version figures the counter sells against stayed at zero forever.
  // Receiving a versioned product therefore requires choosing the version,
  // and the write moves the version and the product total together.
  const productVariants = useMemo(() => (selProd ? variantsOf(selProd) : []), [selProd]);
  const needsVariant = productVariants.length > 0;
  const selVariant = productVariants.find((v) => v.id === form.variantId) || null;

  // Pack and single. A crate of 24 is received as one crate and booked in
  // as 24 bottles; the conversion is done by the ONE inventory foundation
  // at the moment the delta is resolved, so nothing downstream — stock,
  // valuation, the counter, reports — ever sees a crate.
  const packSizesOn = industry.can('packSizes');
  const offersPacks = packSizesOn && hasPackSize(selProd);
  const receivingPacks = offersPacks && form.receiveAsPack;
  const packSize = packSizeOf(selProd);
  const packUnitShort = offersPacks ? getUnit(packUnitOf(selProd)).short : null;
  // The product's OWN unit — the one stock is held in and every downstream
  // figure is counted in. Declared before `entryUnit`, which is derived
  // from it: `const` bindings are in the temporal dead zone until the line
  // that declares them runs, so reading this from above would throw on
  // every single render of the page rather than only in some edge case.
  //
  // Receiving 12.5 m of cable is the same arithmetic as selling it, so it
  // goes through the same unit rounding — see industry/units.js.
  const purchaseUnit = productUnit(selProd);
  const purchaseUnitShort = getUnit(purchaseUnit).short;
  const isMeasuredPurchase = purchaseUnit !== DEFAULT_UNIT;
  // The unit the QUANTITY box is counted in, which is the pack when one
  // is being received and the product's own unit otherwise.
  const entryUnit = receivingPacks ? packUnitOf(selProd) : purchaseUnit;
  const baseQuantity = toBaseQuantity(
    selProd, normalizeQuantity(form.quantity, entryUnit),
    { pack: receivingPacks, packSizes: packSizesOn }
  );
  // The cost typed is the cost per THING RECEIVED — per crate when a crate
  // is being received — because that is what the delivery note says. The
  // per-single cost stored on the product is derived from it below.
  const totalCost = roundMoney(normalizeQuantity(form.quantity, entryUnit) * (Number(form.costPricePerUnit) || 0));

  const handleScanDetected = (code) => {
    setScannerOpen(false);
    const found = findProductByCode(products, code);
    if (found) {
      setForm((p) => ({ ...p, productId: found.id, costPricePerUnit: found.costPrice || p.costPricePerUnit }));
      toast.success(`Selected ${found.name}`);
    } else {
      setPrefillBarcode(code);
      setProductModal(true);
    }
  };

  useHardwareScanner(handleScanDetected, { enabled: !productModal && !supplierModal && !scannerOpen });

  const handle = async (e) => {
    e.preventDefault();
    if (!form.supplierId) {
      toast.error('Please select a supplier.');
      return;
    }
    if (!form.productId) {
      toast.error('Please select a product.');
      return;
    }
    if (needsVariant && !form.variantId) {
      toast.error('Choose which version this delivery is.');
      return;
    }
    if (!form.quantity || !form.costPricePerUnit) {
      toast.error('Enter both a quantity and a cost price.');
      return;
    }
    if (form.paymentStatus === 'paid' && form.paymentMethod === 'M-Pesa' && !form.mpesaCode.trim()) {
      toast.error('Enter M-Pesa transaction code.');
      return;
    }
    if (batchesOn && form.expiryDate && !isValidExpiryDate(form.expiryDate)) {
      toast.error('Enter the expiry date as it is printed on the box.');
      return;
    }

    setBusy(true);
    try {
      const entered = normalizeQuantity(form.quantity, entryUnit);
      if (entered <= 0) throw new Error('Enter a quantity greater than zero.');
      // What actually goes on the shelf, in the unit the shop sells in.
      // The pack conversion is done by the ONE inventory foundation, not
      // here — this is the same call, with the same rounding, that the
      // stock delta below is resolved through, so the two can never
      // disagree about how many bottles a crate is.
      const qty = toBaseQuantity(selProd, entered, { pack: receivingPacks, packSizes: packSizesOn });
      if (qty <= 0) throw new Error('That is less than one whole item.');
      const enteredCost = Number(form.costPricePerUnit);
      const total = roundMoney(entered * enteredCost);
      // The product's cost price is always PER SINGLE, whatever the
      // delivery was counted in — otherwise a crate price of 2,400 would
      // become the cost of one bottle and every margin in the business
      // would read as a loss.
      const cost = receivingPacks ? roundMoney(enteredCost / packSize) : enteredCost;
      const batch = writeBatch(db);

      // Receiving goes through the ONE inventory foundation, exactly as a
      // sale does — so a versioned product moves `variantStock.<id>` and
      // `stock` in the SAME dotted-path write, and the two can never drift
      // apart. Both are Firestore increments, which is what keeps a
      // delivery booked in on two tills at once correct, and what lets the
      // whole batch queue as one mutation offline.
      //
      // Price and supplier are a plain overwrite rather than a movement,
      // so they ride along in the SAME product update rather than as a
      // second write to the same document.
      const productFields = { [form.productId]: { costPrice: cost } };
      if (form.supplierId) productFields[form.productId].supplierId = form.supplierId;

      applyStockDeltas(
        batch,
        resolveReceiptDeltas(
          [{
            productId: form.productId,
            quantity: entered,
            pack: receivingPacks,
            variantId: form.variantId || undefined,
          }],
          [selProd],
          { packSizes: packSizesOn }
        ),
        { productFields }
      );

      // With batch tracking on, receiving stock ALSO creates the batch
      // record — in the same write batch, so a pharmacy can never end up
      // with product stock that no batch accounts for. That invariant is
      // what makes FEFO trustworthy: the batch ledger always sums to the
      // product total.
      if (batchesOn) {
        const batchRef = doc(collection(db, 'productBatches'));
        batch.set(batchRef, withBusiness(buildBatchDocument({
          productId: form.productId,
          productName: selVariant ? `${selProd?.name || ''} (${selVariant.label})` : (selProd?.name || ''),
          batchNumber: form.batchNumber,
          expiryDate: form.expiryDate,
          quantity: qty,
          costPrice: cost,
          supplierId: form.supplierId || null,
          supplierName: selSupp?.name || null,
          unit: purchaseUnit,
          receivedBy: profile.uid,
          receivedByName: profile.displayName,
        }), businessId));
      }

      const purchRef = doc(collection(db, 'purchases'));
      batch.set(
        purchRef,
        withBusiness(
          {
            supplierId: form.supplierId,
            supplierName: selSupp?.name || '',
            productId: form.productId,
            productName: selProd?.name || '',
            quantity: qty,
            ...(isMeasuredPurchase ? { unit: purchaseUnit } : {}),
            ...(selVariant ? { variantId: selVariant.id, variantLabel: selVariant.label } : {}),
            ...(receivingPacks ? {
              packsReceived: entered,
              packUnit: packUnitOf(selProd),
              packSize,
              costPricePerPack: enteredCost,
            } : {}),
            ...(batchesOn && form.batchNumber.trim() ? { batchNumber: form.batchNumber.trim() } : {}),
            ...(batchesOn && isValidExpiryDate(form.expiryDate) ? { expiryDate: form.expiryDate } : {}),
            costPricePerUnit: cost,
            totalCost: total,
            purchasedBy: profile.uid,
            purchasedByName: profile.displayName,
            purchasedAt: new Date(),
            paymentStatus: form.paymentStatus === 'paid' ? 'paid' : 'pending_supplier_credit',
            paymentMethod: form.paymentStatus === 'paid' ? form.paymentMethod : null,
            mpesaCode: form.paymentStatus === 'paid' && form.paymentMethod === 'M-Pesa' ? form.mpesaCode.trim() : null,
          },
          businessId
        )
      );

      const commit = batch.commit();
      const { queuedOffline, error } = await raceWithTimeout(commit, 4000);
      if (error) throw error;

      toast.success(queuedOffline ? 'Purchase saved offline. It will sync when you reconnect.' : 'Purchase recorded and stock updated');
      if (queuedOffline) commit.catch((err) => toast.error(`A purchase from earlier couldn't be saved: ${friendlyErrorMessage(err)}`));

      setForm(empty);
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSupplierSave = async (supplierData) => {
    const write = addDoc(tenantCollection('suppliers'), withBusiness({ ...supplierData, createdAt: serverTimestamp() }, businessId));
    const { queuedOffline, value: ref, error } = await raceWithTimeout(write, 4000);
    if (error) { toast.error(friendlyErrorMessage(error)); throw error; }
    if (ref?.id) {
      setNewSupplierId(ref.id);
      await refetchSuppliers();
    }
    setSupplierModal(false);
    toast.success(queuedOffline ? 'Saved offline. It will sync when you reconnect.' : 'Supplier added');
  };

  const hasSuppliers = suppliers && suppliers.length > 0;
  const hasProducts = products && products.length > 0;

  return (
    // Full width. The tables and strips below run to the edge of the
    // content area, which a centred column would stop short of; the
    // 1800px ceiling lives in AppShell so every page shares one.
    <div className="space-y-6">
      <PageHeader
        title="Purchases"
        description="Record stock received from a supplier."
      />
      {/* An entry form wants a measure, not width — a 1,800px text input
          is not an improvement. Edge to edge on a phone, a contained
          card once there is room for one. */}
      <form onSubmit={handle} className="panel-measure space-y-4 p-4 sm:max-w-2xl">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Supplier</label>
            <select className="input" value={form.supplierId} onChange={set('supplierId')} required>
              <option value="" disabled>{hasSuppliers ? 'Select a supplier' : 'No suppliers yet'}</option>
              {hasSuppliers && suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button type="button" className="mt-2 text-secondary font-medium text-primary-700 hover:underline" onClick={() => setSupplierModal(true)}>Add a supplier</button>
          </div>
          <div>
            <label className="label">Product</label>
            <select className="input" value={form.productId} onChange={setProductId} required>
              <option value="" disabled>{hasProducts ? 'Select a product' : 'No products yet'}</option>
              {hasProducts && products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button type="button" className="mt-2 text-secondary font-medium text-primary-700 hover:underline" onClick={() => { setPrefillBarcode(null); setProductModal(true); }}>Add a product</button>
          </div>
        </div>
        {needsVariant && (
          <div>
            <label className="label">Which version?</label>
            <select className="input" value={form.variantId} onChange={set('variantId')} required>
              <option value="" disabled>Select a version</option>
              {productVariants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} · {formatQuantityWithUnit(v.stock, selProd?.unit, { showPiece: true })} in stock
                </option>
              ))}
            </select>
            <p className="mt-1 text-secondary text-ink-400">
              This delivery is booked in against the version you choose, and the product total goes up by the same amount.
            </p>
          </div>
        )}
        {offersPacks && (
          <div>
            <span className="label">Received as</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, receiveAsPack: false }))}
                className={`rounded-control border text-button transition-colors ${!form.receiveAsPack ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-line text-ink-600 hover:bg-ink-50'}`}
              >
                Single {getUnit(purchaseUnit).label.toLowerCase()}s
              </button>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, receiveAsPack: true }))}
                className={`rounded-control border text-button transition-colors ${form.receiveAsPack ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-line text-ink-600 hover:bg-ink-50'}`}
              >
                {getUnit(packUnitOf(selProd)).label}s of {packSize}
              </button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">
              Qty received
              {(isMeasuredPurchase || receivingPacks) && (
                <span className="ml-1 font-normal normal-case text-ink-400">
                  ({receivingPacks ? packUnitShort : purchaseUnitShort})
                </span>
              )}
            </label>
            <input
              type="number"
              min={unitStep(entryUnit)}
              step={unitStep(entryUnit)}
              inputMode={unitStep(entryUnit) === 1 ? 'numeric' : 'decimal'}
              className="input"
              value={form.quantity}
              onChange={set('quantity')}
              required
            />
            {receivingPacks && baseQuantity > 0 && (
              <p className="mt-1 text-secondary text-ink-400">
                Adds <span className="num font-medium text-ink-600">{formatQuantityWithUnit(baseQuantity, purchaseUnit, { showPiece: true })}</span> to stock.
              </p>
            )}
          </div>
          <div>
            <label className="label">
              Cost / {receivingPacks ? packUnitShort : (isMeasuredPurchase ? purchaseUnitShort : 'unit')} (KES)
            </label>
            <input type="number" min="0" step="0.01" className="input" value={form.costPricePerUnit} onChange={set('costPricePerUnit')} required />
          </div>
        </div>
        {batchesOn && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Batch number <span className="text-ink-300 font-normal normal-case">(optional)</span></label>
              <input
                className="input font-mono"
                value={form.batchNumber}
                onChange={set('batchNumber')}
                placeholder="As printed on the box"
              />
            </div>
            <div>
              <label className="label">Expiry date</label>
              <input
                type="date"
                className="input"
                value={form.expiryDate}
                min={todayISO()}
                onChange={set('expiryDate')}
              />
              <p className="mt-1 text-secondary text-ink-400">
                Stock is sold earliest-expiry-first. Leave blank only if the pack carries no expiry.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-baseline justify-between rounded-control border border-line bg-ink-50 px-3 py-2 text-body text-ink-600">
          <span>Total cost</span>
          <span className="font-semibold text-ink-900"><Money value={totalCost} /></span>
        </div>
        <div>
          <label className="label">Payment status</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setForm((p) => ({ ...p, paymentStatus: 'paid' }))} className={`rounded-control border text-button transition-colors ${form.paymentStatus === 'paid' ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-line text-ink-600 hover:bg-ink-50'}`}>Paid now</button>
            <button type="button" onClick={() => setForm((p) => ({ ...p, paymentStatus: 'credit' }))} className={`rounded-control border text-button transition-colors ${form.paymentStatus === 'credit' ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-line text-ink-600 hover:bg-ink-50'}`}>On credit</button>
          </div>
        </div>
        {form.paymentStatus === 'paid' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Paid via</label>
              <select className="input" value={form.paymentMethod} onChange={set('paymentMethod')}>
                <option value="Cash">Cash</option>
                <option value="M-Pesa">M-Pesa</option>
              </select>
            </div>
            {form.paymentMethod === 'M-Pesa' && (
              <div>
                <label className="label">M-Pesa code</label>
                <input className="input uppercase" value={form.mpesaCode} onChange={set('mpesaCode')} placeholder="e.g. QWE1234567" required />
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end border-t border-divider pt-4">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Record purchase'}
          </button>
        </div>
      </form>

      <ScanFab onClick={() => setScannerOpen(true)} label="Scan" />
      <ScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScanDetected} />

      <ProductFormModal
        allProducts={products}
        open={productModal}
        onClose={() => { setProductModal(false); setPrefillBarcode(null); }}
        prefillSupplierId={form.supplierId || null}
        onSave={async (data) => {
          try {
            const { id, queuedOffline } = await createProduct(data, businessId);
            setForm((p) => ({
              ...p,
              productId: id,
              supplierId: data.supplierId || p.supplierId || '',
              costPricePerUnit: data.costPrice || p.costPricePerUnit,
            }));
            setProductModal(false);
            setPrefillBarcode(null);
            toast.success(queuedOffline ? 'Saved offline. It will sync when you reconnect.' : 'Product added and selected');
            // Returned so ProductFormModal can attach a photo to the new product.
            return { id };
          } catch (err) {
            toast.error(friendlyErrorMessage(err));
            throw err;
          }
        }}
        suppliers={suppliers}
        prefillBarcode={prefillBarcode}
        onAddSupplier={() => setSupplierModal(true)}
        newSupplierId={newSupplierId}
        productCount={products.length}
        simplifiedForPurchase
      />
      <SupplierFormModal open={supplierModal} onClose={() => setSupplierModal(false)} onSave={handleSupplierSave} />
      <Section title="Recent purchases">
        {loading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            bleed
            caption="Recent stock purchases"
            rows={purchases}
            rowKey={(p) => p.id}
            mobileLayout="row"
            columns={[
              {
                key: 'productName',
                header: 'Purchase',
                primary: true,
                render: (p) => (
                  <span className="text-ink-900">
                    <span className="num">{formatQuantityWithUnit(p.quantity, p.unit)}</span> × {p.productName}
                    {p.variantLabel && <span className="text-ink-500"> ({p.variantLabel})</span>}
                  </span>
                ),
              },
              { key: 'supplierName', header: 'Supplier', render: (p) => <span className="text-ink-600">{p.supplierName || 'Supplier'}</span> },
              { key: 'purchasedAt', header: 'Date', render: (p) => <span className="text-ink-600">{formatDateTime(p.purchasedAt)}</span> },
              {
                key: 'paymentStatus',
                header: 'Status',
                mobileTrailing: true,
                render: (p) =>
                  p.paymentStatus === 'paid'
                    ? <StatusPill tone="positive">Paid</StatusPill>
                    : <StatusPill tone="caution">On credit</StatusPill>,
              },
              {
                key: 'totalCost',
                header: 'Total cost',
                numeric: true,
                mobileTrailing: true,
                render: (p) => <span className="font-semibold"><Money value={p.totalCost} /></span>,
              },
            ]}
            empty={<EmptyState title="No purchases yet" description="Stock you record above will be listed here." />}
          />
        )}
      </Section>
    </div>
  );
}