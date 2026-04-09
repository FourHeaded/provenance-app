import { useNavigate } from 'react-router-dom'

const SUPPORT_EMAIL = 'greentreeappsdevelopment@gmail.com'

function Terms() {
  const navigate = useNavigate()

  return (
    <div className="page legal-page">
      <button className="btn-back legal-back" onClick={() => navigate(-1)}>← Back</button>

      <div className="page-header">
        <h1 className="page-title">Terms of Service</h1>
        <p className="page-subtitle">Effective Date: April 8, 2026</p>
      </div>

      <div className="legal-content">

        <h2>1. Acceptance of Terms</h2>
        <p>By creating an account and using Provenance, you agree to these Terms of Service. If you do not agree, do not use the app.</p>

        <h2>2. What Provenance Is</h2>
        <p>Provenance is a personal estate asset registry that allows you to catalog valuable items, document their histories, store estate planning documents, and share your registry with designated beneficiaries. Provenance is a personal organizational tool — it is not a legal service, financial advisor, or estate planning attorney. Nothing in the app constitutes legal or financial advice.</p>

        <h2>3. Your Account</h2>
        <p>You are responsible for maintaining the security of your account credentials. Provenance supports sign-in via Google, Apple, and email/password. You must provide accurate information and keep it current. You may not share your account or use another person's account without permission.</p>

        <h2>4. Your Content</h2>
        <p>You retain full ownership of everything you upload — photos, documents, notes, and asset descriptions. By uploading content, you grant Provenance a limited license to store, display, and process that content solely to operate the service for you. We do not claim ownership of your content and do not use it for any purpose beyond delivering the app to you.</p>

        <h2>5. AI Features</h2>
        <p>Provenance uses the Anthropic Claude API to power photo identification and writing assistance features. When you use these features, photos and text you submit are sent to Anthropic's API for processing. This processing is governed by Anthropic's privacy policy and terms of service. Provenance does not train AI models on your content. AI-generated descriptions and valuations are estimates only — they are not professional appraisals and should not be relied upon for insurance, legal, or financial purposes.</p>

        <h2>6. Beneficiary Sharing</h2>
        <p>You may invite beneficiaries to view your registry. You are responsible for ensuring you have appropriate consent before sharing another person's contact information (such as their email address) with Provenance. Beneficiaries you invite will have read-only access to the portions of your registry you choose to share. You may revoke access at any time.</p>

        <h2>7. Estate Planning Documents</h2>
        <p>The Document Center allows you to store copies of estate planning documents for personal reference. Provenance is a storage and organizational tool only. We are not responsible for the legal validity, accuracy, or enforceability of any documents you store. Always work with a licensed attorney for estate planning matters.</p>

        <h2>8. Acceptable Use</h2>
        <p>You agree not to use Provenance to store illegal content, to impersonate others, to attempt to gain unauthorized access to other users' data, or to use the service in any way that violates applicable law.</p>

        <h2>9. Subscription and Payments</h2>
        <p>Provenance offers free and premium tiers. Premium features are described in the app. Subscriptions are billed through Stripe. Cancellations take effect at the end of the current billing period. Refunds are handled on a case-by-case basis — contact us at <a className="legal-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>

        <h2>10. Data and Deletion</h2>
        <p>You may delete your account at any time. Upon deletion, your assets, documents, and personal data will be removed from our systems within 30 days, except where retention is required by law.</p>

        <h2>11. Disclaimers</h2>
        <p>Provenance is provided "as is" without warranty of any kind. We do not guarantee uninterrupted availability, and we are not liable for any loss of data. Always maintain your own copies of important documents.</p>

        <h2>12. Limitation of Liability</h2>
        <p>To the maximum extent permitted by law, Provenance's liability to you for any claim arising from use of the service is limited to the amount you paid us in the 12 months preceding the claim, or $50, whichever is greater.</p>

        <h2>13. Changes to These Terms</h2>
        <p>We may update these terms from time to time. We will notify you of material changes by posting a notice in the app. Continued use after changes constitutes acceptance.</p>

        <h2>14. Contact</h2>
        <p>Questions about these terms: <a className="legal-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>

      </div>
    </div>
  )
}

export default Terms
