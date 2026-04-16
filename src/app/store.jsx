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
    merged.user = null // session is managed by Supabase, not localStorage
    merged.cart = []   // cart is managed per-user; loaded after auth resolves
    return merged
  } catch {
    return initialState
  }
}

function persist({ user: _user, cart: _cart, ...rest }) {
  // Exclude `user` (Supabase manages session) and `cart` (managed per-user below).
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
    case 'CATALOGUE_LOADED':
      return {
        ...state,
        products: action.payload.products.map(normalizeProduct),
        categories: action.payload.categories,
        subcategories: action.payload.subcategories,
      }
    case 'AUTH_CHANGED':
      if (!action.payload) {
        // Sign-out: clear user and cart.
        return { ...state, user: null, cart: [] }
      }
      // Sign-in: set user and restore their saved cart in one atomic update
      // so there is no intermediate render with the wrong (empty or stale) cart.
      return { ...state, user: action.payload.user, cart: action.payload.cart }
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
    Promise.all([fetchProducts(), fetchCategories(), fetchSubcategories()]).then(
      ([products, categories, subcategories]) => {
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
