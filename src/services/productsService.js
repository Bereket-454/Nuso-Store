import { supabase } from '../lib/supabase'
import { CATEGORIES, SUBCATEGORIES } from '../data/mockData'

/**
 * Map a Supabase row (snake_case) back to the product shape the app expects (camelCase).
 */
function rowToProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    // Normalize to array: prefer the stored categories array, fall back to wrapping category string.
    categories: row.categories && row.categories.length > 0 ? row.categories : [row.category],
    subcategory: row.subcategory,
    price: row.price,
    stock: row.stock,
    colors: row.colors,
    sizes: row.sizes,
    description: row.description,
    shortDescription: row.short_description ?? '',
    features: row.features ?? [],
    extraInfo: row.extra_info ?? '',
    images: row.images,
    isBestSeller: row.is_best_seller,
    isNewArrival: row.is_new_arrival,
  }
}

/**
 * Fetch all products from Supabase.
 * Returns an empty array on error or when no products exist — never falls back to mockData.
 */
export async function fetchProducts() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[fetchProducts] Supabase error:', error.message)
      return []
    }
    console.log(`[fetchProducts] Loaded ${data.length} products from Supabase`)
    return data.map(rowToProduct)
  } catch (err) {
    console.error('[fetchProducts] Unexpected error:', err)
    return []
  }
}

/**
 * Fetch a single page of products for paginated / lazy catalog loading.
 * offset is zero-based; limit defaults to 20.
 */
export async function fetchProductsPage(offset = 0, limit = 20) {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[fetchProductsPage] Supabase error:', error.message)
      return []
    }
    return data.map(rowToProduct)
  } catch (err) {
    console.error('[fetchProductsPage] Unexpected error:', err)
    return []
  }
}

/**
 * Fetch the minimal sets needed by the homepage:
 * up to 8 best sellers and up to 8 new arrivals in parallel.
 */
export async function fetchHomeProducts() {
  const [bestRes, newRes] = await Promise.all([
    supabase.from('products').select('*').eq('is_best_seller', true).limit(8),
    supabase.from('products').select('*').eq('is_new_arrival', true).limit(8),
  ])
  return {
    bestSellers: (bestRes.data || []).map(rowToProduct),
    newArrivals: (newRes.data || []).map(rowToProduct),
  }
}

/**
 * Upsert a product to Supabase.
 * Generates an id if none is provided (new product).
 * Pass { addedById, addedByEmail } only when inserting — never on edits — so the
 * original author is never overwritten by subsequent saves.
 * Returns { id, error }.
 */
export async function upsertProduct(product, { addedById, addedByEmail } = {}) {
  const id = product.id && product.id.trim() ? product.id.trim() : `p-${Date.now()}`
  // Normalize categories: prefer the array, otherwise wrap the single category string.
  const categories = Array.isArray(product.categories) && product.categories.length > 0
    ? product.categories
    : [product.category || 'men']
  const row = {
    id,
    name: product.name,
    category: categories[0],   // keep primary category for backward compat
    categories,
    subcategory: product.subcategory,
    price: product.price,
    stock: product.stock,
    colors: product.colors,
    sizes: product.sizes,
    description: product.description,
    images: product.images,
    is_best_seller: product.isBestSeller ?? false,
    is_new_arrival: product.isNewArrival ?? false,
  }
  if (addedById) {
    row.added_by_id = addedById
    row.added_by_email = addedByEmail || null
  }
  console.log('[upsertProduct] saving row — categories:', row.categories, 'category:', row.category)
  const { error } = await supabase.from('products').upsert(row, { onConflict: 'id' })
  if (error) console.error('[upsertProduct] error:', error.message, error)
  return { id, error }
}

/**
 * Delete a product from Supabase by id.
 * Returns { error }.
 */
export async function deleteProduct(id) {
  console.log('[deleteProduct] attempting delete for id:', id)
  const result = await supabase.from('products').delete().eq('id', id)
  console.log('[deleteProduct] full result:', JSON.stringify({ data: result.data, error: result.error, status: result.status, statusText: result.statusText }))
  return { error: result.error }
}

/**
 * Recalculate which products are "best sellers" based on order history.
 * Counts total quantity ordered per product across all orders, marks the
 * top 5 as isBestSeller=true and clears the flag on all others.
 *
 * If there are no orders yet the function is a no-op — manual admin tagging
 * (set via the product form) is left untouched.
 *
 * Call this after every new order is placed.
 */
export async function recalculateBestSellers(orders) {
  if (!orders || orders.length === 0) {
    console.log('[recalculateBestSellers] No orders yet — manual tagging preserved.')
    return
  }

  // Tally total quantity ordered per product across all orders.
  const counts = {}
  for (const order of orders) {
    for (const item of order.items || []) {
      if (item.productId) {
        counts[item.productId] = (counts[item.productId] || 0) + (item.quantity || 1)
      }
    }
  }

  if (Object.keys(counts).length === 0) return

  const top5 = new Set(
    Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => id),
  )

  console.log('[recalculateBestSellers] Top 5 by order volume:', [...top5])

  // Fetch current flags so we only write rows that actually need to change.
  const { data: products, error: fetchErr } = await supabase
    .from('products')
    .select('id, is_best_seller')

  if (fetchErr) {
    console.error('[recalculateBestSellers] fetch error:', fetchErr.message)
    return
  }

  const toTrue  = products.filter((p) => top5.has(p.id)  && !p.is_best_seller).map((p) => p.id)
  const toFalse = products.filter((p) => !top5.has(p.id) &&  p.is_best_seller).map((p) => p.id)

  const ops = []
  if (toTrue.length)  ops.push(supabase.from('products').update({ is_best_seller: true  }).in('id', toTrue))
  if (toFalse.length) ops.push(supabase.from('products').update({ is_best_seller: false }).in('id', toFalse))

  if (ops.length === 0) {
    console.log('[recalculateBestSellers] No changes needed.')
    return
  }

  const results = await Promise.all(ops)
  results.forEach(({ error }) => {
    if (error) console.error('[recalculateBestSellers] update error:', error.message)
  })
  console.log(`[recalculateBestSellers] Done. Set true: [${toTrue}] | Set false: [${toFalse}]`)
}

/**
 * Fetch primary audience categories (men / women / children) from Supabase.
 * Falls back to the static CATEGORIES list from mockData if unavailable.
 */
export async function fetchCategories() {
  try {
    const { data, error } = await supabase.from('categories').select('slug, label')

    if (error) throw error
    if (!data || data.length === 0) return CATEGORIES
    return data
  } catch {
    return CATEGORIES
  }
}

/**
 * Fetch subcategory filters (apparel / shoes / perfumes / appliances) from Supabase.
 * Falls back to the static SUBCATEGORIES list from mockData if unavailable.
 */
export async function fetchSubcategories() {
  try {
    const { data, error } = await supabase.from('subcategories').select('slug, label')

    if (error) throw error
    if (!data || data.length === 0) return SUBCATEGORIES
    return data
  } catch {
    return SUBCATEGORIES
  }
}
