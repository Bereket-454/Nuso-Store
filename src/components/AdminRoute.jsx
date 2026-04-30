import { Navigate, Outlet } from 'react-router-dom'
import { useStore } from '../app/store'
import { isAnyAdmin } from '../utils/auth'

/**
 * Route guard for all /admin/* paths.
 *
 * Behaviour:
 *   - Not signed in              → /account  (sign in first)
 *   - Signed in, no admin role   → shows "no permission" message
 *   - Signed in + any admin role → renders the protected route via <Outlet />
 *
 * Section-level visibility is handled inside AdminDashboardPage and AdminNav
 * based on the specific role (super_admin, order_manager, etc.).
 */
export function AdminRoute() {
  const { state } = useStore()

  if (!state.user) {
    return <Navigate to="/account" replace />
  }

  if (!isAnyAdmin(state.user)) {
    return (
      <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--danger)' }}>
          You do not have permission to access this.
        </p>
      </div>
    )
  }

  return <Outlet />
}
