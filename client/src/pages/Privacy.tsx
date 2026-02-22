import PageHeader from "@/components/PageHeader";

export function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Privacy Policy" />
      
      <div className="container max-w-4xl py-8">
        <div className="prose prose-invert max-w-none">
          <p className="text-sm text-muted-foreground mb-8">
            <strong>Effective Date:</strong> February 23, 2026
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Introduction</h2>
            <p>
              Incredible You Consultants SOC LLC ("ZAP", "we", "us", or "our"), a company registered in Dubai, United Arab Emirates, is committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered marketing platform and services (collectively, the "Services").
            </p>
            <p>
              By accessing or using our Services, you acknowledge that you have read, understood, and agree to the practices described in this Privacy Policy. If you do not agree with this Privacy Policy, please do not use our Services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">1. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">1.1 Information You Provide Directly</h3>
            <p>
              When you register for an account, we collect your full name, email address, password (encrypted), company name (if applicable), phone number (optional), billing address, and payment information (processed securely through Stripe). You may also provide additional profile information such as profile picture, job title, industry, business type, and marketing preferences.
            </p>
            <p>
              When you use our Services, we collect the marketing campaigns and content you create, AI-generated content you save or export, landing pages and email sequences, ad copy and creative materials, notes and comments, and project files and templates. When you contact us, we collect support tickets and correspondence, feedback and survey responses, chat messages with our support team, and email communications.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">1.2 Information Collected Automatically</h3>
            <p>
              We automatically collect usage data including pages visited and features used, time spent on pages, click patterns and navigation paths, search queries within the platform, feature usage statistics, and error logs and diagnostic data. We also collect device information such as IP address, browser type and version, operating system, device type, screen resolution, language preferences, and time zone.
            </p>
            <p>
              We use cookies, web beacons, and similar tracking technologies to remember your preferences and settings, authenticate your account, analyze usage patterns, improve our Services, and deliver personalized content. You can control cookie preferences through your browser settings, though disabling cookies may limit your ability to use certain features.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">1.3 Information from Third-Party Sources</h3>
            <p>
              When you connect your accounts from platforms such as Meta (Facebook, Instagram), we collect account identifiers and profile information, advertising account data, campaign performance metrics, audience insights, ad creative and copy, and spending and budget information. This data is collected in accordance with the respective platform's terms of service and with your explicit authorization.
            </p>
            <p>
              We receive limited information from Stripe, our payment processor, including payment confirmation, transaction identifiers, billing status, last four digits of payment card, and card brand and expiration date. We use third-party analytics services that may collect aggregated usage statistics, performance metrics, and user behavior patterns.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">2. How We Use Your Information</h2>
            <p>
              We use the information we collect to provide, maintain, and improve our Services, including AI-powered content generation. We use it for account management, personalization, feature development, AI training (using anonymized and aggregated data), technical support, and troubleshooting. We also use your information for business operations including payment processing, fraud prevention, legal compliance, business analytics, and internal operations.
            </p>
            <p>
              We send you service communications about your account, subscriptions, and Services. With your consent, we send marketing communications including promotional materials, newsletters, and offers. You can opt-out of marketing communications at any time by clicking the unsubscribe link in our emails or by updating your account preferences.
            </p>
            <p>
              We use your information to enforce our Terms of Service and other policies, protect our rights, property, and safety, resolve disputes and enforce agreements, and respond to legal requests, court orders, and regulatory inquiries.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">3. Legal Basis for Processing (GDPR Compliance)</h2>
            <p>
              For users in the European Economic Area (EEA), United Kingdom, and Switzerland, we process your personal information based on contract performance (providing the Services you requested), legitimate interests (improving our Services, detecting and preventing fraud, ensuring security, conducting business analytics, marketing our Services), consent (where we have obtained your explicit consent for specific purposes such as marketing communications, non-essential cookies, and AI training using your specific data), and legal obligations (tax and accounting requirements, responding to legal requests, complying with regulatory requirements).
            </p>
            <p>
              You have the right to withdraw your consent at any time where processing is based on consent.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">4. How We Share Your Information</h2>
            <p>
              We do not sell your personal information to third parties. We share your information only with trusted third-party service providers who assist us in operating our Services, including payment processors (Stripe), cloud hosting providers, email services, analytics providers, customer support systems, and AI and machine learning services. These service providers are contractually obligated to protect your information and use it only for the purposes we specify.
            </p>
            <p>
              When you connect your accounts from platforms like Meta (Facebook, Instagram), we share necessary information to publish and manage your advertising campaigns, retrieve performance metrics and insights, sync audience data, and optimize ad delivery. This sharing is done with your explicit authorization and in accordance with the respective platform's terms.
            </p>
            <p>
              If ZAP is involved in a merger, acquisition, asset sale, or bankruptcy, your information may be transferred to the acquiring entity. We will provide notice before your information is transferred, and the new entity will be bound by this Privacy Policy (or you will be notified of changes).
            </p>
            <p>
              We may disclose your information if required to do so by law or in response to court orders, legal processes, government requests, law enforcement agencies, national security requirements, protection of our rights, property, or safety, or prevention of fraud or illegal activities.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">5. Data Retention</h2>
            <p>
              We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. We retain your information while your account is active and you continue to use our Services. If your account becomes inactive for an extended period (typically 12 months), we may delete or anonymize your information after providing notice.
            </p>
            <p>
              When you delete your account, most personal information is deleted within 30 days. Some information may be retained for legal, tax, or regulatory purposes. Backup copies may persist for up to 90 days before permanent deletion. Anonymized usage data may be retained indefinitely for analytics.
            </p>
            <p>
              You can request deletion of your account and personal information at any time by contacting us at support@arfeenkhan.com.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your personal information from unauthorized access, disclosure, alteration, and destruction. Our technical safeguards include encryption (data is encrypted in transit using TLS/SSL and at rest using AES-256), access controls, multi-factor authentication options, firewalls, network monitoring, and regular security audits and penetration testing.
            </p>
            <p>
              Our organizational safeguards include regular security and privacy training for employees, confidentiality agreements, limited access to personal information, vendor security assessments, and documented incident response and breach notification procedures.
            </p>
            <p>
              While we take security seriously, you also play a role in protecting your information by using strong, unique passwords, enabling multi-factor authentication, keeping your login credentials confidential, logging out of shared devices, and reporting suspicious activity immediately.
            </p>
            <p>
              <strong>Important:</strong> No method of transmission or storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. Your Privacy Rights</h2>
            <p>
              Depending on your location, you may have certain rights regarding your personal information. All users can request a copy of the personal information we hold about you, request correction of inaccurate or incomplete information, request deletion of your personal information (subject to legal exceptions), opt-out of marketing communications at any time, and close your account and request deletion of your data.
            </p>
            <p>
              EEA/UK users (GDPR) have additional rights including data portability (receive your personal information in a structured, machine-readable format), restriction of processing (request that we limit how we use your information), object to processing (object to processing based on legitimate interests or for direct marketing), withdraw consent (where processing is based on consent), and lodge a complaint with your local data protection authority.
            </p>
            <p>
              California users (CCPA/CPRA) have additional rights including know what personal information we collect, use, disclose, and sell, request deletion of your personal information, opt-out of the "sale" or "sharing" of personal information (Note: We do not sell personal information), not be discriminated against for exercising your privacy rights, request correction of inaccurate personal information, and limit the use and disclosure of sensitive personal information.
            </p>
            <p>
              UAE users (PDPL) have additional rights including access and correct your personal data, object to processing of your personal data in certain circumstances, request erasure of your personal data, request restriction of processing, and lodge a complaint with the UAE Data Office.
            </p>
            <p>
              To exercise any of these rights, please contact us at support@arfeenkhan.com with subject line "Privacy Rights Request" and include your name, email address, and specific request. We will respond to your request within 30 days for most requests, 45 days for CCPA/CPRA requests (with possible 45-day extension), or as required by applicable law. We may need to verify your identity before processing your request to protect your privacy and security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">8. International Data Transfers</h2>
            <p>
              ZAP is based in Dubai, United Arab Emirates. Your information may be transferred to, stored, and processed in countries other than your country of residence, including United Arab Emirates, United States, European Union, and other countries where our service providers operate.
            </p>
            <p>
              When we transfer personal information internationally, we ensure appropriate safeguards are in place including Standard Contractual Clauses (we use EU-approved Standard Contractual Clauses for transfers from the EEA), adequacy decisions (we rely on adequacy decisions where available), data processing agreements (we enter into data processing agreements with service providers), and Privacy Shield compliance (for US transfers, we ensure compliance with applicable frameworks).
            </p>
            <p>
              By using our Services, you consent to the transfer of your information to countries that may have different data protection laws than your country of residence.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">9. Children's Privacy</h2>
            <p>
              Our Services are not directed to children under the age of 18, and we do not knowingly collect personal information from children under 18. If we learn that we have collected personal information from a child under 18, we will delete the information as quickly as possible, terminate the associated account, and take steps to prevent future access.
            </p>
            <p>
              If you believe we have collected information from a child under 18, please contact us immediately at support@arfeenkhan.com.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">10. Cookies and Tracking Technologies</h2>
            <p>
              We use cookies and similar tracking technologies to collect information and improve our Services. We use essential cookies (required for the Services to function properly), functional cookies (enhance functionality and personalization), analytics cookies (help us understand how you use our Services), and marketing cookies (used for advertising and marketing).
            </p>
            <p>
              You can control cookies through your browser settings (most browsers allow you to block or delete cookies), opt-out tools (use industry opt-out tools like the Digital Advertising Alliance), and cookie preferences (manage your cookie preferences in your account settings). Note that disabling essential cookies may prevent you from using certain features of our Services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">11. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. When we make changes, we will update the "Effective Date" at the top of this policy, notify you via email if the changes are material, display a notice on our Services, and provide a summary of key changes.
            </p>
            <p>
              For significant changes that affect your rights, we will provide at least 30 days' advance notice, obtain your consent if required by law, and allow you to opt-out or close your account. Your continued use of the Services after the effective date of the updated Privacy Policy constitutes your acceptance of the changes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">12. Compliance with Data Protection Laws</h2>
            <p>
              We are committed to complying with applicable data protection laws, including UAE Personal Data Protection Law (PDPL), General Data Protection Regulation (GDPR) for EEA, UK, and Swiss users, California Consumer Privacy Act (CCPA/CPRA) for California residents, and other jurisdictions where we operate or have users, including Canada (PIPEDA), Australia (Privacy Act), Brazil (LGPD), and Singapore (PDPA).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">13. Contact Us</h2>
            <p>
              If you have questions, concerns, or requests regarding this Privacy Policy or our privacy practices, please contact us:
            </p>
            <p className="mt-4">
              <strong>Incredible You Consultants SOC LLC</strong><br />
              <strong>General Inquiries:</strong> support@arfeenkhan.com<br />
              <strong>Privacy-Specific Inquiries:</strong> support@arfeenkhan.com<br />
              <strong>Data Protection Officer:</strong> support@arfeenkhan.com<br />
              <strong>Mailing Address:</strong> Dubai, United Arab Emirates
            </p>
            <p className="mt-4">
              <strong>Response Time:</strong> We will respond to your inquiry within 30 days (or as required by applicable law).
            </p>
          </section>

          <div className="mt-12 pt-8 border-t border-border">
            <p className="text-center text-sm text-muted-foreground">
              By using our Services, you acknowledge that you have read, understood, and agree to this Privacy Policy.
            </p>
            <p className="text-center text-sm text-muted-foreground mt-2">
              <strong>Last Updated: February 23, 2026</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
