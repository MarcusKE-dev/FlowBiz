import { Pencil } from 'lucide-react';
import { amountOnly, CURRENCY } from '../ui/format';
import ProductThumb from '../products/ProductThumb';
import { DEFAULT_UNIT, getUnit } from '../../industry/units';
import { hasVariants, totalVariantStock } from '../../utils/variants';
import { tracksOwnStock } from '../../utils/inventory';
import { useAuth } from '../../contexts/AuthContext';
import { ENTITLEMENTS } from '../../licensing';

// `cartQuantities` is an optional map of productId -> quantity currently
// in the Counter page's cart. When a product is in the cart, its tile
// gets a primary-blue border and a quantity badge — persistent visual
// confirmation that a tap or scan actually registered, instead of
// relying on a toast that disappears. Pages that don't pass this prop
// (Products.jsx) render exactly as before.
//
// Tile content is intentionally minimal — image, name, price, nothing
// else: this is a fast scan-and-tap surface, not a product detail view.
// Every tile is the same height and the price always sits on the same
// baseline, so the eye can run across a row without re-finding it.
// The photo is resolved by ProductThumb, which handles all three
// sources (a plain URL on the product, a lazily-fetched Firestore
// sidecar, or nothing) and shows a neutral placeholder until one
// arrives — see utils/productImages.js.
//
// EXCEPT FOR A BUSINESS WITH NO PHOTO ENTITLEMENT. Product photos are a
// licensed feature (src/licensing/entitlements.js), so a Starter shop
// cannot have one — which makes the placeholder a picture of something
// that will never arrive, repeated across every tile on the counter.
// Those tiles drop the image row entirely and give the space to the name
// and price. A photo the business already owns — bought on Pro, or kept
// from before — still renders, because the entitlement decides whether a
// MISSING photo reserves space, not whether a REAL one is shown.
export default function ProductGrid({ products, onSelect, isAdmin = false, onEdit, cartQuantities = {} }) {
  const { entitlements } = useAuth();
  const photosEntitled = entitlements?.can(ENTITLEMENTS.PRODUCT_PHOTOS) === true;

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
      {products.map((p) => {
        // WHICH TILES CAN GO GREY, and why this is not simply `stock <= 0`.
        //
        // A service never runs out. Neither does a dish assembled to
        // order: its stock is permanently 0 BY DESIGN, because what it
        // consumes is its ingredients, which have stock of their own and
        // are counted in their own right. Asking `stock <= 0` therefore
        // disabled every made-to-order tile on the grid — a restaurant
        // opened the till and found the entire menu greyed out and
        // unclickable, which is the difference between a POS and a
        // picture of one.
        //
        // `tracksOwnStock` is the honest question: does a sale of this
        // move a number on THIS row? It is false for a service and for a
        // made-to-order dish, and true for a bought-in good and for a
        // bakery item made in advance — so a croissant with none left
        // still correctly shows "Out of stock", because a production run
        // put those on a shelf and the shelf is empty.
        const stocked = tracksOwnStock(p);
        // A product with versions is out of stock only when EVERY version
        // is — the parent's own `stock` is their sum, which is what makes
        // this the same comparison as for a plain product.
        const variantProduct = hasVariants(p);
        const available = variantProduct ? totalVariantStock(p) : p.stock;
        const out = stocked && available <= 0;
        const unit = p.unit && p.unit !== DEFAULT_UNIT ? getUnit(p.unit) : null;
        const inCartQty = cartQuantities[p.id] || 0;
        const inCart = inCartQty > 0;
        return (
          <div
            key={p.id}
            className={`relative flex flex-col overflow-hidden rounded-control border bg-surface transition-colors ${
              out ? 'border-line opacity-60'
              : inCart ? 'border-primary-600'
              : 'border-line hover:border-ink-300'
            }`}
          >
            {inCart && (
              <span className="num absolute right-1 top-1 z-10 flex h-5 min-w-[20px] items-center justify-center rounded-pill bg-primary-600 px-1 text-label font-semibold text-white">
                {inCartQty}
              </span>
            )}
            <button
              disabled={out}
              onClick={() => onSelect(p)}
              className="flex w-full flex-1 flex-col items-stretch text-left disabled:pointer-events-none"
            >
              <ProductThumb
                product={p}
                size="h-16 w-full"
                rounded="rounded-none"
                bordered={false}
                iconSize="h-5 w-5"
                placeholder={photosEntitled}
              />
              <span className="flex flex-1 flex-col justify-between gap-1 px-2 py-1.5">
                {/* Two lines reserved either way, so the price below it
                    lands on the same baseline across the whole row. */}
                <span className="line-clamp-2 min-h-[32px] text-secondary font-medium leading-4 text-ink-800">
                  {p.name}
                </span>
                {out ? (
                  <span className="text-secondary font-semibold text-danger-700">Out of stock</span>
                ) : variantProduct ? (
                  <span className="num text-cell font-semibold text-ink-900">
                    <span className="text-label font-medium text-ink-400">{CURRENCY}</span>{' '}
                    {amountOnly(p.sellingPrice)}
                    <span className="ml-1 text-label font-medium text-ink-400">
                      · {p.variants.length} version{p.variants.length === 1 ? '' : 's'}
                    </span>
                  </span>
                ) : (
                  <span className="num text-cell font-semibold text-ink-900">
                    <span className="text-label font-medium text-ink-400">{CURRENCY}</span>{' '}
                    {amountOnly(p.sellingPrice)}
                    {unit && <span className="text-label font-medium text-ink-400">/{unit.short}</span>}
                  </span>
                )}
              </span>
            </button>
            {isAdmin && onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(p); }}
                className="absolute left-1 top-1 rounded-control bg-surface/90 p-1 text-ink-500 hover:text-ink-900"
                aria-label={`Edit ${p.name}`}
              >
                <Pencil className="h-3 w-3" strokeWidth={1.75} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
