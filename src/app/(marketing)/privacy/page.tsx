import type { Metadata } from "next";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";

export const metadata: Metadata = { title: "Privacy Policy — LIMINALsva" };

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen" style={{ background: "linear-gradient(180deg, #f9f5ef 0%, #ffffff 100%)" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24">

          <h1 className="font-serif text-4xl text-certify-deep mb-2">Privacy Policy</h1>
          <p className="text-sm text-certify-cool-grey mb-12">
            LIMINALsva Platform, a service of KLM Design Studio, Inc.
          </p>

          <div className="space-y-10">

            <p className="text-sm text-certify-cool-grey leading-relaxed">
              This Privacy Policy ("Policy") describes how LIMINALsva, a service of KLM Design Studio, Inc. and its owners, members, officers, and agents ("Company," "we," "us," or "our") collect, use, store, process, share, and delete information in connection with the LIMINALsva platform, a service of KLM Design Studio, Inc. ("Platform" or "Service"). By using the Platform, you acknowledge and agree to the practices described in this Policy. This Policy is incorporated into and made part of the Terms of Service. Capitalized terms not defined herein have the meanings given in the Terms of Service.
            </p>

            <Section number="1" title="INFORMATION WE COLLECT">
              <Subsection number="1.1" title="Account and Registration Information">
                When you register for an account, we collect information you provide, which may include your name, email address, company name, professional role, billing address, and payment information. Payment information is processed by our third-party payment processor and is not stored on our systems in unencrypted form.
              </Subsection>
              <Subsection number="1.2" title="Project and Submitted Documents">
                To provide the Service, you will submit documents and data related to your building project ("Submitted Documents"). Submitted Documents may include architectural drawings, engineering reports, project data, occupant data, building specifications, and other information. You represent and warrant that you have all necessary rights, consents, and authorizations to submit such documents. We process Submitted Documents solely to provide the Service and delete them upon completion of analysis as described in Section 3.
              </Subsection>
              <Subsection number="1.3" title="Usage and Technical Data">
                We automatically collect certain technical and usage information when you access the Platform, including IP address, browser type, device type, operating system, pages visited, actions taken, timestamps, referring URLs, and other standard log data. This information is collected through cookies, log files, and similar technologies.
              </Subsection>
              <Subsection number="1.4" title="Communications">
                We collect information you provide when you contact us for support, submit feedback, or otherwise communicate with us. We may retain such communications for quality assurance, training, and operational purposes.
              </Subsection>
              <Subsection number="1.5" title="Cookies and Tracking Technologies">
                We use cookies, pixel tags, web beacons, and similar technologies to operate the Platform, authenticate users, remember preferences, analyze usage, and improve the Service. By using the Platform, you consent to our use of cookies. You may disable cookies through your browser settings, but doing so may impair Platform functionality.
              </Subsection>
            </Section>

            <Section number="2" title="HOW WE USE INFORMATION">
              <p className="text-sm text-certify-cool-grey leading-relaxed mb-3">
                We use the information we collect for the following purposes:
              </p>
              <ul className="space-y-2 text-sm text-certify-cool-grey leading-relaxed mb-5">
                <li>To provide, operate, maintain, and improve the Service;</li>
                <li>To process your Credit purchases and manage your account;</li>
                <li>To analyze Submitted Documents and generate Output Documents using AI systems;</li>
                <li>To communicate with you regarding your account, transactions, and the Service;</li>
                <li>To send transactional emails, including upload links, analysis results, and Output Document delivery;</li>
                <li>To detect, investigate, and prevent fraudulent, unauthorized, or illegal activity;</li>
                <li>To enforce our Terms of Service and other agreements;</li>
                <li>To comply with legal obligations and respond to lawful requests from authorities;</li>
                <li>To improve our AI models, algorithms, and the overall quality of the Service, using anonymized and aggregated data;</li>
                <li>To protect the rights, property, and safety of the Company, its users, and others;</li>
                <li>To conduct analytics, research, and reporting to understand how the Service is used.</li>
              </ul>
              <p className="text-sm text-certify-cool-grey leading-relaxed font-medium">
                We do not sell your personal information to third parties for their own marketing purposes. We do not use Submitted Documents to train our AI models without anonymization, except as authorized above.
              </p>
            </Section>

            <Section number="3" title="DOCUMENT RETENTION AND DELETION">
              <Subsection number="3.1" title="Submitted Documents">
                Submitted Documents are retained only for the duration necessary to complete the requested analysis and generate Output Documents. Upon completion of the analysis, Submitted Documents are permanently and irrevocably deleted from our active systems. Deletion occurs in the ordinary course of our operations and no later than 48 hours following completion of analysis, unless required to be retained by applicable law.
              </Subsection>
              <Subsection number="3.2" title="Backup Systems">
                You acknowledge that Submitted Documents may temporarily exist in encrypted backup systems as part of routine data backup operations. Such backup copies are isolated from active processing and are deleted in accordance with our standard backup retention schedule. The existence of backup copies during the deletion transition period does not constitute a violation of this Policy.
              </Subsection>
              <Subsection number="3.3" title="Output Documents">
                Output Documents generated by the Platform are made available to you for download following completion of analysis. Output Documents are retained on the Platform for a limited period to allow download, after which they are deleted. You are solely responsible for downloading and retaining any Output Documents you wish to preserve. The Company has no liability for Output Documents that are deleted in the ordinary course of our operations.
              </Subsection>
              <Subsection number="3.4" title="Account Information">
                Account information and transaction records are retained for as long as your account is active and for a reasonable period thereafter as required for legal, tax, and business purposes. You may request deletion of your account by contacting us at{" "}
                <a href="mailto:info@liminalsva.com" className="text-certify-blue hover:text-certify-teal transition-colors">info@liminalsva.com</a>.
                {" "}We may retain certain information as required by law or for legitimate business purposes even following account deletion.
              </Subsection>
            </Section>

            <Section number="4" title="INFORMATION SHARING AND DISCLOSURE">
              <Subsection number="4.1" title="Third-Party Service Providers">
                We share information with third-party service providers who perform services on our behalf, including payment processing, cloud hosting, email delivery, AI processing, cybersecurity, and analytics. These providers are contractually obligated to use your information only as directed by us and in accordance with their own privacy and security obligations. We are not responsible for the privacy practices of third-party providers beyond our contractual arrangements with them.
              </Subsection>
              <Subsection number="4.2" title="AI Processing Providers">
                The Service is powered by third-party artificial intelligence platforms, whose AI technology processes Submitted Documents and generates Output Documents. By using the Service, you acknowledge and consent to the transmission of Submitted Documents to such AI providers for processing. The AI providers are subject to their own terms of service and privacy policies. We do not control and are not responsible for the data practices of AI providers beyond our contractual arrangements with them.
              </Subsection>
              <Subsection number="4.3" title="Legal Requirements">
                We may disclose your information if required to do so by applicable law, court order, subpoena, or governmental authority, or if we believe in good faith that such disclosure is necessary to: (a) comply with applicable legal process; (b) protect the rights, property, or safety of the Company, its users, or others; (c) prevent or investigate fraud or illegal activity; or (d) enforce our Terms of Service.
              </Subsection>
              <Subsection number="4.4" title="Business Transfers">
                In the event of a merger, acquisition, reorganization, sale of substantially all assets, or bankruptcy, your information may be transferred to the acquiring entity as part of the transaction. We will use reasonable efforts to notify you of any such transfer through the Platform or by email.
              </Subsection>
              <Subsection number="4.5" title="Aggregate and De-Identified Data">
                We may share aggregated, anonymized, or de-identified information that does not personally identify you with third parties for any lawful purpose, including research, analysis, and improvement of the Service.
              </Subsection>
            </Section>

            <Section number="5" title="DATA SECURITY">
              The Company uses commercially reasonable technical and organizational security measures designed to protect your information from unauthorized access, disclosure, alteration, or destruction. These measures include encryption in transit and at rest, access controls, and regular security assessments. However, no method of electronic transmission or storage is completely secure.{" "}
              <span className="font-medium">The Company does not guarantee the absolute security of your information and shall not be liable for any security breach that occurs despite our reasonable security measures.</span>{" "}
              You submit information to the Platform at your own risk. You are responsible for maintaining the security of your account credentials.
            </Section>

            <Section number="6" title="YOUR RIGHTS AND CHOICES">
              <Subsection number="6.1" title="Access and Correction">
                You may access and update your account information by logging into your account or by contacting us. We will use reasonable efforts to maintain the accuracy of your information.
              </Subsection>
              <Subsection number="6.2" title="Deletion Requests">
                Subject to applicable law and our legitimate business needs (including legal, compliance, and fraud prevention purposes), you may request deletion of your account and personal information by contacting us at{" "}
                <a href="mailto:info@liminalsva.com" className="text-certify-blue hover:text-certify-teal transition-colors">info@liminalsva.com</a>.
                {" "}Submitted Documents are deleted automatically as described in Section 3 and are not subject to individual deletion requests outside of that process.
              </Subsection>
              <Subsection number="6.3" title="Marketing Communications">
                If we send you marketing communications, you may opt out by following the unsubscribe instructions in those communications or by contacting us directly. Transactional communications related to your account and Service use may not be opted out of while your account is active.
              </Subsection>
              <Subsection number="6.4" title="Do Not Track">
                The Platform does not currently respond to "Do Not Track" signals from browsers.
              </Subsection>
              <Subsection number="6.5" title="California Residents">
                To the extent applicable, California residents may have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information is collected, the right to request deletion, and the right to opt out of sale of personal information. We do not sell personal information. For California-specific inquiries, contact us at{" "}
                <a href="mailto:info@liminalsva.com" className="text-certify-blue hover:text-certify-teal transition-colors">info@liminalsva.com</a>.
              </Subsection>
              <Subsection number="6.6" title="EU/UK Residents">
                If you are located in the European Economic Area or United Kingdom, you may have rights under the General Data Protection Regulation (GDPR) or UK GDPR, including rights to access, rectification, erasure, restriction, data portability, and objection. Our legal basis for processing is your consent (as provided by acceptance of these Terms) and the performance of our contractual obligations to you. For GDPR-related inquiries, contact{" "}
                <a href="mailto:info@liminalsva.com" className="text-certify-blue hover:text-certify-teal transition-colors">info@liminalsva.com</a>.
                {" "}You have the right to lodge a complaint with your applicable supervisory authority.
              </Subsection>
            </Section>

            <Section number="7" title="THIRD-PARTY LINKS AND SERVICES">
              The Platform may contain links to third-party websites or services. This Policy does not apply to such third-party sites. We are not responsible for the privacy practices or content of third parties. We encourage you to review the privacy policies of any third-party sites you visit.
            </Section>

            <Section number="8" title="CHILDREN'S PRIVACY">
              The Service is not directed to children under the age of thirteen (13), and we do not knowingly collect personal information from children under 13. If we learn that we have collected personal information from a child under 13, we will delete it promptly.
            </Section>

            <Section number="9" title="CHANGES TO THIS POLICY">
              We reserve the right to update or modify this Policy at any time. We will notify you of material changes by posting the updated Policy on the Platform or by email. Your continued use of the Service after any modification constitutes your acceptance of the updated Policy. We encourage you to review this Policy periodically.
            </Section>

            <Section number="10" title="DISCLAIMER OF LIABILITY FOR DATA EVENTS">
              <p className="text-sm text-certify-cool-grey leading-relaxed font-medium">
                To the maximum extent permitted by applicable law, the Company shall not be liable for any loss, damage, or harm arising from: (A) any unauthorized access to, use of, or alteration of your Submitted Documents or personal information; (B) any failure of third-party security systems; (C) any transmission errors or interception of communications; or (D) any other data security event affecting Submitted Documents or account information, except in cases of the Company's gross negligence or willful misconduct as determined by a court of competent jurisdiction. In all cases, the Company's liability shall be subject to the limitation of liability set forth in the Terms of Service.
              </p>
            </Section>

            <Section number="11" title="CONTACT INFORMATION">
              <p className="text-sm text-certify-cool-grey leading-relaxed">
                For questions, requests, or concerns regarding this Privacy Policy or our data practices, please contact us at:
              </p>
              <div className="mt-3 text-sm text-certify-cool-grey leading-relaxed">
                <p className="font-medium text-certify-deep">LIMINALsva, a service of KLM Design Studio, Inc.</p>
                <p>
                  Email:{" "}
                  <a href="mailto:info@liminalsva.com" className="text-certify-blue hover:text-certify-teal transition-colors">
                    info@liminalsva.com
                  </a>
                </p>
              </div>
              <p className="mt-3 text-sm text-certify-cool-grey leading-relaxed">
                We will endeavor to respond to all legitimate inquiries within a reasonable time.
              </p>
            </Section>

          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-serif text-xl text-certify-deep mb-4 pb-2 border-b border-certify-white">
        {number}. {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Subsection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-certify-deep mb-2">{number} {title}</h3>
      <div className="text-sm text-certify-cool-grey leading-relaxed">{children}</div>
    </div>
  );
}
