import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import E6B from './e6b.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <E6B />
  </StrictMode>,
)
