import { useNavigate } from 'react-router-dom'

const SUPPORT_EMAIL = 'greentreeappsdevelopment@gmail.com'

function Privacy() {
  const navigate = useNavigate()

  return (
    <div className="page legal-page">
      <button className="btn-back legal-back" onClick={() => navigate(-1)}>← Back</button>

      <div className="page-header">
        <h1 className="page-title">Privacy Policy</h1>
        <p className="page-subtitle">Effective Date: April 8, 2026</p>
      </div>

      <div className="legal-content">

        <h2>1. Overview</h2>
        <p>This policy explains what data Provenance collects, how it is used, and your rights regarding that data. Provenance is built for personal use — we collect the minimum data necessary to operate the service.</p>

        <h2>2. Data We Collect</h2>
        <p><strong>Account data:</strong> When you sign in, we collect your name, email address, and a unique identifier from your authentication provider (Google, Apple, or email/password). We store this in Firebase Firestore to identify your account.</p>
        <p><strong>Asset data:</strong> Photos, descriptions, estimated values, provenance notes, and category information you enter for items in your registry.</p>
        <p><strong>Estate planning documents:</strong> Files you upload to the Document Center, stored in Firebase Storage.</p>
        <p><strong>Usage data:</strong> Basic metadata such as when assets were created or updated, and when documents were last reviewed.</p>
        <p><strong>Beneficiary data:</strong> Names, email addresses, and relationship labels you enter when inviting beneficiaries. These are stored in Firestore and used only to grant access to your shared registry.</p>

        <h2>3. Data We Do Not Collect</h2>
        <p>We do not collect payment card information directly — payments are handled entirely by Stripe. We do not collect your location, browsing history, or any data beyond what you explicitly provide. We do not use cookies for tracking or advertising.</p>

        <h2>4. How We Use Your Data</h2>
        <ul className="legal-list">
          <li>To operate your account and sync your registry across devices</li>
          <li>To enable beneficiary sharing when you choose to share</li>
          <li>To provide AI-powered features (see Section 5)</li>
          <li>To send transactional notifications if you opt in (e.g., beneficiary activity)</li>
        </ul>
        <p>We do not sell your data. We do not use your data for advertising. We do not share your data with third parties except as described in this policy.</p>

        <h2>5. AI Processing</h2>
        <p>When you use AI photo identification or AI writing assist, the relevant photo or text is sent to the Anthropic API for processing. Anthropic receives only the content needed to complete that specific request. We do not send your full registry or unrelated data to Anthropic. Please review Anthropic's privacy policy at anthropic.com/privacy for details on how they handle API data.</p>

        <h2>6. Third-Party Services</h2>
        <p>Provenance is built on the following infrastructure:</p>
        <ul className="legal-list">
          <li><strong>Firebase (Google)</strong> — authentication, database, file storage, hosting. Google's privacy policy applies to Firebase services.</li>
          <li><strong>Anthropic</strong> — AI features. Anthropic's privacy policy applies to API processing.</li>
          <li><strong>Stripe</strong> — payment processing. Stripe's privacy policy applies to billing data.</li>
        </ul>

        <h2>7. Data Storage and Security</h2>
        <p>Your data is stored in Firebase (Google Cloud infrastructure). Asset photos and documents are stored in Firebase Storage with access rules that restrict reads and writes to your account only. Beneficiaries you invite can access only the portions of your registry you have explicitly shared. We use Firebase's built-in security rules to enforce these restrictions.</p>

        <h2>8. Data Retention</h2>
        <p>Your data is retained as long as your account is active. If you delete your account, your data is removed from our systems within 30 days. Archived assets remain in your account until permanently deleted by you.</p>

        <h2>9. Your Rights</h2>
        <p>You may access, export, or delete your data at any time through the app. To request a full data export or account deletion, contact us at <a className="legal-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. If you are in the European Economic Area, you have additional rights under GDPR including the right to object to processing and the right to data portability.</p>

        <h2>10. Children's Privacy</h2>
        <p>Provenance is not directed at children under 13 and we do not knowingly collect data from children under 13.</p>

        <h2>11. Changes to This Policy</h2>
        <p>We may update this policy as the service evolves. We will post the updated policy in the app and update the effective date above. Continued use after changes constitutes acceptance.</p>

        <h2>12. Contact</h2>
        <p>Privacy questions or data requests: <a className="legal-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>

      </div>
    </div>
  )
}

export default Privacy
