import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
/* Every stylesheet, in the order the cascade has always read them, with the portal's own `index.css` among
   them; `app/stylesheets.ts` says why the order is written down since the screens are loaded one by one. */
import './app/stylesheets'
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
