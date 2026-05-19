import { Link } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'

const team = [
  {
    name: 'Bereket Demeke Korra',
    initials: 'BK',
    title: 'Founder & Technology Lead',
    desc: 'Built Nuso Store from the ground up. Leads product development, the app, and the technical infrastructure that keeps every order running smoothly.',
  },
  {
    name: 'Bereketab Desta Desalegn',
    nickname: 'Beri',
    initials: 'BD',
    title: 'Marketing & Customer Growth',
    desc: 'Drives awareness and customer relationships. Ensures every shopper hears about Nuso Store and keeps coming back.',
  },
  {
    name: 'Abenezer Belete Balcha',
    nickname: 'Abi',
    photo: '/abi.jpg',
    title: 'Operations & Delivery Lead',
    desc: 'Manages on-the-ground logistics and delivery. Makes sure orders leave on time and reach customers at their door.',
  },
]

const trustPoints = [
  { icon: '💳', text: 'No upfront payment required for most orders' },
  { icon: '📦', text: 'Every order is manually confirmed' },
  { icon: '🚚', text: 'Free delivery directly to your door' },
  { icon: '💬', text: 'Fast and responsive customer support' },
  { icon: '💰', text: 'Cash on Delivery, Telebirr, and CBE transfer' },
]

function TeamCard({ member }) {
  return (
    <div className="about-team-card">
      <div className="about-team-card__photo-wrap">
        {member.photo ? (
          <img
            src={member.photo}
            alt={member.name}
            className="about-team-card__photo"
          />
        ) : (
          <div className="about-team-card__photo about-team-card__photo--placeholder">
            <span>{member.initials}</span>
          </div>
        )}
      </div>
      <div className="about-team-card__body">
        <p className="about-team-card__name">
          {member.name}
          {member.nickname && (
            <span className="about-team-card__nickname"> ({member.nickname})</span>
          )}
        </p>
        <p className="about-team-card__title">{member.title}</p>
        <p className="about-team-card__desc">{member.desc}</p>
      </div>
    </div>
  )
}

export function AboutPage() {
  usePageMeta(
    'About Nuso Store | Wolaita Sodo, Ethiopia',
    'Meet the team behind Nuso Store — bringing convenient, trustworthy online shopping to Wolaita Sodo, Ethiopia.'
  )

  return (
    <div className="about-page">

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="about-hero about-hero--centered">
        <p className="about-hero__eyebrow">Our Story</p>
        <h1 className="about-hero__title">
          Built by a Team with a<br />
          <span className="about-hero__title--accent">Shared Vision</span>
        </h1>
        <p className="about-hero__body about-hero__body--wide">
          Nuso Store was founded by three Ethiopian entrepreneurs who believe shopping in Ethiopia
          should be simpler, faster, and more trustworthy. What began as an idea to help students
          and families in Wolaita Sodo access quality products online has grown into a team effort
          combining technology, marketing, and local operations.
        </p>
      </section>

      {/* ── Team ──────────────────────────────────────────────────── */}
      <section className="about-team">
        <h2 className="about-section-title about-section-title--center">Meet the team</h2>
        <div className="about-team__grid">
          {team.map((member) => (
            <TeamCard key={member.name} member={member} />
          ))}
        </div>
      </section>

      {/* ── Mission + Vision ──────────────────────────────────────── */}
      <section className="about-cards">
        <div className="about-card about-card--navy">
          <div className="about-card__icon" aria-hidden="true">🎯</div>
          <h2 className="about-card__title">Our Mission</h2>
          <p className="about-card__body">
            To build the most trusted local e-commerce platform in Ethiopia, starting from
            Wolaita Sodo.
          </p>
        </div>

        <div className="about-card about-card--orange">
          <div className="about-card__icon" aria-hidden="true">🔭</div>
          <h2 className="about-card__title">Our Vision</h2>
          <p className="about-card__body">
            Nuso Store is more than an online store. It is a step toward building a modern,
            reliable, and customer-focused e-commerce experience for communities that deserve
            better access to quality products and convenient delivery.
          </p>
        </div>
      </section>

      {/* ── Promise ───────────────────────────────────────────────── */}
      <section className="about-promise">
        <p className="about-promise__text">Shop More, Live Better.</p>
      </section>

      {/* ── Trust badges ─────────────────────────────────────────── */}
      <section className="about-trust">
        <h2 className="about-section-title">Why customers trust us</h2>
        <ul className="about-trust__list">
          {trustPoints.map((point) => (
            <li key={point.text} className="about-trust__item">
              <span className="about-trust__icon" aria-hidden="true">{point.icon}</span>
              <span>{point.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Support ───────────────────────────────────────────────── */}
      <section className="about-support">
        <h2 className="about-section-title">Get in touch</h2>
        <p className="about-support__sub">We usually reply within 30 minutes.</p>
        <div className="about-support__links">
          <a
            href="https://t.me/nusostore"
            target="_blank"
            rel="noopener noreferrer"
            className="about-support__btn about-support__btn--tg"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 14.447l-2.95-.924c-.64-.203-.654-.64.136-.95l11.49-4.427c.537-.194 1.006.131.696.102z"/>
            </svg>
            Chat on Telegram
          </a>
          <a
            href="tel:0987312250"
            className="about-support__btn about-support__btn--phone"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.68A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z"/>
            </svg>
            Call 0987312250
          </a>
        </div>
      </section>

      <nav className="legal-nav">
        <Link to="/terms">Terms of Service</Link>
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/refund-policy">Refund Policy</Link>
        <Link to="/">Back to Store</Link>
      </nav>

    </div>
  )
}
