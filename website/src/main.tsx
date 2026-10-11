import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerWebApp } from './layout/webApp'

// Install to home screen, offline screen and phone notifications (see layout/webApp.tsx)
registerWebApp()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
