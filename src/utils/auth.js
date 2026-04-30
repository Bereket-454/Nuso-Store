/**
 * Role hierarchy for the Nuso admin system.
 *
 * Roles are stored in the Supabase `profiles` table and fetched after every
 * auth event — never derived from client input.
 *
 * To assign a role:
 *   UPDATE profiles SET role = '<role>' WHERE phone = '+251XXXXXXXXX';
 *
 * Roles:
 *   super_admin      – full access to everything
 *   order_manager    – can view Orders and advance early stages (confirming, confirmed)
 *   delivery_manager – can view Orders and advance fulfillment stages (preparing → delivered)
 *   product_operator – can manage Products and Inventory; cannot see orders or business financials
 *
 * Legacy roles kept for backwards compatibility:
 *   admin  – treated as super_admin
 *   staff  – treated as product_operator
 */

export function isSuperAdmin(profile) {
  return profile?.role === 'super_admin' || profile?.role === 'admin'
}

export function isOrderManager(profile) {
  return profile?.role === 'order_manager'
}

export function isDeliveryManager(profile) {
  return profile?.role === 'delivery_manager'
}

export function isProductOperator(profile) {
  return profile?.role === 'product_operator' || profile?.role === 'staff'
}

export function isAnyAdmin(profile) {
  return isSuperAdmin(profile) || isOrderManager(profile) || isDeliveryManager(profile) || isProductOperator(profile)
}

// Backwards-compat alias — used by Layout.jsx, AdminRoute.jsx, and any call site
// that only needs to know "is this user allowed into the admin area at all."
export function isAdminUser(user) {
  return isAnyAdmin(user)
}
