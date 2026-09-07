
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { PRIVACY_VERSION, PRIVACY_EFFECTIVE_DATE, PRIVACY_CHANGE_SUMMARY } from '../legal/documentVersions';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-canvas px-4 py-8 text-ink-900 selection:bg-primary-100 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1 text-secondary font-semibold text-ink-500 transition-colors hover:text-ink-800"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} /> Back to app
        </Link>

        {/* "Prepared with reference to" rather than "Compliant with".
            A blanket self-certification of compliance with a statute is a
            claim this document cannot substantiate on its own, and the
            sections below describe what FlowBiz actually does, which is
            the honest and more useful version of the same statement. No
            right described anywhere in this policy is reduced by the
            change of wording. */}
        <PageHeader
          title="Privacy policy"
          description={`Version ${PRIVACY_VERSION} · Effective ${PRIVACY_EFFECTIVE_DATE} · Prepared with reference to the Kenya Data Protection Act, 2019`}
        />
  

        <div className="mt-8 max-w-prose space-y-8 text-body leading-relaxed text-ink-700">

          <section className="space-y-3">
            <h2 className="section-title">
              1. Introduction
            </h2>

            <p>
              FlowBiz is a business management platform designed to help small and
              medium-sized businesses manage sales, inventory, customers, debts,
              expenses, quotations, invoices, receipts, and related business
              operations.
            </p>

            <p>
              This Privacy Policy explains what information FlowBiz may process,
              why that information is processed, how it is stored and protected,
              and the choices available to individuals whose personal data is
              processed through the service.
            </p>

            <p>
              FlowBiz is committed to handling personal data in accordance with
              applicable Kenyan data protection laws, including the Data Protection
              Act, 2019 and applicable regulations and guidance issued by the
              Office of the Data Protection Commissioner (ODPC).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              2. Information We Collect
            </h2>

            <p>
              The information processed by FlowBiz depends on how the service is
              used. This may include:
            </p>

            <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
              <li>
                <strong>Account Information:</strong> email address, display name,
                account phone number, authentication information, business name,
                and business profile information.
              </li>

              <li>
                <strong>Business Information:</strong> business name, business
                contact details, address, phone number, email address, tax or
                registration information where voluntarily provided, and business
                preferences.
              </li>

              <li>
                <strong>Inventory Information:</strong> product names, product
                descriptions, prices, quantities, stock levels, categories,
                cost information, and stock adjustments.
              </li>

              <li>
                <strong>Transaction Information:</strong> sales, quotations,
                invoices, receipts, payment methods, transaction amounts,
                discounts, refunds, expenses, and related records.
              </li>

              <li>
                <strong>Customer Information:</strong> customer names, phone
                numbers, email addresses, notes, purchase records, outstanding
                balances, and other information entered by a business for
                customer and debt-management purposes.
              </li>

              <li>
                <strong>Staff Information:</strong> names, email addresses,
                assigned roles, permissions, and activity associated with
                business workspaces.
              </li>

              <li>
                <strong>Device and Security Information:</strong> browser type,
                device category, session information, approximate technical
                information, login activity, and information necessary to manage
                authorized devices and protect accounts.
              </li>

              <li>
                <strong>Product Images:</strong> photographs of products that a
                business chooses to upload. FlowBiz compresses them in the
                browser and stores them in its cloud database alongside the
                product they belong to. Photos are optional; a catalogue works
                without any.
              </li>

              <li>
                <strong>Payment and Licensing Information:</strong> the payment
                reference, amount, currency, plan purchased, status, timestamps
                and payment-provider transaction identifier for each FlowBiz
                payment, together with the licence and annual service records
                derived from them. FlowBiz does <strong>not</strong> receive or
                store card numbers, card security codes, mobile-money PINs, or
                any other payment credential; those are handled entirely by the
                payment provider.
              </li>

              <li>
                <strong>Device and Session Records:</strong> a device
                identifier generated by FlowBiz in your browser, a device
                label derived from your browser and operating system, your
                browser user-agent string, and the time a device was last
                active. These exist so an owner can see which devices are
                signed in to their business and revoke any of them.
              </li>

              <li>
                <strong>Authentication Activity:</strong> the outcome of
                sign-in attempts, the network address the attempt came from,
                and the device it came from, recorded so that unauthorized
                access attempts can be detected and investigated.
              </li>

              <li>
                <strong>Administrative and Operational Records:</strong> an
                audit record of actions taken by FlowBiz platform
                administrators on a business account, including who acted,
                what they did, when, and the stated reason; and a small
                operational log of technical failures such as a rejected
                payment notification or an undelivered email.
              </li>

              <li>
                <strong>Support Information:</strong> information you provide
                when contacting FlowBiz for technical support, account assistance,
                or privacy-related requests.
              </li>
            </ul>

            <p>
              FlowBiz does not use third-party analytics, advertising, tracking
              or profiling services, and does not build behavioural profiles of
              users. The application loads no analytics or advertising scripts.
            </p>

            <p>
              FlowBiz does not require businesses to enter information that is
              unnecessary for the operation of their workspace. Businesses are
              responsible for ensuring that information they enter into FlowBiz
              is appropriate, accurate, and collected lawfully.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              3. How We Use Information
            </h2>

            <p>
              Information processed through FlowBiz may be used for purposes
              including:
            </p>

            <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
              <li>Creating and managing user accounts and business workspaces.</li>
              <li>Providing sales, inventory, invoicing, quotation, and debt-management functionality.</li>
              <li>Synchronizing business information between authorized devices.</li>
              <li>Maintaining transaction history and business records.</li>
              <li>Providing account, security, and device-management functionality.</li>
              <li>Responding to support requests and resolving technical problems.</li>
              <li>Detecting, preventing, and investigating unauthorized access, fraud, abuse, or security incidents.</li>
              <li>Maintaining and improving the reliability and functionality of FlowBiz.</li>
              <li>Complying with applicable legal, regulatory, accounting, or law-enforcement requirements.</li>
            </ul>

            <p>
              FlowBiz does not sell customer contact information or use merchant
              customer records to build advertising profiles.
            </p>

            <h3 className="text-section-title pt-2 text-ink-900">
              3.1 The account phone number
            </h3>

            <p>
              The phone number provided when a business account is created is
              used by FlowBiz for one purpose: contacting the account holder
              about their own account. That means help with setting up, support,
              and occasional follow-up about the service.
            </p>

            <p>
              Where the number is registered on WhatsApp, that contact may be
              made over WhatsApp rather than by email, because it is the channel
              most account holders answer. Messages are written and sent by a
              person at FlowBiz. The number is not connected to any automated or
              bulk messaging system.
            </p>

            <p>
              The account phone number is not used for advertising, is not sold,
              rented or shared with third parties for their own purposes, and is
              not added to any marketing list. An account holder who does not
              wish to be contacted on it may say so, and may ask for the number
              to be removed from their account, using the contact details at the
              end of this policy.
            </p>

            <p>
              This is separate from the business contact phone number a merchant
              may enter in Settings, which belongs to the merchant's own business
              records and appears on their receipts and invoices.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              4. Data Controller and Data Processor Roles
            </h2>

            <p>
              Businesses using FlowBiz generally determine what customer,
              employee, and operational information they collect and the purposes
              for which that information is used. In those circumstances, the
              business is generally the <strong>Data controller</strong> and
              FlowBiz acts as a <strong>Data Processor</strong> processing that
              information on the business's behalf.
            </p>

            <p>
              FlowBiz may also act as a Data Controller for information it
              processes for its own purposes, such as account administration,
              service security, customer support, billing, legal compliance,
              and protection of the FlowBiz platform.
            </p>

            <p>
              The applicable role depends on the particular processing activity
              and the purposes for which the information is processed.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              5. Offline-First Storage
            </h2>

            <p>
              FlowBiz is designed with an offline-first architecture. Depending
              on the functionality being used, certain business information may
              be temporarily stored locally on an authorized device so that the
              application can continue operating when an internet connection is
              unavailable.
            </p>

            <p>
              Local storage may use browser-managed storage technologies such as
              IndexedDB. When connectivity becomes available, supported data is
              synchronized with FlowBiz's cloud infrastructure.
            </p>

            <p>
              Users should protect devices used to access FlowBiz with appropriate
              screen locks, passwords, operating-system security updates, and
              other security controls because locally stored information may be
              accessible to anyone who gains unauthorized access to the device.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              6. Data Synchronization and Transmission
            </h2>

            <p>
              When FlowBiz synchronizes information with its cloud services,
              information is transmitted using secure network protocols such as
              HTTPS and, where applicable, secure real-time communication
              protocols.
            </p>

            <p>
              FlowBiz uses technical and organizational safeguards intended to
              protect information against unauthorized access, alteration,
              disclosure, loss, or destruction. However, no internet-connected
              service or electronic storage system can be guaranteed to be
              completely secure.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              7. Third-Party Service Providers
            </h2>

            <p>
              FlowBiz relies on the following providers to operate the service.
              They are named rather than described in general terms, because a
              list of categories tells you nothing you can act on:
            </p>

            <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
              <li>
                <strong>Google Firebase</strong> (Google LLC) for user
                authentication and for the cloud database that holds business
                records, product images and session records.
              </li>

              <li>
                <strong>Cloudflare</strong> for FlowBiz's application programming
                interface and for serving publicly shared receipt and invoice
                links.
              </li>

              <li>
                <strong>Paystack</strong> for processing payments. Your email
                address and the amount being charged are sent to Paystack to
                create a checkout; card and mobile-money details are entered
                directly with Paystack and are never seen by FlowBiz.
              </li>

              <li>
                <strong>Resend</strong> for delivering transactional email such
                as account verification, password resets, and cloud service
                renewal reminders.
              </li>
            </ul>

            <p>
              This list reflects the providers in use at the effective date of
              this policy. It will be updated if it changes.
            </p>

            <p>
              Such providers may process information only to the extent reasonably
              necessary to provide their services to FlowBiz and are expected to
              apply appropriate security and confidentiality measures.
            </p>

            <p>
              Where FlowBiz integrates with an external service selected or
              activated by a business, information shared with that service may
              also be subject to that provider's own privacy policy and terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              8. M-Pesa, Payment and Communication Integrations
            </h2>

            <p>
              <strong>M-Pesa.</strong> FlowBiz does not connect to M-Pesa and
              does not process mobile-money payments between a shop and its
              customers. When a cashier records a sale as paid by M-Pesa, they
              are typing a payment method and, optionally, a transaction code
              into FlowBiz's own records so that the day's takings can be
              reconciled. No information is sent to Safaricom or to any
              mobile-money system by FlowBiz, and FlowBiz cannot see, initiate,
              confirm, or reverse an M-Pesa transaction.
            </p>

            <p>
              <strong>Payments to FlowBiz.</strong> Payments for FlowBiz plans,
              licences and annual services are processed by Paystack. Your email
              address, the amount, the currency and a FlowBiz payment reference
              are sent to Paystack to open a checkout. FlowBiz then verifies the
              result directly with Paystack on its own servers before granting
              anything.
            </p>

            <p>
              <strong>WhatsApp.</strong> Sharing a receipt or invoice by WhatsApp
              opens WhatsApp on your own device with a message prepared for you.
              FlowBiz does not use the WhatsApp Business API and does not send
              messages on your behalf. The link in that message points to a page
              served by FlowBiz containing the document you chose to share;
              anyone with the link can open it, so share it only with the
              intended recipient.
            </p>

            <p>
              FlowBiz does not need to store sensitive payment credentials such
              as a customer's mobile-money PIN in order to record a payment
              transaction. Users should never enter payment PINs, passwords, or
              other authentication secrets into ordinary FlowBiz customer or
              transaction fields.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              9. Cookies and Local Technologies
            </h2>

            <p>
              FlowBiz uses browser storage that is necessary for the application
              to function. It uses no advertising or tracking cookies.
            </p>

            <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
              <li>
                <strong>Authentication tokens</strong> issued by Firebase
                Authentication, which keep you signed in.
              </li>

              <li>
                <strong>An offline database</strong> held in your browser's
                storage. This is a copy of your own business records, and it is
                what allows FlowBiz to keep working when there is no internet
                connection. It stays on your device.
              </li>

              <li>
                <strong>Small preference values</strong> such as a device
                identifier for the signed-in-devices list, whether the
                navigation rail is pinned open, your printer paper width, and
                whether you have dismissed a renewal notice.
              </li>
            </ul>

            <p>
              Clearing your browser's site data removes all of the above.
              Records that have already synchronized to FlowBiz's cloud database
              are not affected; records recorded offline and not yet
              synchronized would be lost, which is why it is worth allowing
              synchronization to complete before clearing site data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              10. Data Retention
            </h2>

            <p>
              FlowBiz retains information for as long as reasonably necessary to
              provide the service, maintain legitimate business and security
              records, resolve disputes, comply with legal obligations, and
              protect the rights and interests of FlowBiz and its users.
            </p>

            <p>
              Business owners are responsible for determining appropriate
              retention periods for customer and business records under their
              control, including accounting, tax, debt, and transaction records.
            </p>

            <p>
              When information is no longer required for a legitimate purpose,
              FlowBiz may delete, anonymize, or otherwise securely dispose of it,
              subject to applicable legal, security, backup, and dispute-related
              requirements.
            </p>

            <h3 className="text-section-title pt-2 text-ink-900">
              10.1 What happens to your data when a paid period ends
            </h3>

            <p>
              This is the question most often asked, so it is answered directly.
              An annual cloud services period ending, or FlowBiz suspending
              cloud services for a business, <strong>does not delete any
              business data</strong>. Products, sales, credit records,
              customers, stock records, expenses and product images are all
              retained. There is no automatic process anywhere in FlowBiz that
              deletes business data because a payment was not made.
            </p>

            <p>
              Business data is deleted when it is asked for: when an owner
              resets their business data, when an account is deleted, or when a
              deletion request is made to FlowBiz support. Deleting the last
              owner account of a business deletes that business's records.
            </p>

            <h3 className="text-section-title pt-2 text-ink-900">10.2 Indicative retention</h3>

            <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
              <li>
                <strong>Business records</strong> (products, sales, customers,
                stock, expenses, product images): kept for as long as the
                business keeps its FlowBiz account, and deleted on request.
              </li>

              <li>
                <strong>Payment and licensing records</strong> (payment
                references, amounts, dates, licence and service periods): kept
                for as long as needed for accounting, tax, fraud-prevention and
                dispute purposes, which may outlast the account itself.
              </li>

              <li>
                <strong>Device and session records:</strong> kept while the
                device remains registered, and removable at any time by the
                owner from Settings.
              </li>

              <li>
                <strong>Authentication activity and administrative audit
                records:</strong> kept as a security record. They are not used
                for marketing or profiling and are not shared with other
                businesses.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              11. Data Subject Rights
            </h2>

            <p>
              Under applicable Kenyan data protection law, individuals may have
              rights concerning their personal data, including the right to be
              informed about processing, access personal data, object to certain
              processing, request correction of inaccurate information, and
              request deletion where legally applicable.
            </p>

            <p>
              Where a FlowBiz customer has entered an individual's information
              into their business workspace, the individual should normally
              contact that business first because the business may be the Data
              Controller responsible for that information.
            </p>

            <p>
              Requests relating to information for which FlowBiz is the Data
              Controller may be submitted using the contact details provided
              below. FlowBiz may need to verify the identity and authority of a
              person making a request before disclosing or modifying information.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              12. Account Deletion and Data Removal
            </h2>

            <p>
              Users may request closure of their FlowBiz account or deletion of
              personal information associated with the account, subject to
              applicable legal and operational requirements.
            </p>

            <p>
              Deleting an account may not immediately remove every record from
              backups, security logs, fraud-prevention systems, or records that
              FlowBiz is legally required to retain. Such information will be
              retained only for as long as reasonably necessary for the applicable
              purpose.
            </p>

            <p>
              Business owners should also consider exporting any records they
              need before permanently closing a workspace.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              13. Data Accuracy
            </h2>

            <p>
              FlowBiz provides tools for businesses to create, update, and manage
              their operational records. Businesses are responsible for ensuring
              that personal information entered into their workspace is accurate,
              relevant, and kept up to date where necessary.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              14. Data Transfers
            </h2>

            <p>
              Some FlowBiz infrastructure or service providers may process or
              store information outside Kenya. Where personal data is transferred
              outside Kenya, FlowBiz will seek to apply appropriate safeguards
              and comply with applicable requirements governing international
              transfers of personal data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              15. Security Incidents and Data Breaches
            </h2>

            <p>
              FlowBiz maintains reasonable technical and organizational measures
              designed to identify, prevent, investigate, and respond to security
              incidents.
            </p>

            <p>
              If FlowBiz becomes aware of a personal data breach affecting
              information processed on behalf of a business, FlowBiz will notify
              the relevant Data Controller without undue delay and, where
              reasonably practicable, within the period required by applicable
              law or contractual arrangements.
            </p>

            <p>
              Where FlowBiz is itself the Data Controller for affected information,
              it will assess the incident and take any notification or remediation
              steps required by applicable data protection law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              16. Children's Data
            </h2>

            <p>
              FlowBiz is a business management service and is not intended to be
              directed at children as its primary users.
            </p>

            <p>
              Businesses should not knowingly collect or enter children's personal
              data into FlowBiz unless they have a lawful basis and have complied
              with applicable requirements governing the processing of children's
              data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              17. Changes to This Policy
            </h2>

            <p>
              FlowBiz may update this Privacy Policy when its services, technology,
              legal obligations, or data-processing practices change.
            </p>

            <p>
              The effective date displayed at the beginning of this policy will
              be updated when material changes are made. Users are encouraged to
              review this page periodically.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">
              18. Contact Us
            </h2>

            <p>
              For privacy questions, data protection requests, security concerns,
              or requests relating to information for which FlowBiz is the Data
              Controller, contact:
            </p>

            <p className="font-medium text-ink-800">
              support@flowbiz.co.ke
            </p>

            <p>
              If you are a customer of a business using FlowBiz and your request
              concerns information held by that business, you should normally
              contact the business directly first.
            </p>
          </section>

          <section className="space-y-3 border-t border-line pt-6">
            <h2 className="section-title">
              19. Your Responsibility as a FlowBiz User
            </h2>

            <p>
              Businesses using FlowBiz are responsible for using the platform in
              compliance with applicable privacy, consumer-protection, employment,
              tax, accounting, and other laws relevant to their operations.
            </p>

            <p>
              This includes informing customers and staff where required,
              collecting information lawfully, limiting collection to information
              that is reasonably necessary, maintaining appropriate access
              controls, and protecting devices and account credentials used to
              access FlowBiz.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}

