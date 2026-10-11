import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ActionToaster } from './components/feedback/ActionToaster'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <ActionToaster />
  </StrictMode>,
)
