import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import e6b from './e6b.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <e6b />
  </StrictMode>,
)
