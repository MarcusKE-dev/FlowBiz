// src/platform/deepLinks.js
//
// WHICH INCOMING LINKS THE ANDROID APP WILL OPEN, and where.
//
// A deep link is input from outside the app, so it is treated as untrusted:
// only https, only the FlowBiz host, only the two paths the manifest
// declares (account actions and staff invites). Anything else is ignored
// rather than navigated to — an arbitrary path could otherwise be used to
// land a signed-in owner on a destructive screen from a crafted link.

const DEEP_LINK_HOSTS = new Set(['flowbiz.co.ke', 'www.flowbiz.co.ke']);
const DEEP_LINK_PATHS = [/^\/auth\/action$/, /^\/join\/[A-Za-z0-9_-]{1,128}$/];

/** The in-app route for a deep-link URL, or null if FlowBiz does not open it. */
export function deepLinkRoute(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !DEEP_LINK_HOSTS.has(url.hostname)) return null;
  if (url.username || url.password || (url.port && url.port !== '443')) return null;
  if (!DEEP_LINK_PATHS.some((re) => re.test(url.pathname))) return null;
  return `${url.pathname}${url.search}`;
}
