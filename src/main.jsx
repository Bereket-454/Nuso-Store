import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { StoreProvider } from './app/store'
import { LanguageProvider } from './i18n'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <StoreProvider>
          <App />
        </StoreProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
)
