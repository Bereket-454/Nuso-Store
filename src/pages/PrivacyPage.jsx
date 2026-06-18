import { Link } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'

export function PrivacyPage() {
  usePageMeta('Privacy Policy | Nuso Store', 'How Nuso Store collects, uses, and protects your personal data.')

  return (
    <article className="legal-page">
      <header className="legal-page__header">
        <h1 className="legal-page__title">Privacy Policy</h1>
        <p className="legal-page__updated">Last updated: May 2026 &nbsp;·&nbsp; Nuso Store, Wolaita Sodo, Ethiopia</p>
      </header>

      <div className="legal-section">
        <p>
          Your privacy matters to us. This policy explains what personal information Nuso Store
          collects, why we collect it, and how we protect it. We will never sell your data.
        </p>
        <p>
          If you have any questions, contact us on{' '}
          <a href="https://t.me/nusostore" target="_blank" rel="noopener noreferrer">Telegram</a>{' '}
          or call <a href="tel:0992728667">0992728667</a>.
        </p>
      </div>

      <div className="legal-section">
        <h2>1. What We Collect</h2>
        <p>When you use Nuso Store, we may collect the following:</p>
        <ul>
          <li><strong>Account information:</strong> Your full name, email address, and phone number when you create an account.</li>
          <li><strong>Delivery details:</strong> Your city, sub-city, and landmark for order delivery.</li>
          <li><strong>Order history:</strong> Items you ordered, prices paid, and order status.</li>
          <li><strong>Payment information:</strong> Payment method used (COD, Telebirr, or CBE). We do not store full bank account or mobile money details.</li>
          <li><strong>Support messages:</strong> Any messages you send to our team via Telegram or phone.</li>
          <li><strong>Device and usage data:</strong> Basic information about how you browse our site (page visits, errors) to help us improve the experience.</li>
        </ul>
      </div>

      <div className="legal-section">
        <h2>2. How We Use Your Data</h2>
        <p>We use your information only for the following purposes:</p>
        <ul>
          <li>Processing and delivering your orders</li>
          <li>Sending order status updates and confirmations</li>
          <li>Responding to your support requests</li>
          <li>Verifying your identity and account security</li>
          <li>Improving our store, products, and delivery service</li>
          <li>Complying with legal and accounting obligations</li>
        </ul>
        <p>We do not use your data for advertising on third-party platforms.</p>
      </div>

      <div className="legal-section">
        <h2>3. Who We Share Your Data With</h2>
        <p>We do not sell or rent your data to anyone. We may share limited information with:</p>
        <ul>
          <li><strong>Delivery partners:</strong> Your name, phone, and address so your order can be delivered.</li>
          <li><strong>Payment processors:</strong> Only the information required to verify a Telebirr or CBE payment.</li>
        </ul>
        <p>No other third parties receive your personal data.</p>
      </div>

      <div className="legal-section">
        <h2>4. Data Storage and Security</h2>
        <p>
          Your data is stored securely using Supabase, a hosted database platform with industry-standard
          encryption. Access is restricted to authorized Nuso Store staff only.
        </p>
        <p>
          We retain your account data for as long as your account is active. Order records are kept
          for accounting and legal compliance purposes even after account deletion.
        </p>
      </div>

      <div className="legal-section">
        <h2>5. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
          <li><strong>Correct:</strong> Update incorrect or outdated information through your account settings.</li>
          <li><strong>Delete:</strong> Permanently delete your account and personal data from your account settings. Order records are kept in anonymized form for accounting purposes.</li>
          <li><strong>Object:</strong> Contact us if you believe your data is being used inappropriately.</li>
        </ul>
        <p>
          To exercise any of these rights, contact us on{' '}
          <a href="https://t.me/nusostore" target="_blank" rel="noopener noreferrer">Telegram</a>{' '}
          or call <a href="tel:0992728667">0992728667</a>.
        </p>
      </div>

      <div className="legal-section">
        <h2>6. Cookies and Local Storage</h2>
        <p>
          We use browser local storage to remember your cart, language preference, and delivery
          details between visits. This data stays on your device and is not sent to our servers
          unless you complete a purchase.
        </p>
      </div>

      <div className="legal-section">
        <h2>7. Children's Privacy</h2>
        <p>
          Our store is not directed at children under 13. We do not knowingly collect personal
          data from children. If you believe a child has provided us with personal information,
          contact us so we can delete it.
        </p>
      </div>

      <div className="legal-section">
        <h2>8. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy periodically. Any changes will be reflected with an
          updated date at the top of this page.
        </p>
      </div>

      <nav className="legal-nav">
        <Link to="/terms">Terms of Service</Link>
        <Link to="/refund-policy">Refund &amp; Cancellation Policy</Link>
        <Link to="/">Back to Store</Link>
      </nav>
    </article>
  )
}
