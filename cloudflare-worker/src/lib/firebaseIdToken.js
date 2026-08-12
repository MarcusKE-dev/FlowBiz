// src/lib/firebaseIdToken.js
//
// Verifies a Firebase Authentication ID token WITHOUT the Firebase Admin
// SDK (which doesn't reliably run in Cloudflare Workers — see the
// project's audit notes). This follows Firebase's own documented manual
// verification procedure:
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
//
// Every privileged route calls this FIRST. If it throws, the caller isn't
// who they claim to be — full stop, nothing downstream can be trusted.

import { base64UrlToJson, base64UrlToUint8Array, stringToUint8Array } from './jwt.js';

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let cachedJwks = null;
let cachedJwksExpiry = 0;

async function getJwks() {
  const now = Date.now();
  if (cachedJwks && now < cachedJwksExpiry) return cachedJwks;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error('Could not fetch Firebase public keys.');
  const data = await res.json();
  cachedJwks = data.keys;
  cachedJwksExpiry = now + 60 * 60 * 1000; // Google rotates these; re-fetch hourly.
  return cachedJwks;
}

async function importPublicKey(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

export async function verifyFirebaseIdToken(idToken, projectId) {
  if (!idToken || typeof idToken !== 'string' || idToken.split('.').length !== 3) {
    throw new Error('Malformed ID token.');
  }
  const [headerB64, payloadB64, signatureB64] = idToken.split('.');
  const header = base64UrlToJson(headerB64);
  const payload = base64UrlToJson(payloadB64);

  if (header.alg !== 'RS256') throw new Error('Unexpected token algorithm.');
  if (!header.kid) throw new Error('Token missing key id.');

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new Error('Token expired.');
  if (typeof payload.iat !== 'number' || payload.iat > now + 60) throw new Error('Token issued in the future.');
  if (payload.aud !== projectId) throw new Error('Token audience mismatch.');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Token issuer mismatch.');
  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('Token missing subject.');

  const jwks = await getJwks();
  const jwk = jwks.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('No matching public key for this token.');

  const key = await importPublicKey(jwk);
  const signature = base64UrlToUint8Array(signatureB64);
  const signedData = stringToUint8Array(`${headerB64}.${payloadB64}`);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signedData);
  if (!valid) throw new Error('Token signature invalid.');

  return { uid: payload.sub, email: payload.email || null, claims: payload };
}
