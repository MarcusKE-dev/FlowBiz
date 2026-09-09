import { AlertTriangle, ImagePlus, Trash2, Package } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import SegmentedControl from '../ui/SegmentedControl';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useIndustry } from '../../hooks/useIndustry';
import { useSettings } from '../../contexts/SettingsContext';
import { categoryWritePayload } from '../../industry/categories';
import { UNITS, DEFAULT_UNIT, unitStep, unitOptionGroups, roundQuantity, formatQuantityWithUnit } from '../../industry/units';
import { MAX_PACK_SIZE } from '../../utils/inventory';
import VariantEditor from './VariantEditor';
import ModifierEditor from './ModifierEditor';
import RecipeEditor from './RecipeEditor';
import {
  CATALOG_ROLES, catalogRoleOf, catalogRoleField,
} from '../../domain/fnb/catalog';
import { stationOptions, DEFAULT_STATION, MAX_STATION_NAME } from '../../domain/fnb/stations';
import { normalizeModifierGroups } from '../../utils/modifiers';
import { generateVariants, hasVariants, totalVariantStock } from '../../utils/variants';
import { findBarcodeClash } from '../../utils/scannerService';
import { raceWithTimeout } from '../../utils/offlineWrite';
import { friendlyErrorMessage } from '../../utils/errorMessages';
import { optimizeImage, formatBytes, blobToDataUrl } from '../../utils/imageOptimizer';
import ProUpgradePrompt from '../common/ProUpgradePrompt';
import { ENTITLEMENTS } from '../../licensing';
import {
  saveProductImage, deleteProductImage, loadProductImage,
  staticImageUrl, needsSidecarFetch, CLEARED_IMAGE_FIELDS,
} from '../../utils/productImages';

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
  // Absent on every product that predates measured units, and written
  // only when it is not `piece` — see utils/lineItems.js.
  unit: DEFAULT_UNIT,
  // Pack and single. Absent on every product that predates the packSizes
  // capability, and read as "no pack" when absent — which is the identity
  // conversion, so nothing changes for a product that has none.
  packUnit: '',
  packSize: '',
  // Age-restricted goods. Absent means unrestricted, so no existing
  // product changes and nothing new is asked of a shop that sells none.
  ageRestricted: false,
  // 'product' or 'service'. Absent on every product that predates the
  // services capability, and read as 'product' when absent.
  kind: 'product',
};

const FREE_PLAN_PRODUCT_LIMIT = 100;

