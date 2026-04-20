export function ProductCardSkeleton() {
  return (
    <article className="card product-card" aria-hidden="true">
      <div className="product-card__content">
        <div className="skeleton skeleton--image" />
        <div className="card-body">
          <div className="skeleton skeleton--line" style={{ width: '55%', marginBottom: '0.5rem' }} />
          <div className="skeleton skeleton--line" style={{ width: '80%', marginBottom: '0.4rem' }} />
          <div className="skeleton skeleton--line" style={{ width: '80%', marginBottom: '0.5rem' }} />
          <div className="skeleton skeleton--line" style={{ width: '38%', marginBottom: '0.4rem' }} />
          <div className="skeleton skeleton--line" style={{ width: '52%' }} />
        </div>
      </div>
      <div className="product-card__actions">
        <div className="skeleton skeleton--btn" />
      </div>
    </article>
  )
}
