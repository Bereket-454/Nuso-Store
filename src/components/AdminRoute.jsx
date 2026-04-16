import { Navigate, Outlet } from 'react-router-dom'
import { useStore } from '../app/store'
import { isAdminUser } from '../utils/auth'

/**
 * Route guard for all /admin/* paths.
 *
 * Behaviour:
 *   - Not signed in       → /account  (user needs to sign in first)
 *   - Signed in, no admin → /         (redirect home silently)
 *   - Signed in + admin   → renders the protected route via <Outlet />
 */
export function AdminRoute() {
  const { state } = useStore()

  if (!state.user) {
    return <Navigate to="/account" replace />
  }

  if (!isAdminUser(state.user)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
