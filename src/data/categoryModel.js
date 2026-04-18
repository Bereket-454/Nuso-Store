/**
 * Category model:
 * - `category` on products = primary audience: men | women | children (nav + main taxonomy).
 * - `subcategory` = apparel | shoes | perfumes | appliances (filters inside each primary category).
 * Legacy routes `/category/shoes` etc. still match products by subcategory across all audiences.
 */
export const PRIMARY_CATEGORIES = [
  { slug: 'men', label: 'Men' },
  { slug: 'women', label: 'Women' },
  { slug: 'children', label: 'Children' },
]

export const SUBCATEGORIES = [
  { slug: 'apparel', label: 'Clothing' },
  { slug: 'shoes', label: 'Shoes' },
  { slug: 'perfumes', label: 'Perfumes' },
  { slug: 'appliances', label: 'Appliances' },
]

export const PRIMARY_SLUG_SET = new Set(PRIMARY_CATEGORIES.map((c) => c.slug))

export function isPrimaryCategorySlug(slug) {
  return PRIMARY_SLUG_SET.has(slug)
}

export function subcategoryLabel(slug) {
  return SUBCATEGORIES.find((s) => s.slug === slug)?.label ?? slug
}

/** Normalize persisted products from older schema (category was sometimes shoes/perfumes/appliances). */
export function normalizeProduct(product) {
  const cat = product.category
  let normalized
  if (cat === 'shoes' || cat === 'perfumes' || cat === 'appliances') {
    const defaults = { shoes: 'men', perfumes: 'women', appliances: 'women' }
    normalized = {
      ...product,
      category: defaults[cat] ?? 'men',
      subcategory: cat,
    }
  } else if (isPrimaryCategorySlug(cat)) {
    normalized = {
      ...product,
      subcategory: product.subcategory || 'apparel',
    }
  } else {
    normalized = {
      ...product,
      category: 'men',
      subcategory: product.subcategory || 'apparel',
    }
  }
  // Ensure categories array is always present for multi-category support.
  if (!normalized.categories || normalized.categories.length === 0) {
    normalized.categories = [normalized.category]
  }
  return normalized
}
