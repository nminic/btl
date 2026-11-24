import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
/* Every stylesheet, in the order the cascade has always read them, with the portal's own `index.css` among
   them; `app/stylesheets.ts` says why the order is written down since the screens are loaded one by one. */
import './app/stylesheets'
import App from './app/App.tsx'
import { forgetTheChosenTheme } from './app/forgetTheTheme'
import { reloadOnceWhenAPieceIsGone } from './app/staleChunks'
import { startTheFirstDictionary } from './i18n/config'

/* A tab opened before a deploy asks for pieces the deploy replaced; it reads the page again once
   (`app/staleChunks.ts`). */
reloadOnceWhenAPieceIsGone(window)

/* The choice of the light theme some readers made before it left the portal, taken out of their
   browser (`app/forgetTheTheme.ts`). */
forgetTheChosenTheme(window)

/* The book of the language the address carries, asked for before anything is drawn, so it is on its way
   while React starts; the page has already named it to the browser (`i18n/config.ts`). A failure here is
   answered where the book is waited for (`app/LocaleLayout.tsx`), which asks once more. */
startTheFirstDictionary(window).catch(() => undefined)

const root = document.getElementById('root')

if (root === null) {
  throw new Error('index.html carries no #root for the portal to be drawn into')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
