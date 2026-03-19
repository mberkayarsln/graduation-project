import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import 'leaflet/dist/leaflet.css'
import './assets/style.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
