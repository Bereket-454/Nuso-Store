import { supabase } from '../lib/supabase'
import { SAMPLE_PRODUCTS, CATEGORIES, SUBCATEGORIES } from '../data/mockData'

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
    images: row.images,
    isBestSeller: row.is_best_seller,
    isNewArrival: row.is_new_arrival,
  }
}

/**
 * Fetch all products from Supabase.
 * Falls back to SAMPLE_PRODUCTS from mockData if the query fails or returns nothing.
 */
export async function fetchProducts() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.log('[fetchProducts] Supabase error — falling back to mockData:', error.message)
      throw error
    }
    if (!data || data.length === 0) {
      console.log('[fetchProducts] Supabase returned 0 rows — falling back to mockData')
      return SAMPLE_PRODUCTS
    }
    console.log(`[fetchProducts] Loaded ${data.length} products from Supabase`)
    return data.map(rowToProduct)
  } catch {
    console.log('[fetchProducts] Caught exception — falling back to mockData')
    return SAMPLE_PRODUCTS
  }
}

/**
 * Upsert a product to Supabase.
 * Generates an id if none is provided (new product).
 * Returns { id, error }.
 */
export async function upsertProduct(product) {
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
  const { error } = await supabase.from('products').delete().eq('id', id)
  return { error }
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
