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
  const row = {
    id,
    name: product.name,
    category: product.category,
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
  const { error } = await supabase.from('products').upsert(row, { onConflict: 'id' })
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
