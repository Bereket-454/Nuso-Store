import { Link } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'

export function RefundPolicyPage() {
  usePageMeta('Refund & Cancellation Policy | Nuso Store', 'How cancellations and refunds work at Nuso Store.')

  return (
    <article className="legal-page">
      <header className="legal-page__header">
        <h1 className="legal-page__title">Refund &amp; Cancellation Policy</h1>
        <p className="legal-page__updated">Last updated: May 2026 &nbsp;·&nbsp; Nuso Store, Wolaita Sodo, Ethiopia</p>
      </header>

      <div className="legal-section">
        <p>
          We want every order to go smoothly. If something goes wrong, we'll do our best to make
          it right. Here's how cancellations and refunds work at Nuso Store.
        </p>
        <p>
          For any questions, contact us on{' '}
          <a href="https://t.me/nusostore" target="_blank" rel="noopener noreferrer">Telegram</a>{' '}
          or call <a href="tel:0987312250">0987312250</a>.
        </p>
      </div>

      <div className="legal-section">
        <h2>1. Cancellations</h2>
        <p>You can cancel your order at no cost as long as it has not yet been prepared for delivery.</p>
        <ul>
          <li><strong>Order Received / Confirming / Confirmed:</strong> You can cancel directly from your account — go to My Orders, find the order, and click "Cancel Order."</li>
          <li><strong>Preparing or Out for Delivery:</strong> Cancellation may not be possible at this stage. Contact us immediately via Telegram or phone and we'll do our best to help.</li>
          <li><strong>Delivered:</strong> Orders that have already been delivered cannot be cancelled.</li>
        </ul>
      </div>

      <div className="legal-section">
        <h2>2. When You're Eligible for a Refund</h2>
        <p>A refund will be issued in the following situations:</p>
        <ul>
          <li>An item you ordered is out of stock or unavailable after your payment was made.</li>
          <li>You cancel a paid order before it is prepared for delivery.</li>
          <li>Your order was not delivered and could not be rescheduled.</li>
          <li>You received a significantly wrong or damaged item.</li>
        </ul>
        <p>
          Refunds are <strong>not</strong> available for Cash on Delivery orders that have already
          been paid on receipt, unless the item is damaged or incorrect.
        </p>
      </div>

      <div className="legal-section">
        <h2>3. How Refunds Are Processed</h2>
        <p>Refunds are returned through the same payment method used for the original order:</p>
        <ul>
          <li>
            <strong>Telebirr:</strong> Refunded back to your Telebirr account. Processing takes
            1–3 business days after approval.
          </li>
          <li>
            <strong>CBE Transfer:</strong> Returned to your CBE account. You may be asked to
            provide your account details. Processing takes 1–5 business days.
          </li>
          <li>
            <strong>Cash on Delivery:</strong> If you paid cash and the item was unavailable or
            incorrect, we will arrange a cash refund or apply credit to your next order — whichever
            you prefer.
          </li>
        </ul>
      </div>

      <div className="legal-section">
        <h2>4. How to Request a Refund</h2>
        <ol>
          <li>Cancel your order from your account (if still cancellable), or contact us directly.</li>
          <li>Our team will review your request within 1 business day.</li>
          <li>Once approved, your refund will be initiated and you'll receive a confirmation.</li>
          <li>You can track the refund status in your account under My Orders.</li>
        </ol>
        <p>
          For the fastest response, message us on{' '}
          <a href="https://t.me/nusostore" target="_blank" rel="noopener noreferrer">Telegram</a>{' '}
          with your order ID.
        </p>
      </div>

      <div className="legal-section">
        <h2>5. Returns</h2>
        <p>
          We accept return requests submitted within <strong>7 days of delivery</strong>. To be eligible:
        </p>
        <ul>
          <li>The item must be unused and in its original condition.</li>
          <li>You must have a valid reason (wrong item, damaged, or not as described).</li>
          <li>Your return request must be submitted through your account under My Orders.</li>
        </ul>
        <p>
          Once we review and approve your request, we will arrange collection or instruct you on
          how to return the item. Return shipping costs may apply for "Changed my mind" requests.
        </p>
        <p>
          Return requests submitted after 7 days of delivery will not be accepted unless the item
          is defective or significantly different from what was described.
        </p>
      </div>

      <div className="legal-section">
        <h2>6. Exchanges</h2>

        <p>
          We don't currently offer direct exchanges through the app. If you received the wrong
          item or size, contact us immediately. We'll arrange a replacement delivery or refund
          on a case-by-case basis.
        </p>
      </div>

      <div className="legal-section">
        <h2>7. Non-Refundable Situations</h2>
        <ul>
          <li>Orders cancelled after they are out for delivery (unless item is unavailable).</li>
          <li>Items that have been used, washed, or damaged by the customer.</li>
          <li>Change of mind after an item has been delivered.</li>
          <li>Orders where the delivery address provided was incorrect.</li>
        </ul>
      </div>

      <nav className="legal-nav">
        <Link to="/terms">Terms of Service</Link>
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/">Back to Store</Link>
      </nav>
    </article>
  )
}
