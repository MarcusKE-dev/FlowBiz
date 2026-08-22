
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-sand text-ink-900 selection:bg-moss-200 py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-ink-800 mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to App
        </Link>

        <div className="card p-6 sm:p-10 space-y-8 bg-white border border-ink-100 shadow-sm">
          <div className="border-b border-ink-100 pb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 bg-moss-50 text-moss-700 rounded-xl flex items-center justify-center">
                <Shield className="h-6 w-6" strokeWidth={2} />
              </div>
              <h1 className="font-display text-2xl font-bold text-ink-900">
                Privacy Policy
              </h1>
            </div>

            <p className="text-sm text-ink-500">
              Effective Date: August 20, 2026 · Compliant with Kenya Data Protection Act (KDPA) 2019
            </p>
          </div>

          <div className="space-y-8 text-sm text-ink-700 leading-relaxed">

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
                2. Information We Collect
              </h2>

              <p>
                The information processed by FlowBiz depends on how the service is
                used. This may include:
              </p>

              <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
                <li>
                  <strong>Account Information:</strong> email address, display name,
                  authentication information, business name, and business profile
                  information.
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
                  <strong>Support Information:</strong> information you provide
                  when contacting FlowBiz for technical support, account assistance,
                  or privacy-related requests.
                </li>
              </ul>

              <p>
                FlowBiz does not require businesses to enter information that is
                unnecessary for the operation of their workspace. Businesses are
                responsible for ensuring that information they enter into FlowBiz
                is appropriate, accurate, and collected lawfully.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
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
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
                4. Data Controller and Data Processor Roles
              </h2>

              <p>
                Businesses using FlowBiz generally determine what customer,
                employee, and operational information they collect and the purposes
                for which that information is used. In those circumstances, the
                business is generally the <strong>Data Controller</strong> and
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
                7. Third-Party Service Providers
              </h2>

              <p>
                FlowBiz may rely on trusted technology and infrastructure providers
                to operate parts of the service. Depending on the features enabled,
                these providers may support services such as authentication, cloud
                storage, application hosting, email delivery, payment processing,
                communications, analytics, or security.
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
              <h2 className="font-display text-lg font-bold text-ink-900">
                8. M-Pesa, Payment and Communication Integrations
              </h2>

              <p>
                FlowBiz may support or integrate with payment and communication
                services, including mobile-money, payment gateway, email, or
                messaging services.
              </p>

              <p>
                Where such integrations are enabled, relevant transaction or
                contact information may be transmitted to the applicable service
                provider to complete or support the requested operation.
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
              <h2 className="font-display text-lg font-bold text-ink-900">
                9. Cookies and Local Technologies
              </h2>

              <p>
                FlowBiz may use browser storage, session technologies, authentication
                tokens, and similar technologies that are necessary to keep users
                signed in, remember application state, support offline operation,
                maintain security, and provide core functionality.
              </p>

              <p>
                Where optional analytics or similar technologies are introduced,
                FlowBiz will provide appropriate information and controls where
                required by applicable law.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
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
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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
              <h2 className="font-display text-lg font-bold text-ink-900">
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

            <section className="space-y-3 border-t border-ink-100 pt-6">
              <h2 className="font-display text-lg font-bold text-ink-900">
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
    </div>
  );
}

