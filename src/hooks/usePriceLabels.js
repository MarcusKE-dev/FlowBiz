// src/hooks/usePriceLabels.js
//
// The price strings the licensing screens quote, in the open business's
// price book ("KES 3,000 per year" in Kenya, "USD 24 per year" elsewhere).
// They used to be module constants in licensingCopy.js, which could only
// ever be Kenyan.

import { formatPrice } from '../licensing';
import { usePricing } from './usePricing';

export function usePriceLabels(options) {
  const { pricing, confirmed } = usePricing(options);
  const currency = pricing.currency;
  const label = (entry) => (Number.isFinite(entry?.amount) ? formatPrice(entry.amount, currency) : '…');
  const servicePrice = label(pricing.annualServices);
  return {
    pricing,
    confirmed,
    currency,
    licensePrice: label(pricing.lifetime),
    proPrice: label(pricing.pro),
    servicePrice,
    servicePricePerYear: `${servicePrice} per year`,
    renewButtonLabel: `Renew for ${servicePrice}`,
  };
}
