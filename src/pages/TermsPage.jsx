import { Link } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'

export function TermsPage() {
  usePageMeta('Terms of Service | Nuso Store', 'Terms of service for Nuso Store — online shopping in Wolaita Sodo, Ethiopia.')

  return (
    <article className="legal-page">
      <header className="legal-page__header">
        <h1 className="legal-page__title">Terms of Service</h1>
        <p className="legal-page__updated">Last updated: May 2026 &nbsp;·&nbsp; Nuso Store, Wolaita Sodo, Ethiopia</p>
      </header>

      <div className="legal-section">
        <p>
          Welcome to Nuso Store. By placing an order or using our website, you agree to these terms.
          Please read them carefully. If you have questions, contact us on{' '}
          <a href="https://t.me/nusostore" target="_blank" rel="noopener noreferrer">Telegram</a>{' '}
          or call <a href="tel:0992728667">0992728667</a>.
        </p>
      </div>

      <div className="legal-section">
        <h2>1. Who We Are</h2>
        <p>
          Nuso Store is an online retail store based in Wolaita Sodo, Ethiopia. We sell clothing,
          shoes, perfumes, and related items, and deliver them directly to your door within our
          delivery coverage area.
        </p>
      </div>

      <div className="legal-section">
        <h2>2. Placing an Order</h2>
        <p>When you place an order on Nuso Store:</p>
        <ul>
          <li>You receive an order confirmation with a unique order ID.</li>
          <li>Our team reviews your order and confirms availability before processing it.</li>
          <li>If an item is unavailable, we will notify you and offer a full refund or alternative.</li>
          <li>Confirmed orders are packed and dispatched for delivery.</li>
        </ul>
        <p>
          Order confirmation does not guarantee immediate dispatch — it means we have received your
          request and are verifying it.
        </p>
      </div>

      <div className="legal-section">
        <h2>3. Payment</h2>
        <p>We accept the following payment methods:</p>
        <ul>
          <li><strong>Cash on Delivery (COD):</strong> You pay when your order arrives at your door.</li>
          <li><strong>Telebirr:</strong> Mobile payment sent before or after confirmation, as agreed.</li>
          <li><strong>CBE Transfer:</strong> Commercial Bank of Ethiopia transfer to our account.</li>
        </ul>
        <p>
          For online payments (Telebirr or CBE), your payment status will be updated in your account
          once verified by our team.
        </p>
      </div>

      <div className="legal-section">
        <h2>4. Delivery</h2>
        <ul>
          <li>We currently deliver within Wolaita Sodo and nearby areas.</li>
          <li>Estimated delivery time is 1–3 business days after confirmation.</li>
          <li>Delivery fees are shown at checkout before you pay.</li>
          <li>Someone must be available to receive the order at the provided address.</li>
        </ul>
      </div>

      <div className="legal-section">
        <h2>5. Cancellations</h2>
        <p>
          You may cancel your order before it is prepared for delivery. Once an order is in the
          "Preparing" or "Out for Delivery" stage, cancellation may not be possible.
        </p>
        <p>
          To cancel, go to your account, find the order, and click "Cancel Order." You can also
          contact our support team directly.
        </p>
        <p>
          See our{' '}
          <Link to="/refund-policy">Refund &amp; Cancellation Policy</Link>{' '}
          for full details on refunds.
        </p>
      </div>

      <div className="legal-section">
        <h2>6. Product Accuracy</h2>
        <p>
          We make every effort to display products accurately, including photos, descriptions, and
          prices. However, actual colors may vary slightly due to screen settings, and product
          availability may change without notice.
        </p>
      </div>

      <div className="legal-section">
        <h2>7. Your Account</h2>
        <p>
          You are responsible for keeping your account credentials secure. Do not share your password.
          You may delete your account at any time from your account settings. We will retain your
          order records for accounting purposes as required by law.
        </p>
      </div>

      <div className="legal-section">
        <h2>8. Limitation of Liability</h2>
        <p>
          Nuso Store is not liable for delays caused by circumstances outside our control (weather,
          road conditions, carrier issues). Our maximum liability in any dispute is limited to the
          value of the order in question.
        </p>
      </div>

      <div className="legal-section">
        <h2>9. Changes to These Terms</h2>
        <p>
          We may update these terms from time to time. Continued use of our store after changes
          constitutes acceptance of the updated terms. We will note the "Last updated" date at
          the top of this page.
        </p>
      </div>

      <nav className="legal-nav">
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/refund-policy">Refund &amp; Cancellation Policy</Link>
        <Link to="/">Back to Store</Link>
      </nav>
    </article>
  )
}
