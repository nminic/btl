import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'

const root = document.getElementById('root')

if (root === null) {
  throw new Error('index.html carries no #root for the portal to be drawn into')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
