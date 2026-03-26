import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'sweetalert2/dist/sweetalert2.min.css'
import './index.css'

const savedTheme = localStorage.getItem('nc_theme')
if (savedTheme === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark')
  document.documentElement.setAttribute('data-bs-theme', 'dark')
} else {
  document.documentElement.setAttribute('data-theme', 'light')
  document.documentElement.setAttribute('data-bs-theme', 'light')
}
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
