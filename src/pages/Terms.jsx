import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-sand text-ink-900 selection:bg-moss-200 py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-ink-800 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to App
        </Link>

        <div className="card p-6 sm:p-10 space-y-8 bg-white border border-ink-100 shadow-sm">
          <div className="border-b border-ink-100 pb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 bg-moss-50 text-moss-700 rounded-xl flex items-center justify-center">
                <FileText className="h-6 w-6" strokeWidth={2} />
              </div>

              <h1 className="font-display text-2xl font-bold text-ink-900">
                Terms of Service
              </h1>
            </div>

            <p className="text-sm text-ink-500">
              Effective Date: August 22, 2026
            </p>
          </div>

          <div className="space-y-8 text-sm text-ink-700 leading-relaxed">

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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
                Features may vary by subscription plan and may be changed,
                introduced, restricted, or discontinued as FlowBiz evolves.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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
                  className="text-moss-600 hover:underline font-semibold"
                >
                  Privacy Policy
                </Link>{' '}
                for more information about data processing.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
                9. Subscriptions and Payments
              </h2>

              <p>
                FlowBiz may offer free and paid subscription plans. The features,
                limits, pricing, and duration applicable to each plan will be
                presented at the time of purchase or upgrade.
              </p>

              <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
                <li>
                  <strong>FlowBiz Pro:</strong> Paid plans may unlock additional
                  functionality such as WhatsApp document sharing, PDF
                  generation, additional staff functionality, advanced
                  analytics, and other Pro features.
                </li>

                <li>
                  <strong>Prepaid Billing:</strong> Where applicable, paid
                  subscriptions are purchased for a defined prepaid period.
                </li>

                <li>
                  <strong>No Automatic Renewal:</strong> Unless explicitly
                  stated otherwise at the time of purchase, FlowBiz does not
                  automatically charge your payment method when a subscription
                  period expires.
                </li>

                <li>
                  <strong>Payment Processing:</strong> Payments may be processed
                  through third-party payment providers such as Paystack. Your
                  use of such payment services may also be subject to the
                  provider's terms and policies.
                </li>
              </ul>

              <p>
                FlowBiz may change subscription pricing or introduce new plans
                in the future. Changes will not retroactively alter a prepaid
                subscription period that has already been purchased.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                10. Refunds
              </h2>

              <p>
                Unless otherwise required by applicable law or expressly stated
                at the time of purchase, FlowBiz subscriptions are generally
                non-refundable after activation.
              </p>

              <p>
                We generally do not provide prorated refunds for partially
                unused subscription periods.
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
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
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
                18. Suspension and Termination
              </h2>

              <p>
                You may stop using FlowBiz and request closure of your account
                at any time.
              </p>

              <p>
                FlowBiz may temporarily suspend or terminate access where
                reasonably necessary because of:
              </p>

              <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
                <li>Violation of these Terms.</li>
                <li>Fraudulent, abusive, or unlawful activity.</li>
                <li>Security risks or suspected unauthorized access.</li>
                <li>Non-payment of applicable fees.</li>
                <li>Legal or regulatory requirements.</li>
                <li>Conduct that materially threatens the Service or other users.</li>
              </ul>

              <p>
                Where reasonably practicable, FlowBiz may provide notice before
                taking termination action. Immediate suspension may be necessary
                where delay would create a security, legal, or operational risk.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                19. Effect of Termination
              </h2>

              <p>
                Following termination, your right to access paid or restricted
                features may end. Certain information may continue to be
                retained where required for legal, security, accounting, fraud
                prevention, dispute resolution, or other legitimate purposes.
              </p>

              <p>
                Where available, users should export important business records
                before terminating their account.
              </p>

              <p>
                Provisions relating to intellectual property, acceptable use,
                disclaimers, limitation of liability, governing law, and any
                obligations that by their nature should survive termination will
                continue to apply after termination.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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
    </div>
  );
}

