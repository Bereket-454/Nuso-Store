/**
 * Returns true if the signed-in user has the admin role.
 *
 * Role is fetched from the Supabase `profiles` table after every auth event
 * via the store's onAuthStateChange handler — it is never derived from client
 * input. The anon key cannot modify the `role` column (RLS only allows users
 * to read/update their own row, and the CHECK constraint limits values).
 *
 * To grant admin access, run this in the Supabase SQL editor:
 *   UPDATE profiles SET role = 'admin' WHERE phone = '+251XXXXXXXXX';
 *
 * Staff members (role = 'staff') can access /admin to add products only.
 * They cannot edit, delete, view inventory, orders, requests, or business info.
 *   UPDATE profiles SET role = 'staff' WHERE phone = '+251XXXXXXXXX';
 */
export function isAdminUser(user) {
  return user?.role === 'admin' || user?.role === 'staff'
}
