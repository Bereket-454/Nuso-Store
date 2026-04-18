/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { normalizeProduct } from '../data/categoryModel'
import { CATEGORIES, DELIVERY_FEE, SAMPLE_PRODUCTS, SUBCATEGORIES } from '../data/mockData'
import { fetchCategories, fetchProducts, fetchSubcategories } from '../services/productsService'
import { supabase } from '../lib/supabase'
import { fetchProfile } from '../lib/auth'

const STORAGE_KEY = 'dire-store-v1'
const CART_KEY_PREFIX = 'dire-cart-'

// Load the saved cart for a specific user from localStorage.
function loadUserCart(userId) {
  try {
    const raw = localStorage.getItem(CART_KEY_PREFIX + userId)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

// Persist the cart for a specific user to localStorage.
function saveUserCart(userId, cart) {
  try {
    localStorage.setItem(CART_KEY_PREFIX + userId, JSON.stringify(cart))
  } catch {
    // Ignore quota / private-mode errors.
  }
}

const StoreContext = createContext(null)

const initialState = {
  products: SAMPLE_PRODUCTS,
  categories: CATEGORIES,
  subcategories: SUBCATEGORIES,
  cart: [],
  cartPurged: false,   // true when CATALOGUE_LOADED silently removed stale cart items
  user: null,
  addresses: [],
  orders: [],
  deliveryFee: DELIVERY_FEE,
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    const parsed = JSON.parse(raw)
    const merged = { ...initialState, ...parsed }
    merged.products = (merged.products || []).map(normalizeProduct)
    merged.categories = CATEGORIES
    merged.subcategories = SUBCATEGORIES
    merged.user = null        // session is managed by Supabase, not localStorage
    merged.cart = []          // cart is managed per-user; loaded after auth resolves
    merged.cartPurged = false // reset on every page load
    return merged
  } catch {
    return initialState
  }
}

function persist({ user: _user, cart: _cart, cartPurged: _cartPurged, ...rest }) {
  // Exclude `user` (Supabase manages session), `cart` (managed per-user), and
  // `cartPurged` (transient UI flag — must not survive a page reload).
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
}

function reducer(state, action) {
  switch (action.type) {
    case 'CART_ADD': {
      const { productId, quantity, size, color } = action.payload
      const key = `${productId}-${size}-${color}`
      const existing = state.cart.find((item) => item.key === key)
      const cart = existing
        ? state.cart.map((item) =>
            item.key === key ? { ...item, quantity: item.quantity + quantity } : item,
          )
        : [...state.cart, { key, productId, quantity, size, color }]
      return { ...state, cart }
    }
    case 'CART_UPDATE':
      return {
        ...state,
        cart: state.cart
          .map((item) =>
            item.key === action.payload.key
              ? { ...item, quantity: Math.max(1, action.payload.quantity) }
              : item,
          )
          .filter((item) => item.quantity > 0),
      }
    case 'CART_REMOVE':
      return { ...state, cart: state.cart.filter((item) => item.key !== action.payload.key) }
    case 'CART_CLEAR':
      return { ...state, cart: [] }
    case 'SIGN_IN':
      return { ...state, user: action.payload.user }
    case 'SIGN_OUT':
      return { ...state, user: null }
    case 'UPDATE_USER':
      return {
        ...state,
        user: {
          ...(state.user || {}),
          ...action.payload,
        },
      }
    case 'SAVE_ADDRESS': {
      const address = { ...action.payload, id: `addr-${Date.now()}` }
      return { ...state, addresses: [address, ...state.addresses] }
    }
    case 'ORDER_CREATE':
      return { ...state, orders: [action.payload, ...state.orders], cart: [] }
    case 'ORDER_UPDATE_STATUS':
      return {
        ...state,
        orders: state.orders.map((order) =>
          order.id === action.payload.id
            ? { ...order, status: action.payload.status, updatedAt: new Date().toISOString() }
            : order,
        ),
      }
    case 'ADMIN_PRODUCT_UPSERT': {
      const incoming = normalizeProduct(action.payload)
      const exists = state.products.some((item) => item.id === incoming.id)
      const products = exists
        ? state.products.map((item) => (item.id === incoming.id ? incoming : item))
        : [{ ...incoming, id: `p-${Date.now()}` }, ...state.products]
      return { ...state, products }
    }
    case 'ADMIN_PRODUCT_DELETE':
      return { ...state, products: state.products.filter((item) => item.id !== action.payload.id) }
    case 'CATALOGUE_LOADED': {
      const loadedProducts = action.payload.products.map(normalizeProduct)
      const validIds = new Set(loadedProducts.map((p) => p.id))
      const cleanCart = state.cart.filter((item) => validIds.has(item.productId))
      const itemsRemoved = cleanCart.length < state.cart.length
      console.log(
        '[CATALOGUE_LOADED] products loaded:', loadedProducts.length,
        '| cart before purge:', state.cart.map((i) => i.productId),
        '| cart after purge:', cleanCart.map((i) => i.productId),
        '| items removed:', itemsRemoved,
      )
      return {
        ...state,
        products: loadedProducts,
        categories: action.payload.categories,
        subcategories: action.payload.subcategories,
        cart: cleanCart,
        // Preserve an existing true flag — AUTH_CHANGED may have already set it.
        cartPurged: state.cartPurged || itemsRemoved,
      }
    }
    case 'CART_PURGE_DISMISS':
      return { ...state, cartPurged: false }
    case 'AUTH_CHANGED': {
      if (!action.payload) {
        // Sign-out: clear user and cart.
        return { ...state, user: null, cart: [] }
      }
      // Sign-in: restore the user's saved cart, but validate it immediately if
      // products are already loaded. This handles the race where CATALOGUE_LOADED
      // fires before AUTH_CHANGED (Supabase cache hit) — it sees an empty cart so
      // cartPurged stays false, then AUTH_CHANGED lands the stale cart with no
      // further check. Validating here ensures that race path also purges correctly.
      const restoredCart = action.payload.cart
      if (state.products.length > 0) {
        const validIds = new Set(state.products.map((p) => p.id))
        const cleanCart = restoredCart.filter((item) => validIds.has(item.productId))
        const itemsRemoved = cleanCart.length < restoredCart.length
        console.log(
          '[AUTH_CHANGED] products already loaded — validating restored cart.',
          'before:', restoredCart.map((i) => i.productId),
          '| after:', cleanCart.map((i) => i.productId),
          '| items removed:', itemsRemoved,
        )
        return { ...state, user: action.payload.user, cart: cleanCart, cartPurged: itemsRemoved }
      }
      // Products not loaded yet — restore the cart as-is. CATALOGUE_LOADED will
      // purge any stale items when it fires.
      console.log(
        '[AUTH_CHANGED] products not yet loaded — deferring purge to CATALOGUE_LOADED.',
        'cart items:', restoredCart.length,
      )
      return { ...state, user: action.payload.user, cart: restoredCart }
    }
    default:
      return state
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    persist(state)
  }, [state])

  // Persist the cart to a user-specific localStorage key whenever it changes.
  // Runs only while a user is signed in; anonymous browsing is not persisted.
  useEffect(() => {
    if (state.user?.id) {
      saveUserCart(state.user.id, state.cart)
    }
  }, [state.cart, state.user?.id])

  // Load live catalogue from Supabase on mount; falls back to mockData if unavailable.
  useEffect(() => {
    console.log('[store] CATALOGUE_LOADED effect running')
    Promise.all([fetchProducts(), fetchCategories(), fetchSubcategories()]).then(
      ([products, categories, subcategories]) => {
        console.log(`[store] CATALOGUE_LOADED dispatched with ${products.length} products`)
        dispatch({ type: 'CATALOGUE_LOADED', payload: { products, categories, subcategories } })
      },
    )
  }, [])

  // Sync Supabase Auth session into store state.
  // Fires immediately on mount with INITIAL_SESSION (restores existing session on refresh),
  // then again on SIGNED_IN and SIGNED_OUT.
  //
  // IMPORTANT: the callback must NOT be async and must NOT await Supabase calls directly.
  // Supabase holds an internal auth lock while firing this callback. Any awaited Supabase
  // query (e.g. fetchProfile) inside an async callback will deadlock — the query is queued
  // behind the same lock and never resolves, so dispatch never fires and the UI never updates.
  // setTimeout(fn, 0) defers the async work to the next event loop tick, after the lock drops.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('onAuthStateChange fired', event, session?.user?.id)
      if (
        (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED') &&
        session?.user
      ) {
        // Defer past the Supabase auth lock so fetchProfile can run freely.
        setTimeout(async () => {
          const { profile } = await fetchProfile(session.user.id)
          const user = {
            id: session.user.id,
            email: session.user.email || profile?.email || '',
            phone: session.user.phone || profile?.phone || '',
            name: profile?.name || session.user.user_metadata?.name || '',
            role: profile?.role || 'user',
          }
          // Restore this user's saved cart. loadUserCart returns [] if nothing saved yet.
          const cart = loadUserCart(session.user.id)
          console.log('auth changed', user, 'cart items:', cart.length)
          dispatch({ type: 'AUTH_CHANGED', payload: { user, cart } })
        }, 0)
      } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
        console.log('auth changed', null)
        dispatch({ type: 'AUTH_CHANGED', payload: null })
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const value = useMemo(() => ({ state, dispatch }), [state])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const context = useContext(StoreContext)
  if (!context) {
    throw new Error('useStore must be used inside StoreProvider')
  }
  return context
}
