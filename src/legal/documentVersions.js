// src/legal/documentVersions.js
//
// The version and effective date of each legal document, in one place.
//
// WHY THIS IS A MODULE AND NOT A STRING IN A JSX HEADER. A legal document
// that changes without its date changing is a document nobody can reason
// about afterwards: "which terms was this customer shown when they
// bought?" stops being answerable. Keeping the version beside the
// document, and bumping it in the same commit as the text, is the
// cheapest thing that makes that question answerable.
//
// WHEN TO BUMP. A material change — anything that alters what a customer
// pays, what they get, what happens when they stop paying, or what
// FlowBiz does with their data — bumps the MAJOR number and moves the
// effective date. A typo or a clarification bumps the MINOR number and
// leaves the effective date alone.
//
// NOTIFYING EXISTING USERS is a business decision, not a code one, and
// this module deliberately does not pretend otherwise: there is no
// silent re-acceptance mechanism here. See docs/LICENSING.md for what
// was decided for the 2.0 change and why.

export const TERMS_VERSION = '2.0';
export const TERMS_EFFECTIVE_DATE = '7 September 2026';

export const PRIVACY_VERSION = '3.0';
export const PRIVACY_EFFECTIVE_DATE = '7 September 2026';

/** The one-line summary shown at the top of a document that just changed. */
export const TERMS_CHANGE_SUMMARY =
  'Version 2.0 describes the FlowBiz Lifetime Licence and the separate annual Cloud Services, '
  + 'Maintenance, Updates and Support fee. It does not change the terms of any FlowBiz Pro monthly '
  + 'subscription, and it does not shorten or cancel any licence already purchased.';

export const PRIVACY_CHANGE_SUMMARY =
  'Version 3.0 adds the account phone number collected when a business is created, and states '
  + 'what it is for: FlowBiz contacting the account holder about their own account, including '
  + 'over WhatsApp where the number is registered there. It is not used for advertising, is not '
  + 'sold or shared, and is not connected to any automated or bulk messaging system.';
