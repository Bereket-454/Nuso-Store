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

    if (error) throw error
    if (!data || data.length === 0) return SAMPLE_PRODUCTS
    return data.map(rowToProduct)
  } catch {
    return SAMPLE_PRODUCTS
  }
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
