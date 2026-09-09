import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { TERMS_VERSION, TERMS_EFFECTIVE_DATE, TERMS_CHANGE_SUMMARY } from '../legal/documentVersions';

export default function Terms() {
  return (
    <div className="min-h-screen bg-canvas px-4 py-8 text-ink-900 selection:bg-primary-100 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1 text-secondary font-semibold text-ink-500 transition-colors hover:text-ink-800"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} /> Back to app
        </Link>

        <PageHeader
          title="Terms of service"
          description={`Version ${TERMS_VERSION} · Effective ${TERMS_EFFECTIVE_DATE}`}
        />
        {/* WHAT CHANGED, at the top, where somebody looking for it
            will find it. The summary has existed in
            src/legal/documentVersions.js since the version it describes
            — documented there as "the one-line summary shown at the top
            of a document that just changed" — and was imported by this
            page and rendered by neither it nor its sibling. So the 2.0
            change (the Lifetime Licence and the separate annual cloud fee) was announced to
            nobody, which is the one thing a version number is for. */}
        <div className="mt-5 max-w-prose rounded-panel border border-line bg-surface p-4">
          <p className="text-secondary font-semibold uppercase tracking-wide text-ink-500">
            What changed in version {TERMS_VERSION}
          </p>
          <p className="mt-1.5 text-body leading-relaxed text-ink-700">{TERMS_CHANGE_SUMMARY}</p>
        </div>

        <hr className="hairline mt-5" />

        <div className="mt-8 max-w-prose space-y-8 text-body leading-relaxed text-ink-700">

          <section className="space-y-3">
            <h2 className="section-title">
              1. Acceptance of Terms
            </h2>

            <p>
              By creating an account, accessing, or using FlowBiz (the
              "Service"), you agree to be bound by these Terms of Service
              ("Terms"), together with our Privacy Policy and any additional
              terms that apply to specific features or paid services.
            </p>

            <p>
              If you do not agree to these Terms, you must not create an
              account or use the Service.
            </p>

            <p>
              If you are using FlowBiz on behalf of a business or organization,
              you represent that you have the authority to accept these Terms
              on that organization's behalf.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              2. Description of the Service
            </h2>

            <p>
              FlowBiz is a cloud-enabled, offline-first business management
              and point-of-sale (POS) application designed primarily for
              small and medium-sized businesses.
            </p>

            <p>
              Depending on the plan and features enabled, FlowBiz may provide
              tools for:
            </p>

            <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
              <li>Sales and point-of-sale transaction recording.</li>
              <li>Inventory and stock management.</li>
              <li>Customer and debtor management.</li>
              <li>Quotation and invoice creation.</li>
              <li>Receipt generation and sharing.</li>
              <li>Expense recording and business reporting.</li>
              <li>Staff accounts, roles, and permissions.</li>
              <li>Offline transaction recording and synchronization.</li>
              <li>Payment and communication integrations.</li>
              <li>Business analytics and operational insights.</li>
            </ul>

            <p>
              Features may vary by plan and may be changed, introduced,
              restricted, or discontinued as FlowBiz evolves.
            </p>

            <p>
              FlowBiz is offered in two commercially distinct forms, and the
              difference between them matters throughout these Terms:
            </p>

            <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
              <li>
                <strong>Licensed software.</strong> The right to use the FlowBiz
                application itself. This is what a FlowBiz Lifetime Licence
                grants, permanently.
              </li>

              <li>
                <strong>Hosted services.</strong> Things FlowBiz operates for you
                on an ongoing basis: cloud services, cloud synchronization,
                cloud-hosted business data services, cloud storage, backups
                where applicable, software maintenance, software updates, new
                versions, security fixes, and technical support. These are
                provided for a defined service period and are renewable.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              3. Eligibility and Account Registration
            </h2>

            <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
              <li>
                You must provide accurate and reasonably complete information
                when creating and maintaining your account.
              </li>

              <li>
                You are responsible for maintaining the confidentiality of
                your account credentials and for activity occurring through
                your account.
              </li>

              <li>
                You must notify FlowBiz promptly if you believe your account
                has been accessed without authorization.
              </li>

              <li>
                You must not create an account using false identity
                information or impersonate another person or business.
              </li>
            </ul>

            <p>
              FlowBiz may require additional information or verification where
              reasonably necessary for account security, payment processing,
              fraud prevention, or legal compliance.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              4. Business Owners, Staff, and Permissions
            </h2>

            <p>
              A business owner or authorized administrator may invite staff
              members to access a FlowBiz workspace and may assign roles or
              permissions available within the Service.
            </p>

            <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
              <li>
                Business owners are responsible for determining which staff
                members receive access.
              </li>

              <li>
                Business owners are responsible for reviewing and removing
                access when a staff member no longer requires it.
              </li>

              <li>
                Business owners are responsible for the actions performed by
                authorized staff members within their workspace.
              </li>

              <li>
                Staff members must not share credentials or intentionally
                access information beyond the permissions assigned to them.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              5. Your Business Data and Privacy Responsibilities
            </h2>

            <p>
              FlowBiz allows businesses to store information relating to
              customers, employees, products, transactions, debts, expenses,
              and other business operations.
            </p>

            <p>
              You are responsible for ensuring that you have a lawful basis
              and any required permissions, notices, consents, or other
              authorizations necessary to collect and process personal data
              entered into your FlowBiz workspace.
            </p>

            <p>
              Where you determine the purposes and means of processing
              customer or staff information, you may be the Data Controller
              for that information, while FlowBiz may act as a Data Processor
              on your behalf.
            </p>

            <p>
              FlowBiz may separately act as a Data Controller for information
              it processes for its own purposes, including account management,
              service security, support, billing, fraud prevention, and legal
              compliance.
            </p>

            <p>
              Please review our{' '}
              <Link
                to="/privacy"
                className="font-semibold text-primary-700 hover:underline"
              >
                Privacy Policy
              </Link>{' '}
              for more information about data processing.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              6. Accuracy of Business Records
            </h2>

            <p>
              FlowBiz provides tools for recording and organizing business
              information. You are responsible for ensuring that information
              entered into the Service is accurate and that transactions,
              inventory quantities, prices, expenses, debts, payments,
              refunds, and other records are reviewed for accuracy.
            </p>

            <p>
              FlowBiz does not independently verify the accuracy of every
              transaction entered by users and is not responsible for losses
              resulting from incorrect information entered by you or your
              staff.
            </p>

            <p>
              You remain responsible for maintaining appropriate accounting,
              tax, financial, and statutory records for your business.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              7. Offline-First Functionality
            </h2>

            <p>
              FlowBiz is designed to support offline-first operation. Certain
              features may continue to function when an internet connection
              is unavailable, with supported information stored temporarily
              on the device and synchronized when connectivity is restored.
            </p>

            <p>
              Offline functionality does not guarantee that every feature will
              remain available without an internet connection. Certain
              operations, integrations, authentication activities, messaging
              functions, payment confirmations, and synchronization processes
              may require connectivity.
            </p>

            <p>
              Users are responsible for maintaining secure devices and should
              avoid using compromised or publicly accessible devices to access
              sensitive business information.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              8. Synchronization and Connectivity
            </h2>

            <p>
              When a device reconnects to the internet, FlowBiz may synchronize
              locally stored information with its cloud services.
            </p>

            <p>
              Synchronization may be affected by network availability,
              device storage, browser limitations, software errors, or other
              technical conditions.
            </p>

            <p>
              Users should allow synchronization to complete where reasonably
              possible and should not intentionally interfere with the
              synchronization process.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              9. Plans, Licences and Payments
            </h2>

            <p>
              FlowBiz offers a free plan, a monthly subscription plan, and a
              one-time perpetual software licence. The features, limits,
              pricing, and duration applicable to each are presented before
              purchase.
            </p>

            <h3 className="text-section-title pt-2 text-ink-900">9.1 FlowBiz Starter</h3>

            <p>
              A free plan with defined limits on catalogue size and staff
              accounts. No payment is required and no service period applies.
            </p>

            <h3 className="text-section-title pt-2 text-ink-900">9.2 FlowBiz Pro (monthly)</h3>

            <p>
              A prepaid subscription purchased for a defined period. It unlocks
              additional functionality such as WhatsApp document sharing,
              advanced analytics, inventory intelligence, and uncapped
              catalogue and staff limits for the duration of the period
              purchased.
            </p>

            <p>
              FlowBiz Pro does not renew automatically. When a prepaid period
              ends, the account returns to the free plan limits until a new
              period is purchased. A FlowBiz Pro subscription is a subscription
              to the software and is not a perpetual licence.
            </p>

            <h3 className="text-section-title pt-2 text-ink-900">9.3 The FlowBiz Lifetime Licence</h3>

            <p>
              The FlowBiz Lifetime Licence is a <strong>one-time purchase of a
              perpetual licence</strong> to use the licensed FlowBiz
              application, at the price stated at the time of purchase.
            </p>

            <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
              <li>
                The Lifetime Licence <strong>does not expire</strong> and has no
                renewal date.
              </li>

              <li>
                It is granted to the business it was purchased for, and it is
                non-exclusive and non-transferable except as agreed in writing
                by FlowBiz.
              </li>

              <li>
                The <strong>first 12 months of Cloud Services, Maintenance,
                Updates and Support</strong> are included with the Lifetime
                Licence purchase, starting on the date of purchase.
              </li>

              <li>
                The Lifetime Licence is a licence to use software. It is not a
                purchase of unlimited cloud hosting, unlimited storage,
                perpetual updates, or perpetual support.
              </li>
            </ul>

            <h3 className="text-section-title pt-2 text-ink-900">
              9.4 Annual Cloud Services, Maintenance, Updates and Support
            </h3>

            <p>
              From the second year of a Lifetime Licence, the following are
              provided under a separate, renewable annual service entitlement
              at the annual price stated in the application:
            </p>

            <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
              <li>FlowBiz cloud services.</li>
              <li>Cloud synchronization between your devices.</li>
              <li>Cloud-hosted business data services.</li>
              <li>Cloud storage required by supported features, including product photos.</li>
              <li>Cloud backups where applicable.</li>
              <li>Software maintenance.</li>
              <li>Software updates, new versions, and eligible new features.</li>
              <li>Security and bug-fix updates.</li>
              <li>Technical and customer support.</li>
              <li>Other hosted services expressly included in the active service entitlement.</li>
            </ul>

            <p>
              The annual service fee is <strong>not a second software
              licence</strong> and does not grant, extend, or renew the Lifetime
              Licence. It pays for the ongoing services listed above.
            </p>

            <h3 className="text-section-title pt-2 text-ink-900">9.5 Renewal and early renewal</h3>

            <p>
              The annual service entitlement does not renew automatically. You
              may renew it at any time during the current service period or
              afterwards.
            </p>

            <p>
              If you renew <strong>before</strong> the current service period
              ends, the new period is added to your existing expiry date rather
              than starting from the date of payment. Renewing early therefore
              does not shorten or waste the period you have already paid for.
            </p>

            <p>
              If you renew <strong>after</strong> the current period and its
              grace period have ended, the new period runs from the date the
              payment is confirmed.
            </p>

            <h3 className="text-section-title pt-2 text-ink-900">9.6 Grace period</h3>

            <p>
              When an annual service period ends without renewal, a grace
              period applies. The length of the grace period is stated in the
              application and is 30 days unless stated otherwise for your
              account.
            </p>

            <p>
              During the grace period, cloud services continue to operate
              normally and FlowBiz will notify you that renewal is required.
            </p>

            <h3 className="text-section-title pt-2 text-ink-900">
              9.7 What happens when the annual service entitlement ends
            </h3>

            <p>
              After the service period and the grace period have both ended,
              and until the entitlement is renewed:
            </p>

            <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
              <li>
                <strong>Your Lifetime Licence remains active.</strong> It is not
                cancelled, suspended, revoked, or shortened because an annual
                service fee was not paid.
              </li>

              <li>
                <strong>Your business data is not deleted.</strong> Products,
                sales, stock records, customer records, credit records,
                expenses, product photos and other business information are
                retained. See section 15 and section 19.
              </li>

              <li>
                FlowBiz continues to be usable on devices where it is
                installed, to the extent the application's offline capabilities
                support it, using the records already held on those devices.
              </li>

              <li>
                Cloud services, cloud synchronization, cloud storage for new
                content, backups, software maintenance, software updates, new
                versions and technical support may become unavailable until the
                entitlement is renewed.
              </li>
            </ul>

            <p>
              FlowBiz does not guarantee that every feature of the application
              will function without active cloud services. Features that depend
              on hosted infrastructure by their nature require an active
              service entitlement.
            </p>

            <h3 className="text-section-title pt-2 text-ink-900">9.8 Payment processing</h3>

            <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
              <li>
                Payments are processed through third-party payment providers
                such as Paystack. Your use of those services may also be
                subject to the provider's own terms and policies.
              </li>

              <li>
                Every payment is verified by FlowBiz on its servers against the
                payment provider before any licence or service entitlement is
                granted. A payment confirmation shown in a browser is not by
                itself an activation.
              </li>

              <li>
                FlowBiz records the payment reference, amount, currency, date
                and status of each transaction so that payments can be
                reconciled and support enquiries answered.
              </li>

              <li>
                Duplicate notifications of the same transaction do not create
                duplicate licences or duplicate service periods.
              </li>
            </ul>

            <h3 className="text-section-title pt-2 text-ink-900">9.9 Changes to pricing</h3>

            <p>
              FlowBiz may change its prices, including the annual service fee,
              or introduce new plans. A price change does not retroactively
              alter a period that has already been purchased, and it does not
              alter the perpetual nature of a Lifetime Licence already granted.
              The price applicable to a renewal is the price presented at the
              time that renewal is purchased.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              10. Refunds
            </h2>

            <p>
              Unless otherwise required by applicable law or expressly stated
              at the time of purchase, FlowBiz payments are generally
              non-refundable after activation. This applies to monthly
              subscription periods, to annual service periods, and to the
              one-time Lifetime Licence.
            </p>

            <p>
              We generally do not provide prorated refunds for partially
              unused subscription or service periods.
            </p>

            <p>
              Cancelling or declining to renew an annual service entitlement
              does not entitle you to a refund of the Lifetime Licence fee,
              because the licence itself is not withdrawn.
            </p>

            <p>
              If a payment was made in error, duplicated, or affected by a
              technical problem, you may contact support so that the
              transaction can be reviewed.
            </p>

            <p>
              Nothing in this section limits any mandatory consumer or
              statutory rights that cannot legally be excluded.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              11. Third-Party Integrations
            </h2>

            <p>
              FlowBiz may provide integrations or links to third-party
              services, including payment providers, mobile-money services,
              email providers, messaging platforms, hosting infrastructure,
              and other external services.
            </p>

            <p>
              Third-party services operate independently from FlowBiz and may
              have their own terms, privacy policies, availability requirements,
              fees, and technical limitations.
            </p>

            <p>
              FlowBiz is not responsible for failures, delays, outages,
              incorrect responses, policy changes, or other issues caused by
              third-party services.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              12. Acceptable Use
            </h2>

            <p>
              You agree not to use FlowBiz to:
            </p>

            <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
              <li>
                Engage in illegal, fraudulent, deceptive, or abusive
                activities.
              </li>

              <li>
                Store or transmit information that you do not have the legal
                right to process.
              </li>

              <li>
                Send unauthorized promotional messages, spam, or abusive
                communications through FlowBiz integrations.
              </li>

              <li>
                Attempt to gain unauthorized access to another user's account,
                workspace, device, or business information.
              </li>

              <li>
                Attempt to bypass subscription restrictions, usage limits,
                authentication controls, or security mechanisms.
              </li>

              <li>
                Reverse engineer, decompile, or otherwise attempt to extract
                the source code or underlying technology of the Service except
                where permitted by applicable law.
              </li>

              <li>
                Introduce malware, malicious code, or other harmful material
                into the Service.
              </li>

              <li>
                Use automated methods to abuse, overload, scrape, or interfere
                with the Service or its infrastructure.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              13. Intellectual Property
            </h2>

            <p>
              FlowBiz and its underlying software, interface, branding,
              logos, designs, documentation, features, and related intellectual
              property are owned by or licensed to FlowBiz and are protected
              by applicable intellectual property laws.
            </p>

            <p>
              Your subscription gives you a limited, non-exclusive,
              non-transferable right to access and use the Service for your
              legitimate business operations during the applicable subscription
              period.
            </p>

            <p>
              You retain ownership of business information and content that
              you lawfully submit to FlowBiz, subject to the rights necessary
              for FlowBiz to operate the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              14. Service Availability and Changes
            </h2>

            <p>
              FlowBiz is provided on an "as available" basis. We aim to keep
              the Service reliable but do not guarantee uninterrupted or
              error-free operation.
            </p>

            <p>
              Service availability may be affected by maintenance, software
              updates, infrastructure failures, internet connectivity,
              third-party services, security incidents, or circumstances
              beyond our reasonable control.
            </p>

            <p>
              We may modify, improve, suspend, or discontinue features of the
              Service when reasonably necessary for security, technical,
              business, or legal reasons.
            </p>

            <p>
              Where a change would materially reduce hosted services already
              paid for within a current service period, FlowBiz will seek to
              provide reasonable notice. Nothing in this section permits
              FlowBiz to withdraw a Lifetime Licence that has been granted; a
              licence may only be revoked as described in section 18.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              15. Data Backups and Export
            </h2>

            <p>
              FlowBiz uses cloud synchronization and other technical measures
              to support the availability of business information. However,
              users should not treat FlowBiz as their only backup system for
              legally or commercially important records.
            </p>

            <p>
              Where export functionality is provided, users are responsible
              for periodically exporting and securely retaining records they
              are required to keep for accounting, tax, regulatory, or
              business-continuity purposes.
            </p>

            <p>
              FlowBiz does not guarantee recovery of every record in every
              circumstance, including circumstances involving unauthorized
              access, device failure, corruption, synchronization conflicts,
              accidental deletion, or events beyond our reasonable control.
            </p>

            <p>
              Cloud synchronization and cloud backups, where applicable, are
              hosted services provided under an active service entitlement.
              They may become unavailable when that entitlement lapses. Export
              functionality inside the application does not depend on a
              connection to FlowBiz's servers, and remains the recommended way
              to keep an independent copy of your records at any time.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              16. Disclaimers
            </h2>

            <p>
              <strong>Not Professional Advice:</strong> FlowBiz is a business
              management and record-keeping tool. It is not a substitute for
              professional accounting, tax, financial, legal, or business
              advice.
            </p>

            <p>
              <strong>Tax and Regulatory Compliance:</strong> FlowBiz does not
              guarantee compliance with KRA requirements, eTIMS, VAT
              requirements, accounting standards, or any other regulatory
              requirement unless a specific compliance feature is expressly
              identified and supported by FlowBiz.
            </p>

            <p>
              <strong>Payment Information:</strong> Recording a payment in
              FlowBiz does not by itself guarantee that money was successfully
              transferred, received, settled, or reversed by the relevant
              payment provider.
            </p>

            <p>
              <strong>As-Is Basis:</strong> To the maximum extent permitted by
              applicable law, the Service is provided "as is" and "as
              available" without warranties that the Service will always be
              uninterrupted, error-free, completely secure, or suitable for
              every particular business requirement.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              17. Limitation of Liability
            </h2>

            <p>
              To the maximum extent permitted by Kenyan law, FlowBiz and its
              owners, operators, developers, and service providers will not be
              liable for indirect, incidental, special, consequential, or
              exemplary losses arising from the use of, or inability to use,
              the Service.
            </p>

            <p>
              This may include losses relating to business interruption, lost
              profits, lost opportunities, loss of anticipated savings, or
              loss of data, except where such liability cannot legally be
              excluded or limited.
            </p>

            <p>
              Nothing in these Terms is intended to exclude liability that
              cannot lawfully be excluded under applicable Kenyan law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              18. Suspension, Revocation and Termination
            </h2>

            <p>
              You may stop using FlowBiz and request closure of your account
              at any time.
            </p>

            <p>
              These are three different actions with three different effects,
              and FlowBiz treats them separately.
            </p>

            <h3 className="text-section-title pt-2 text-ink-900">18.1 Suspension of cloud services</h3>

            <p>
              FlowBiz may suspend the hosted services described in section 9.4
              for a business where reasonably necessary because of:
            </p>

            <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
              <li>Expiry of the annual service entitlement and its grace period.</li>
              <li>Non-payment of applicable fees, including a reversed or disputed payment.</li>
              <li>Security risks or suspected unauthorized access.</li>
              <li>Fraudulent, abusive, or unlawful activity.</li>
              <li>Usage that materially threatens the Service or other users.</li>
              <li>Legal or regulatory requirements.</li>
            </ul>

            <p>
              Suspension of cloud services <strong>does not revoke a Lifetime
              Licence</strong>, does not close the account, and does not delete
              business data. It is reversible, and cloud services resume when
              the reason for suspension is resolved.
            </p>

            <h3 className="text-section-title pt-2 text-ink-900">18.2 Suspension of account access</h3>

            <p>
              FlowBiz may separately suspend access to an account, which
              prevents sign-in, where reasonably necessary because of a
              violation of these Terms, fraudulent or unlawful activity, a
              security risk, or a legal or regulatory requirement. This is also
              reversible and also deletes nothing.
            </p>

            <h3 className="text-section-title pt-2 text-ink-900">18.3 Revocation of a Lifetime Licence</h3>

            <p>
              A Lifetime Licence may be revoked only in clearly defined
              circumstances: a material breach of these Terms, fraud, an
              unlawful act, a reversed or fraudulent payment for the licence
              itself, or where required by law or by a court.
            </p>

            <p>
              <strong>A Lifetime Licence is never revoked for non-payment of an
              annual service fee</strong>, and FlowBiz operates no automatic
              process that revokes a licence when a service period expires.
              Revocation is a deliberate administrative act, is recorded, and
              where reasonably practicable is preceded by notice.
            </p>

            <p>
              Where reasonably practicable, FlowBiz will provide notice before
              taking termination or revocation action. Immediate suspension may
              be necessary where delay would create a security, legal, or
              operational risk.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              19. Effect of Termination
            </h2>

            <p>
              Following termination, your right to access paid or restricted
              features may end. Certain information may continue to be
              retained where required for legal, security, accounting, fraud
              prevention, dispute resolution, or other legitimate purposes.
            </p>

            <h3 className="text-section-title pt-2 text-ink-900">19.1 Data retention</h3>

            <p>
              FlowBiz distinguishes between the end of a service entitlement
              and the end of an account, because they have different
              consequences for your data:
            </p>

            <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
              <li>
                <strong>An annual service entitlement expiring, or cloud
                services being suspended, does not delete any business
                data.</strong> Products, sales, credit records, customers,
                stock records, expenses, product photos and other business
                information are retained. There is no automatic process that
                deletes business data because a service fee was not paid.
              </li>

              <li>
                Business data is deleted when you ask for it to be deleted:
                by resetting your business data, by deleting your account, or
                by requesting deletion from FlowBiz support.
              </li>

              <li>
                FlowBiz may delete data belonging to an account that has been
                terminated for a material breach, or where retention is
                unlawful, or where required by a competent authority. Where
                reasonably practicable, notice and an opportunity to export
                will be provided first.
              </li>

              <li>
                Records FlowBiz is required to keep, such as payment references
                for accounting, tax, fraud-prevention and dispute purposes, are
                retained for as long as the applicable requirement lasts, and
                are described in the Privacy Policy.
              </li>
            </ul>

            <p>
              Where available, users should export important business records
              before terminating their account, and should keep independent
              copies of records they are required to retain.
            </p>

            <p>
              Provisions relating to intellectual property, acceptable use,
              disclaimers, limitation of liability, governing law, and any
              obligations that by their nature should survive termination will
              continue to apply after termination.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              20. Changes to These Terms
            </h2>

            <p>
              We may update these Terms from time to time to reflect changes
              to the Service, business practices, technology, or applicable
              law.
            </p>

            <p>
              The updated Terms will be made available through FlowBiz and the
              effective date will be updated where appropriate. Continued use
              of the Service after the effective date of material changes
              constitutes acceptance of the updated Terms, to the extent
              permitted by applicable law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              21. Governing Law and Disputes
            </h2>

            <p>
              These Terms are governed by and construed in accordance with the
              laws of the Republic of Kenya.
            </p>

            <p>
              The parties will seek to resolve disputes relating to the Service
              or these Terms through good-faith communication before pursuing
              formal proceedings where reasonably practicable.
            </p>

            <p>
              Subject to any mandatory legal rights or dispute-resolution
              requirements, disputes that cannot be resolved informally will
              be subject to the jurisdiction of the courts of Kenya.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              22. Contact Us
            </h2>

            <p>
              If you have questions about these Terms, your account, billing,
              or the FlowBiz Service, contact:
            </p>

            <p className="font-medium text-ink-800">
              support@flowbiz.co.ke
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}

