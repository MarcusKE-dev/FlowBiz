# Demo product photos

Drop one `.webp` file here per filename in the list below and the demo
dataset picks it up automatically — no code change, no rebuild of the
seed. A filename that isn't here yet simply falls back to the neutral
package icon, so you can add them a few at a time.

These files are **only** for the seeded demo (`npm run dev:demo`) and the
public demo build. Photos a real shop uploads never come here — they are
compressed in the browser and written to the `productImages` Firestore
collection instead (see `src/utils/productImages.js`).

## Target for each file

| | |
|---|---|
| Format | WebP |
| Longest edge | **512 px** |
| Aspect | Square (1:1) — tiles and table rows both crop with `object-cover` |
| File size | **under 45 KB**, ideally 20–30 KB |
| Background | White or a light neutral, so it sits well on the `ink-50` tile |

512px is the same ceiling the in-app optimiser uses, so demo photos and
real ones look identical at every size the app renders (36px table rows,
80px in the edit modal, 96px POS tiles — 192px on a 2x screen).

## Filenames

### General shop

```
wireless-mouse.webp
mechanical-keyboard.webp
usb-flash-disk-32gb.webp
external-hard-drive-1tb.webp
power-bank-10000mah.webp
usb-c-charger-20w.webp
phone-charger-micro-usb.webp
hdmi-cable-1-5m.webp
monitor-24-led.webp
laptop-stand.webp
bluetooth-speaker.webp
earbuds-wireless.webp
headphones-over-ear.webp
extension-cable-4-way.webp
router-wireless-n.webp
smart-watch.webp
wireless-charging-pad.webp
```

### Restaurant

The menu items matter most: they are what runs across the middle of the
customer display, at the size of a television. The ingredients only ever
appear as a small thumbnail on the stock list, so they are worth doing
second.

**Menu (do these first)**

```
cheeseburger.webp
chicken-burger.webp
nyama-choma.webp
grilled-chicken.webp
pilau.webp
chips.webp
ugali.webp
garden-salad.webp
kachumbari.webp
soup-of-the-day.webp
coca-cola.webp
fanta.webp
water.webp
dawa.webp
kenyan-tea.webp
chocolate-cake.webp
fruit-salad.webp
```

**Ingredients**

```
beef-mince.webp
chicken-breast.webp
burger-bun.webp
cheddar-slice.webp
potatoes.webp
cooking-oil.webp
lettuce.webp
tomatoes.webp
rice.webp
ugali-flour.webp
tea-leaves.webp
milk.webp
honey.webp
lemon.webp
```

## Converting what you have

If your source files are JPG/PNG at any size, this turns a folder of them
into correctly-sized WebP (needs ImageMagick):

```bash
for f in ~/Downloads/product-src/*; do
  magick "$f" -resize 512x512^ -gravity center -extent 512x512 \
    -background white -alpha remove -quality 80 \
    "public/product-photos/$(basename "${f%.*}").webp"
done
```

Then check nothing came out heavy:

```bash
ls -lhS public/product-photos/*.webp | head
```

## Adding a product to the demo

Add the row in `src/demo/datasets.js` with an `image:` slug, then put
`<slug>.webp` here. The seed builds the URL from the slug and Vite's
`BASE_URL`, so it resolves correctly in both the root build and the
`/demo/` build.
