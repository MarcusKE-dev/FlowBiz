// src/utils/documentSharing.js
//
// Creates (or reuses) a secure, opaque public link for a FlowBiz document
// — a sale receipt, a credit-sale invoice, or a debt payment receipt — so
// it can be dropped into a WhatsApp message and opened by a customer with
// NO FlowBiz login. The public page itself is served entirely by the
// Cloudflare Worker (cloudflare-worker/src/routes/publicDocument.js) —
// this file's only job is writing the tiny `sharedDocuments` record the
// Worker resolves the token against.
//
// The token (not any client-supplied ID) is what determines which
// document the public link opens. It's generated with the Web Crypto
// API — 192 bits of randomness, never a Firestore auto-ID and never
// derived from a business/customer/sale ID — and used directly as the
// sharedDocuments document ID, so there's exactly one lookup on the
// Worker side (see PHASE 5/7 of the spec this implements).

import { doc, setDoc, getDocs, where, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { tenantQuery, withBusiness } from '../lib/tenant';

const PUBLIC_DOC_BASE_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

const VALID_DOCUMENT_TYPES = ['receipt', 'invoice', 'debtPaymentReceipt'];

function generateToken() {
  const bytes = new Uint8Array(24); // 192 bits — well beyond guessable
  crypto.getRandomValues(bytes);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function buildPublicUrl(token) {
  return `${PUBLIC_DOC_BASE_URL}/r/${token}`;
}

// Reuses an existing share link for the same document instead of minting
// a new token every time a cashier clicks "Send via WhatsApp" (a cashier
// clicking it three times for the same receipt should produce one link,
// not three sharedDocuments records). No token expiry by design — a
// customer may reasonably want to reopen a financial receipt weeks later,
// and there's no product requirement forcing a shorter lifetime yet.
export async function getOrCreateShareLink({ businessId, documentType, documentId, createdBy }) {
  if (!VALID_DOCUMENT_TYPES.includes(documentType)) {
    throw new Error(`Unknown document type: ${documentType}`);
  }
  if (!businessId || !documentId) {
    throw new Error('getOrCreateShareLink requires businessId and documentId.');
  }

  const existingQ = tenantQuery(
    'sharedDocuments', businessId,
    where('documentType', '==', documentType),
    where('documentId', '==', documentId),
    limit(1)
  );
  const existingSnap = await getDocs(existingQ);
  if (!existingSnap.empty) {
    return buildPublicUrl(existingSnap.docs[0].id);
  }

  const token = generateToken();
  await setDoc(doc(db, 'sharedDocuments', token), withBusiness({
    documentType,
    documentId,
    createdAt: serverTimestamp(),
    createdBy: createdBy || null,
  }, businessId));

  return buildPublicUrl(token);
}