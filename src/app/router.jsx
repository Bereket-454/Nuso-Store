import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { AdminRoute } from '../components/AdminRoute'
import { HomePage } from '../pages/HomePage'
import { ProductsPage } from '../pages/ProductsPage'
import { CategoryPage } from '../pages/CategoryPage'
import { ProductDetailsPage } from '../pages/ProductDetailsPage'
import { CartPage } from '../pages/CartPage'
import { CheckoutPage } from '../pages/CheckoutPage'
import { OrderConfirmationPage } from '../pages/OrderConfirmationPage'
import { AccountPage } from '../pages/AccountPage'
import { TrackingPage } from '../pages/TrackingPage'
import { AdminDashboardPage } from '../pages/AdminDashboardPage'
import { NotFoundPage } from '../pages/NotFoundPage'

export function AppRouter() {
  return (
    <Routes>
      <Route element={<Layout />} path="/">
        <Route index element={<HomePage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:id" element={<ProductDetailsPage />} />
        <Route path="category/:slug" element={<CategoryPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="order-confirmation/:id" element={<OrderConfirmationPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="tracking" element={<TrackingPage />} />
        <Route element={<AdminRoute />}>
          <Route path="admin" element={<AdminDashboardPage />} />
        </Route>
        <Route path="home" element={<Navigate replace to="/" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
