import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'
import { reloadOnceWhenAPieceIsGone } from './app/staleChunks'

/* A tab opened before a deploy asks for pieces the deploy replaced; it reads the page again once
   (`app/staleChunks.ts`). */
reloadOnceWhenAPieceIsGone(window)

const root = document.getElementById('root')

if (root === null) {
  throw new Error('index.html carries no #root for the portal to be drawn into')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
