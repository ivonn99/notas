import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'sweetalert2/dist/sweetalert2.min.css'
import './index.css'

const savedTheme = localStorage.getItem('nc_theme')
const initialTheme = savedTheme === 'light' ? 'light' : 'dark'
document.documentElement.setAttribute('data-theme', initialTheme)
document.documentElement.setAttribute('data-bs-theme', initialTheme)
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