export default function ProductFormModal({
  open,
  onClose,
  onSave,
  suppliers = [],
  // The catalogue, so the recipe editor can offer ingredients. Optional:
  // a caller that does not pass it simply gets an empty ingredient list.
  allProducts = [],
  initialProduct = null,
  prefillBarcode = null,
  prefillSupplierId = null,
  onAddSupplier,
  newSupplierId,
  simplifiedForPurchase = false,
  productCount = 0,
}) {
  const { businessId, isPro, isOwner, entitlements } = useAuth();
  // CLOUD STORAGE IS A SERVICE, NOT A LICENCE. Storing a new photo
  // consumes hosted storage, so it needs an active annual services
  // entitlement — and firestore.rules refuses the write when there is
  // none. The UI has to know that BEFORE the save, or the merchant fills
  // in a form, picks a photo, saves, and gets a permission error from
  // Firestore. Existing photos are untouched and still display: nothing
  // here reads or deletes them.
  const canUseCloudStorage = entitlements?.can(ENTITLEMENTS.CLOUD_STORAGE) !== false;
  // PRODUCT PHOTOS ARE A LICENCE, NOT A SERVICE. Starter has no photo
  // entitlement at all; Pro and Lifetime do, and a Lifetime licence keeps
  // it when the annual services lapse. Asked of the one entitlement
  // resolver so this component owns no plan logic of its own.
  //
  // The picker below stays VISIBLE for Starter on purpose — a feature
  // nobody can see is a feature nobody buys — and offers the upgrade
  // prompt instead of a file dialog. firestore.rules refuses the write
  // regardless of what the browser does; this is the courteous half.
  const canUseProductPhotos = entitlements?.can(ENTITLEMENTS.PRODUCT_PHOTOS) === true;
  const industry = useIndustry();
  // The kitchen sections this business named, for the "Made at" picker.
  const { settings } = useSettings();
  // The business's own list if it has saved one, its trade's starting
  // list if it has not — resolved once, in the industry layer.
  const categories = industry.categories;
  // The unit picker is a hardware/supermarket tool. With the capability
  // off there is one unit, the form has one fewer field, and a saved
  // product carries no unit at all — which is what General Retail has
  // always done.
  const showUnits = industry.can('units');
  const showVariants = industry.can('variants');
  const showModifiers = industry.can('modifiers');
  const showRecipes = industry.can('recipes');
  const showProduction = industry.can('production');
  const showServices = industry.can('services');
  const showPackSizes = industry.can('packSizes');
  const showKitchen = industry.can('kitchen');
  const showStations = industry.can('kitchenStations');

  // The units this business is actually offered — the profile's list,
  // narrowed by whatever the owner chose on the Customize page. The form
  // used to list the WHOLE catalogue, so a salon was offered feet and
  // inches and a hardware shop was offered tots.
  //
  // A unit already saved on the product being edited is always included,
  // even if it is no longer offered: otherwise opening a product would
  // silently reset it to the first unit in the list and the next save
  // would change what the shop sells it by.
  const offeredUnitGroups = useMemo(() => {
    const offered = new Set(industry.units);
    if (initialProduct?.unit && UNITS[initialProduct.unit]) offered.add(initialProduct.unit);
    return unitOptionGroups()
      .map((group) => ({ ...group, units: group.units.filter((u) => offered.has(u.id)) }))
      .filter((group) => group.units.length > 0);
  }, [industry.units, initialProduct]);

  // The same rule as the unit picker above, for the same reason. A
  // category already saved on the product being edited is always offered,
  // even when the business's list no longer carries it — an owner may
  // hide a trade default (industry/categories.js keeps `hiddenCategories`
  // precisely so they can), and changing trade changes the defaults
  // outright, while the products pointing at the old word are untouched
  // by design.
  //
  // Without this the `<select>` matched no option, the required field
  // read as empty, and the owner could not save an edit to the PRICE of
  // an existing product without also re-categorising it.
  //
  // It is display only: adding a category still diffs against the
  // business's real list, so re-adding a legacy word puts it properly
  // back on the list rather than being refused as a duplicate.
  const offeredCategories = useMemo(() => {
    const saved = initialProduct?.category;
    if (!saved || categories.includes(saved)) return categories;
    return [saved, ...categories];
  }, [categories, initialProduct]);

  const showAgeRestriction = industry.can('ageRestriction');
  // The option definition being edited. Held separately from `form`
  // because it is a nested structure, not a text field.
  const [variantOptions, setVariantOptions] = useState([]);
  const [modifierGroups, setModifierGroups] = useState([]);
  const [recipe, setRecipe] = useState([]);
  const [producedInAdvance, setProducedInAdvance] = useState(false);
  // WHAT THIS ROW IS FOR: sold, cooked with, or both. Absent on every
  // product that predates the field, and `catalogRoleOf` reads absent as
  // `sellable`, so an existing catalogue in any industry opens exactly as
  // it always did.
  const [catalogRole, setCatalogRole] = useState(CATALOG_ROLES.SELLABLE);
  // The kitchen's own words for the item, and where it is made. Both are
  // snapshotted onto a ticket line when it is rung, so changing either
  // later never moves food that is already cooking.
  const [kitchenName, setKitchenName] = useState('');
  const [station, setStation] = useState(DEFAULT_STATION.id);
  const [routable, setRoutable] = useState(true);
  const [form, setForm] = useState(empty);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [busy, setBusy] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);

  // Product image. `imageUrl` is whatever is already stored — either a
  // plain URL on the product or the data URL fetched from its Firestore
  // sidecar; `pending` holds a freshly-optimised blob that has not been
  // saved yet. A photo is entirely optional — a product without one
  // saves exactly as it always has.
  const [imageUrl, setImageUrl] = useState(null);
  const [pendingImage, setPendingImage] = useState(null);
  const [imageWarning, setImageWarning] = useState(null);
  const [imageError, setImageError] = useState(null);
  const [optimising, setOptimising] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);
  // Whether the Starter merchant has asked for the photo picker and is
  // being shown what it takes. Off until they tap, so the form does not
  // open with a sales pitch already on it.
  const [showPhotoUpgrade, setShowPhotoUpgrade] = useState(false);

  // A barcode is what the till scans to decide WHICH product is being
  // sold, so two products carrying the same one make that decision
  // arbitrary — `barcodeIndex` holds one entry per barcode and the second
  // product silently overwrites the first's. Nothing stopped it being
  // typed, and the only symptom was the wrong item ringing up.
  //
  // `allProducts` is already loaded for the recipe editor below, so this
  // costs no read. It warns rather than blocks: a shop that already has a
  // clash must still be able to open the product and fix it.
  // The id of the product THIS form has just created, once it has one.
  // See findBarcodeClash: the catalogue listener reports a new product
  // before its save finishes, so without this the form ends up warning
  // about its own work. State rather than a ref because the warning below
  // has to recompute when it lands.
  const [createdId, setCreatedId] = useState(null);

  const barcodeClash = useMemo(() => {
    // A save in flight is exactly the window in which the listener starts
    // reporting the new product, and it is too late to act on the warning
    // anyway — the button already says "Adding Product…". Nothing useful
    // can be said here, so nothing is said.
    if (busy) return null;
    return findBarcodeClash(allProducts, form.barcode, {
      excludeIds: [initialProduct?.id, createdId],
    });
  }, [form.barcode, allProducts, initialProduct, busy, createdId]);

  // Only true if we are editing an existing product that already has a Firestore document ID
  const isEditing = Boolean(initialProduct && initialProduct.id);
  const isService = showServices && form.kind === 'service';
  // A PURE INGREDIENT IS NEVER PRICED. A tomato has a buying price and no
  // selling price, and the form used to demand one above zero — so the
  // owner invented a number, and the invented number went into margin,
  // into menu performance and into every report that ranks what sells.
  // Only offered where recipes exist; everywhere else this is always
  // false and the form is byte-for-byte what it was.
  const ingredientOnly = showRecipes && !isService && catalogRole === CATALOG_ROLES.INGREDIENT;

  // Turning a STOCKED product into a service throws its stock away — a
  // service has nothing to count, so the save writes zero. That is the
  // right behaviour, but it is destructive and it is not obvious from a
  // segmented control, so it is stated plainly and confirmed once.
  //
  // Nothing else is touched: the product keeps its id, its history, its
  // sales and its purchases, exactly as turning a capability off hides
  // records rather than deleting them.
  const convertingToService =
    isEditing && isService && initialProduct?.kind !== 'service' && (Number(initialProduct?.stock) || 0) !== 0;
  const [confirmedConversion, setConfirmedConversion] = useState(false);

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
    setCreatedId(null);
    setShowAddCategory(false);
    setNewCategoryName('');
    revokePreview();
    setPendingImage(null);
    setImageWarning(null);
    setImageError(null);
    setOptimising(false);
    setRemoveImage(false);
    setShowPhotoUpgrade(false);
    setConfirmedConversion(false);
    setImageUrl(open ? staticImageUrl(initialProduct) : null);
    setVariantOptions(open && Array.isArray(initialProduct?.variantOptions) ? initialProduct.variantOptions : []);
    setModifierGroups(open && Array.isArray(initialProduct?.modifierGroups) ? initialProduct.modifierGroups : []);
    setRecipe(open && Array.isArray(initialProduct?.recipe) ? initialProduct.recipe : []);
    setProducedInAdvance(open ? initialProduct?.producedInAdvance === true : false);
    setCatalogRole(open ? catalogRoleOf(initialProduct) : CATALOG_ROLES.SELLABLE);
    setKitchenName(open ? String(initialProduct?.kitchenName || '') : '');
    setStation(open ? String(initialProduct?.station || DEFAULT_STATION.id) : DEFAULT_STATION.id);
    // Absent means routed. A NEW item reaches a kitchen screen until
    // somebody says it does not, which is the safe direction: an item
    // nobody cooks sitting on a screen is noise, but an item that needs
    // cooking and reaches no screen is a customer waiting for nothing.
    setRoutable(open ? initialProduct?.routable !== false : true);
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
          unit: UNITS[initialProduct.unit] ? initialProduct.unit : DEFAULT_UNIT,
          packUnit: UNITS[initialProduct.packUnit] ? initialProduct.packUnit : '',
          packSize: initialProduct.packSize ?? '',
          ageRestricted: initialProduct.ageRestricted === true,
          kind: initialProduct.kind === 'service' ? 'service' : 'product',
        });
      } else {
        setForm({
          ...empty,
          barcode: prefillBarcode || '',
          category: '', // Starts empty with "— Select Category —"
          supplierId: prefillSupplierId || initialProduct?.supplierId || '',
          unit: DEFAULT_UNIT,
  // Pack and single. Absent on every product that predates the packSizes
  // capability, and read as "no pack" when absent — which is the identity
  // conversion, so nothing changes for a product that has none.
  packUnit: '',
  packSize: '',
  // Age-restricted goods. Absent means unrestricted, so no existing
  // product changes and nothing new is asked of a shop that sells none.
  ageRestricted: false,
        });
      }
    }
  }, [initialProduct, prefillBarcode, prefillSupplierId, open]);

  // An existing photo lives in its own document, so it is fetched when
  // the modal opens rather than riding along on the product snapshot.
  useEffect(() => {
    if (!open || !needsSidecarFetch(initialProduct)) return undefined;
    let alive = true;
    loadProductImage(initialProduct, businessId).then((url) => {
      // A pick or a remove while the fetch was in flight wins over it.
      if (alive && url) setImageUrl((prev) => (prev === null ? url : prev));
    });
    return () => { alive = false; };
  }, [open, initialProduct, businessId]);

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
    // Unreachable through the UI — an unentitled business is given a
    // button, not a file input — but a stale tab or a devtools-enabled
    // input must not get as far as holding a pending photo.
    if (!canUseProductPhotos) return;
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

  // ADDING A CATEGORY IS AN OWNER'S WRITE, and this control used not to
  // know that. The category list lives on the businessSettings document,
  // which firestore.rules lets only an owner update, but "+ Add Category"
  // was shown to anyone who could open this form — a cashier holding
  // `catalogue.manage`. Online they got a raw permission-denied error;
  // OFFLINE they got "Saved offline. It will sync when you reconnect",
  // because a queued write has not been refused yet, and the category
  // then never appeared and the rejection was never surfaced. The button
  // is now owner-only (see the render below), and the deferred rejection
  // is caught either way so a queued write that the server later refuses
  // says so instead of disappearing.
  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed || savingCategory) return;
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Category already exists.');
      return;
    }
    const updated = [...categories, trimmed];
    setSavingCategory(true);
    // The DIFF against the trade, never a frozen copy of the whole list —
    // see industry/categories.js. Adding a category here and adding one on
    // the Customize page must write the same shape, or one of them would
    // quietly stop being visible to the other.
    const write = setDoc(
      doc(db, 'businessSettings', businessId),
      categoryWritePayload(updated, industry.profileId),
      { merge: true }
    );
    const { queuedOffline, error } = await raceWithTimeout(write, 4000);
    setSavingCategory(false);
    if (error) {
      toast.error(friendlyErrorMessage(error));
      return;
    }
    setForm((prev) => ({ ...prev, category: trimmed }));
    setShowAddCategory(false);
    setNewCategoryName('');
    toast.success(queuedOffline ? 'Saved offline. It will sync when you reconnect.' : 'Category added');
    if (queuedOffline) {
      write.catch((err) => toast.error(`"${trimmed}" could not be saved: ${friendlyErrorMessage(err)}`));
    }
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
    if (!ingredientOnly && Number(form.sellingPrice) <= 0) {
      toast.error('Selling price must be greater than zero.');
      return;
    }
    if (!isEditing && !simplifiedForPurchase && !isService && variantOptions.length === 0 && Number(form.stock) < 0) {
      toast.error('Stock cannot be negative.');
      return;
    }

    if (convertingToService && !confirmedConversion) {
      toast.error('Tick the box to confirm this item\u2019s stock will be set to zero.');
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
      // A service has no buying price. Stored as zero rather than as
      // whatever was last typed, so its sale is recorded with zero cost
      // of goods sold and shows up as pure revenue everywhere that reads
      // it — reports, close day, the counter's profit estimate.
      const costPriceVal = (simplifiedForPurchase || isService) ? 0 : (Number(form.costPrice) || 0);
      const sellingPriceVal = Number(form.sellingPrice) || 0;
      const stockVal = isEditing
        ? (isService ? 0 : (Number(initialProduct.stock) || 0))
        : (simplifiedForPurchase || isService ? 0 : roundQuantity(Number(form.stock) || 0, form.unit));
      const thresholdVal = simplifiedForPurchase ? 5 : roundQuantity(Number(form.lowStockThreshold) || 5, form.unit);

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
      // `piece` is written explicitly on edit so that changing a product
      // BACK from metres to pieces actually clears the field, rather than
      // leaving the old unit in place because the default was omitted.
      if (showUnits && (form.unit !== DEFAULT_UNIT || isEditing)) {
        payload.unit = isService ? DEFAULT_UNIT : (UNITS[form.unit] ? form.unit : DEFAULT_UNIT);
      }

      // A service has nothing to stock, so it is written with a zero
      // stock figure and skipped by every inventory calculation. Written
      // explicitly on edit so that switching an item back to a product
      // clears the flag rather than leaving it behind.
      if (showServices && (form.kind === 'service' || isEditing)) {
        payload.kind = form.kind === 'service' ? 'service' : 'product';
        if (payload.kind === 'service') payload.stock = 0;
      }

      // Pack and single. Both fields are written together or not at all —
      // a pack size with no pack unit is a number with nothing to be a
      // number of, and a pack unit with no size converts nothing. Written
      // explicitly on edit so that CLEARING the pack actually clears it
      // rather than leaving the old conversion silently in place.
      if (showPackSizes && !isService) {
        const size = Number(form.packSize);
        const validPack = UNITS[form.packUnit] && Number.isFinite(size) && size > 1;
        if (validPack) {
          payload.packUnit = form.packUnit;
          payload.packSize = Math.min(MAX_PACK_SIZE, Math.floor(size));
        } else if (isEditing && (initialProduct?.packUnit || initialProduct?.packSize)) {
          payload.packUnit = null;
          payload.packSize = null;
        }
      }

      // Age restriction. Written only when true, or when it is being
      // turned off on a product that carried it, so an ordinary shop's
      // products never gain the field at all.
      if (showAgeRestriction) {
        if (form.ageRestricted) payload.ageRestricted = true;
        else if (isEditing && initialProduct?.ageRestricted === true) payload.ageRestricted = false;
      }

      if (showModifiers && (modifierGroups.length > 0 || Array.isArray(initialProduct?.modifierGroups))) {
        payload.modifierGroups = normalizeModifierGroups(modifierGroups);
      }

      // WHAT THIS ROW IS FOR. Written only when it is not the default,
      // and written back explicitly when a row is demoted from ingredient
      // to sellable — otherwise the old role stays behind because the key
      // was merely omitted, and an item that was briefly an ingredient
      // never returns to the till. See catalogRoleField().
      if (showRecipes && !isService) {
        Object.assign(payload, catalogRoleField(catalogRole, { existing: initialProduct }));
        // A pure ingredient is stocked and never rung up, so its selling
        // price is zero rather than a number somebody invented to get
        // past a required field.
        if (catalogRole === CATALOG_ROLES.INGREDIENT) payload.sellingPrice = 0;
      }

      // THE KITCHEN'S OWN WORDS, and where the item is made. A menu says
      // "Chef's Special"; the pass needs "8oz sirloin, med-rare". Both
      // fields are snapshotted onto the ticket line at ring time, so
      // moving chips from the fryer to the grill tomorrow does not move
      // the chips that are cooking now.
      if (showKitchen && !isService) {
        const trimmed = kitchenName.trim().slice(0, MAX_STATION_NAME);
        if (trimmed) payload.kitchenName = trimmed;
        else if (isEditing && initialProduct?.kitchenName) payload.kitchenName = null;

        // `routable: false` is the owner saying "this does not go to a
        // kitchen" — a bottle of beer out of the fridge, a packet of
        // crisps. Absent means it does, so only the false case is stored.
        if (!routable) payload.routable = false;
        else if (isEditing && initialProduct?.routable === false) payload.routable = true;
      }

      if (showStations && !isService) {
        if (station && routable) payload.station = station;
        else if (isEditing && initialProduct?.station) payload.station = null;
      }

      // A recipe means this item is MADE, not bought in. Whether its
      // ingredients come out at the sale or at a production run is the
      // `producedInAdvance` flag — see utils/inventory.js, where getting
      // that wrong is what would double-deduct flour.
      if (showRecipes && (recipe.length > 0 || Array.isArray(initialProduct?.recipe))) {
        payload.recipe = recipe
          .filter((line) => line.componentId && Number(line.quantity) > 0)
          .map((line) => ({
            componentId: line.componentId,
            componentName: line.componentName || '',
            quantity: Number(line.quantity) || 0,
            ...(line.unit && line.unit !== DEFAULT_UNIT ? { unit: line.unit } : {}),
          }));
        payload.producedInAdvance = showProduction ? producedInAdvance === true : false;
      }

      // Variants. `stock` becomes the SUM of the variant quantities, so
      // every existing consumer of it — low-stock alerts, inventory
      // valuation, reports, exports, the admin inspector — keeps working
      // without knowing variants exist. Existing variant stock is carried
      // through generateVariants(); nothing here can zero it.
      if (showVariants && (variantOptions.length > 0 || hasVariants(initialProduct))) {
        const generated = generateVariants(variantOptions, initialProduct || {});
        payload.variantOptions = generated.options;
        payload.variants = generated.variants;
        payload.variantStock = generated.variantStock;
        if (generated.variants.length > 0) {
          payload.stock = totalVariantStock({ ...payload, unit: payload.unit || form.unit });
        }
      }
      // Clearing an existing photo is part of the same save; the sidecar
      // document is deleted after, once the product has committed.
      const clearing = removeImage && !pendingImage;
      if (clearing) Object.assign(payload, CLEARED_IMAGE_FIELDS);

      const saved = await onSave(payload);
      const productId = isEditing ? initialProduct.id : saved?.id;
      if (!isEditing && saved?.id) setCreatedId(saved.id);

      if (clearing && productId) {
        await deleteProductImage(businessId, productId);
      }

      // The photo is written AFTER the product exists, because the
      // sidecar document id is keyed to the product id. The product then
      // gets a 2-field pointer merged onto it — deliberately not the
      // base64 itself, which would ride the products onSnapshot and
      // re-ship every photo to every device on every sale.
      if (pendingImage && !canUseProductPhotos) {
        // Belt and braces with the picker guard above. Firestore would
        // refuse this write anyway; a sentence is a better way to learn
        // that than a permission error.
        toast.error('Product photos are a FlowBiz Pro feature. The product was saved without one.');
      } else if (pendingImage && !canUseCloudStorage) {
        // Should be unreachable — the picker is disabled — but a stale
        // tab could still get here, and a rejected Firestore write is a
        // worse way to find out than a sentence.
        toast.error('The product was saved. Photos need active cloud services; renew to add one.');
      } else if (pendingImage) {
        if (!productId) {
          toast.error('The product was saved, but its photo could not be attached. Edit the product to add it.');
        } else {
          try {
            const dataUrl = await blobToDataUrl(pendingImage.blob);
            const pointer = await saveProductImage({
              businessId,
              productId,
              dataUrl,
              contentType: pendingImage.type,
              width: pendingImage.width,
              height: pendingImage.height,
            });
            await setDoc(doc(db, 'products', productId), pointer, { merge: true });
          } catch (err) {
            console.error('Product image save failed:', err);
            toast.error(err?.message?.includes('too large')
              ? err.message
              : 'The product was saved, but its photo did not. Try again from Edit.');
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

        {showServices && !simplifiedForPurchase && (
          <div>
            <label className="label">This is</label>
            <SegmentedControl
              ariaLabel="Product or service"
              value={form.kind}
              onChange={(kind) => setForm((p) => ({ ...p, kind }))}
              options={[
                { value: 'product', label: 'A product' },
                { value: 'service', label: 'A service' },
              ]}
            />
            {isService && (
              <p className="mt-1 text-secondary text-ink-400">A service never uses up stock.</p>
            )}
            {convertingToService && (
              <label className="mt-2 flex items-start gap-2.5 rounded-panel border border-warning-200 bg-warning-50 px-3 py-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={confirmedConversion}
                  onChange={(e) => setConfirmedConversion(e.target.checked)}
                  disabled={busy}
                />
                <span className="text-secondary text-ink-700">
                  <span className="font-medium text-ink-900">
                    This sets stock to zero.
                  </span>{' '}
                  The{' '}
                  {formatQuantityWithUnit(Number(initialProduct?.stock) || 0, initialProduct?.unit, { showPiece: true })}{' '}
                  recorded stops being counted and valued. Past sales and purchases are kept.
                </span>
              </label>
            )}
          </div>
        )}

        {isEditing && initialProduct?.internalCode && (
          <div className="rounded-panel bg-ink-50 px-3 py-2 text-secondary text-ink-500">
            Internal code: <span className="font-mono font-semibold text-ink-700">{initialProduct.internalCode}</span>
          </div>
        )}

        <div>
          <label className="label">Barcode <span className="text-ink-300 font-normal normal-case">(optional)</span></label>
          <input className="input font-mono" value={form.barcode} onChange={set('barcode')} placeholder="Scan or type" disabled={busy} />
          {barcodeClash && (
            <p className="mt-1 text-secondary text-warning-700">
              {barcodeClash.name} already uses this barcode. Scanning it at the counter will not reliably find this product.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={set('category')} disabled={busy} required>
              <option value="" disabled>Select a category</option>
              {offeredCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {isOwner && showAddCategory ? (
              <div className="mt-2 space-y-2 rounded-panel bg-ink-50 p-2.5">
                <label className="text-label font-semibold text-ink-700 uppercase tracking-wide">New Category</label>
                <input
 className="input text-secondary"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Accessories"
                  disabled={busy || savingCategory}
                  autoFocus
                />
                <div className="flex gap-1.5 justify-end">
 <button type="button" className="btn-secondary !px-2.5 text-secondary" onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }} disabled={busy || savingCategory}>Cancel</button>
 <button type="button" className="btn-primary !px-2.5 text-secondary" onClick={handleAddCategory} disabled={busy || savingCategory}>{savingCategory ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            ) : isOwner ? (
              <button type="button" className="mt-1.5 block text-secondary font-medium text-primary-700 hover:underline" onClick={() => setShowAddCategory(true)} disabled={busy}>+ Add category</button>
            ) : null}
          </div>

          <div>
            <label className="label">Supplier <span className="text-ink-300 font-normal normal-case">(optional)</span></label>
            <select className="input" value={form.supplierId || ''} onChange={set('supplierId')} disabled={busy}>
              <option value="">{hasSuppliers ? 'No supplier' : 'No suppliers yet'}</option>
              {hasSuppliers && suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {onAddSupplier && (
              <button type="button" className="mt-1.5 text-secondary font-medium text-primary-700 hover:underline block" onClick={onAddSupplier} disabled={busy}>+ Add new supplier</button>
            )}
          </div>
        </div>

        {/* ── What this row is FOR ─────────────────────────────────────
            Only where recipes exist, because it is only where recipes
            exist that a catalogue holds things nobody sells. Three
            answers rather than a boolean, because "both" is real and
            common: a bakery sells loose flour AND bakes with it; a bar
            sells a bottle whole AND pours it by the tot. */}
        {showRecipes && !isService && !simplifiedForPurchase && (
          <div>
            <label className="label">What is this?</label>
            <SegmentedControl
              ariaLabel="What this item is for"
              value={catalogRole}
              onChange={setCatalogRole}
              options={[
                { value: CATALOG_ROLES.SELLABLE,   label: industry.terms.catalogueItem === 'menu item' ? 'On the menu' : 'Sold' },
                { value: CATALOG_ROLES.INGREDIENT, label: 'Ingredient' },
                { value: CATALOG_ROLES.BOTH,       label: 'Both' },
              ]}
            />
            <p className="mt-1 text-secondary text-ink-400">
              {catalogRole === CATALOG_ROLES.INGREDIENT
                ? 'Stocked, counted and costed, but never shown on the counter.'
                : catalogRole === CATALOG_ROLES.BOTH
                  ? 'Sold as it is, and used in recipes.'
                  : 'Appears on the counter and can be sold.'}
            </p>
          </div>
        )}

        {simplifiedForPurchase ? (
          <div>
            <label className="label">Selling price (KES)</label>
            <input type="number" min="0.01" step="0.01" className="input" value={form.sellingPrice} onChange={set('sellingPrice')} disabled={busy} required />
            <p className="mt-1 text-secondary text-ink-400">Stock and cost come from the purchase form.</p>
          </div>
        ) : isService ? (
          /* A service is not bought in, so it has no buying price. Asking
             for one produced a number that fed straight into cost of
             goods sold and made a haircut look like it had a margin
             problem. The field is removed and the cost stored as zero, so
             a service sale is pure revenue — which is what it is. */
          <div>
            <label className="label">Price (KES)</label>
            <input type="number" min="0.01" step="0.01" className="input" value={form.sellingPrice} onChange={set('sellingPrice')} disabled={busy} required />
            <p className="mt-1 text-secondary text-ink-400">
              A service has no buying price. What you charge is what it earns.
            </p>
          </div>
        ) : ingredientOnly ? (
          /* AN INGREDIENT IS BOUGHT, NOT SOLD. It has a buying price —
             which is what every recipe cost in the business is computed
             from — and no selling price at all. The old form demanded one
             above zero, so owners typed a plausible number and it flowed
             straight into margin and menu-performance reporting. */
          <div>
            <label className="label">Buying price (KES{form.unit !== DEFAULT_UNIT ? ` per ${UNITS[form.unit].short}` : ''})</label>
            <input type="number" min="0" step="0.01" className="input" value={form.costPrice} onChange={set('costPrice')} disabled={busy} required />
            <p className="mt-1 text-secondary text-ink-400">
              This is what every recipe using it is costed from. An ingredient has no selling price.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Buying price (KES{form.unit !== DEFAULT_UNIT ? ` per ${UNITS[form.unit].short}` : ''})</label>
              <input type="number" min="0" step="0.01" className="input" value={form.costPrice} onChange={set('costPrice')} disabled={busy} required />
            </div>
            <div>
              <label className="label">Selling price (KES{form.unit !== DEFAULT_UNIT ? ` per ${UNITS[form.unit].short}` : ''})</label>
              <input type="number" min="0.01" step="0.01" className="input" value={form.sellingPrice} onChange={set('sellingPrice')} disabled={busy} required />
            </div>
          </div>
        )}

        {/* A haircut is not sold by the kilogram. With no unit selector a
            service keeps `piece`, which is what every quantity, receipt
            and report already assumes when the field is absent. */}
        {showUnits && !isService && (
          <div>
            <label className="label">Sold by</label>
            <select className="input" value={form.unit} onChange={set('unit')} disabled={busy}>
              {offeredUnitGroups.map((group) => (
                <optgroup key={group.id} label={group.label}>
                  {group.units.map((u) => (
                    <option key={u.id} value={u.id}>{u.label} ({u.short})</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {form.unit !== DEFAULT_UNIT && (
              <p className="mt-1 text-secondary text-ink-400">
                {`Prices are per ${UNITS[form.unit].label.toLowerCase()}, and quantities can have decimals.`}
              </p>
            )}
          </div>
        )}

        {/* Pack and single. The shop tells FlowBiz what a pack of this
            thing is, and receiving a pack then books in the singles.
            Stock is always held in the unit above — the one it is SOLD
            in — so nothing here changes what a sale does. */}
        {showPackSizes && !simplifiedForPurchase && !isService && (
          <div className="rounded-panel border border-line bg-surface p-3">
            <span className="label">Bought in packs <span className="font-normal normal-case text-ink-400">(optional)</span></span>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="pack-unit">A pack is a</label>
                <select
                  id="pack-unit"
                  className="input"
                  value={form.packUnit}
                  onChange={set('packUnit')}
                  disabled={busy}
                >
                  <option value="">Not bought in packs</option>
                  {offeredUnitGroups.map((group) => (
                    <optgroup key={group.id} label={group.label}>
                      {group.units
                        .filter((u) => u.id !== form.unit)
                        .map((u) => (
                          <option key={u.id} value={u.id}>{u.label}</option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="pack-size">
                  Holding how many?
                  <span className="ml-1 font-normal normal-case text-ink-400">({UNITS[form.unit].short})</span>
                </label>
                <input
                  id="pack-size"
                  type="number"
                  min="2"
                  max={MAX_PACK_SIZE}
                  step="1"
                  className="input"
                  value={form.packSize}
                  onChange={set('packSize')}
                  disabled={busy || !form.packUnit}
                  placeholder="e.g. 24"
                />
              </div>
            </div>
            <p className="mt-1 text-secondary text-ink-400">
              {form.packUnit && Number(form.packSize) > 1
                ? `Receiving 1 ${UNITS[form.packUnit].label.toLowerCase()} adds ${Number(form.packSize)} ${UNITS[form.unit].label.toLowerCase()}${Number(form.packSize) === 1 ? '' : 's'}. You still sell and count ${UNITS[form.unit].label.toLowerCase()}s.`
                : 'For example a crate of 24 bottles, or a box of 30 tablets.'}
            </p>
          </div>
        )}

        {/* ── The kitchen ──────────────────────────────────────────────
            Two questions the pass needs answered and the menu cannot
            answer: what do we call this back here, and who makes it.
            Hidden for a pure ingredient, which is never fired at
            anything, and for a service. */}
        {showKitchen && !isService && !ingredientOnly && !simplifiedForPurchase && (
          <div className="space-y-3 rounded-panel border border-line bg-surface p-3">
            <p className="text-label font-semibold uppercase tracking-wide text-ink-700">Kitchen</p>

            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={routable}
                onChange={(e) => setRoutable(e.target.checked)}
                disabled={busy}
              />
              <span className="min-w-0">
                <span className="block text-body font-medium text-ink-900">Send this to the kitchen</span>
                <span className="block text-secondary text-ink-500">
                  Turn off for anything taken straight off a shelf or out of a fridge: a bottled
                  drink, a packet of crisps. It is served without anybody having to make it.
                </span>
              </span>
            </label>

            {routable && (
              <>
                <div>
                  <label className="label">
                    Kitchen name <span className="text-ink-300 font-normal normal-case">(optional)</span>
                  </label>
                  <input
                    className="input"
                    value={kitchenName}
                    onChange={(e) => setKitchenName(e.target.value)}
                    disabled={busy}
                    maxLength={MAX_STATION_NAME}
                    placeholder={form.name ? `e.g. ${form.name}` : 'e.g. 8oz sirloin, med-rare'}
                  />
                  <p className="mt-1 text-secondary text-ink-400">
                    What the pass calls it. A menu can say &ldquo;Chef&rsquo;s Special&rdquo;; the
                    kitchen screen needs to know what to cook.
                  </p>
                </div>

                {showStations && (
                  <div>
                    <label className="label">Made at</label>
                    <select
                      className="input"
                      value={station}
                      onChange={(e) => setStation(e.target.value)}
                      disabled={busy}
                    >
                      {stationOptions(settings?.stations).map((option) => (
                        <option key={option.id || '__default'} value={option.id}>{option.name}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-secondary text-ink-400">
                      Which screen this appears on. Sections are named in Customize.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {showAgeRestriction && !simplifiedForPurchase && (
          <label className="flex items-start gap-2.5 rounded-panel border border-line bg-surface px-3 py-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.ageRestricted}
              onChange={(e) => setForm((p) => ({ ...p, ageRestricted: e.target.checked }))}
              disabled={busy}
            />
            <span className="min-w-0">
              <span className="block text-body font-medium text-ink-900">Not for under-18s</span>
              <span className="block text-secondary text-ink-500">
                The counter asks the cashier to confirm the customer&rsquo;s age before charging.
              </span>
            </span>
          </label>
        )}

        {!simplifiedForPurchase && !isService && (
          <div className="grid grid-cols-2 gap-3">
            {/* With versions defined, the product's stock is the sum of
                its versions' — there is nothing sensible to type here,
                and a stock figure entered against the parent would be
                overwritten by that sum on the next save. Stock arrives
                through Purchases or a stock take, per version. */}
            {variantOptions.length === 0 && (
            <div>
              <label className="label">
                Stock qty
                {form.unit !== DEFAULT_UNIT && <span className="ml-1 font-normal normal-case text-ink-400">({UNITS[form.unit].short})</span>}
              </label>
              <input
                type="number"
                min="0"
                step={unitStep(form.unit)}
                className="input disabled:bg-ink-50 disabled:text-ink-400"
                value={form.stock}
                onChange={set('stock')}
                disabled={isEditing || busy}
                required={!isEditing}
              />
              {isEditing && <p className="mt-1 text-label text-ink-400">Changed by Purchases, Sales and Stock take.</p>}
            </div>
            )}
            <div>
              <label className="label">Low stock alert</label>
              <input type="number" min="0" step={unitStep(form.unit)} className="input" value={form.lowStockThreshold} onChange={set('lowStockThreshold')} disabled={busy} />
            </div>
          </div>
        )}

        {/* A MODIFIER IS A CHOICE A CUSTOMER MAKES, so an item no customer
            ever sees has none. Nobody asks for a large tomato. */}
        {showModifiers && !simplifiedForPurchase && !isService && !ingredientOnly && (
          <div>
            <span className="label">
              Choices <span className="font-normal normal-case text-ink-400">(optional)</span>
            </span>
            <ModifierEditor groups={modifierGroups} onChange={setModifierGroups} disabled={busy} />
          </div>
        )}

        {showRecipes && !simplifiedForPurchase && !isService && (
          <div>
            <span className="label">
              Ingredients <span className="font-normal normal-case text-ink-400">(optional)</span>
            </span>
            <RecipeEditor
              recipe={recipe}
              onChange={setRecipe}
              products={allProducts}
              productId={initialProduct?.id || null}
              producedInAdvance={producedInAdvance}
              onProducedInAdvanceChange={setProducedInAdvance}
              showProduction={showProduction}
              disabled={busy}
            />
          </div>
        )}

        {showVariants && !simplifiedForPurchase && !isService && (
          <div>
            <span className="label">
              Versions <span className="font-normal normal-case text-ink-400">(optional)</span>
            </span>
            <VariantEditor
              options={variantOptions}
              onChange={setVariantOptions}
              product={initialProduct}
              disabled={busy}
            />
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
                {/* Starter gets a button, not a file input. The control
                    is deliberately live rather than greyed out: tapping
                    it is how the merchant discovers what Pro includes. */}
                {canUseProductPhotos ? (
                  <label className={canUseCloudStorage
                    ? 'btn-secondary cursor-pointer'
                    : 'btn-secondary pointer-events-none opacity-50'}>
                    <ImagePlus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    {shownImage ? 'Replace photo' : 'Add photo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handlePickImage}
                      disabled={busy || optimising || !canUseCloudStorage}
                    />
                  </label>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowPhotoUpgrade(true)}
                    disabled={busy}
                  >
                    <ImagePlus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    {shownImage ? 'Replace photo' : 'Add photo'}
                  </button>
                )}
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

              {!canUseProductPhotos && showPhotoUpgrade && (
                <ProUpgradePrompt message="Product photos are a FlowBiz Pro feature. Upgrade to Pro to add photos to your products." />
              )}

              {canUseProductPhotos && !canUseCloudStorage && (
                <p className="text-secondary leading-relaxed text-ink-500">
                  Adding or replacing a photo needs active cloud services. Your existing photos are
                  unchanged and still show here. Renew Cloud Services, Maintenance, Updates and
                  Support to add new ones.
                </p>
              )}

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
          <p className="flex items-start gap-1.5 text-secondary text-danger-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />Selling price is at or below cost. You will make no profit on this item.</p>
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