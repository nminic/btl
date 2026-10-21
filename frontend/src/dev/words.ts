import { dictionaryLocale } from '../i18n/config'
import { translate, type Dictionary, type TranslateParams } from '../i18n/translate'
import { useI18n } from '../i18n/useI18n'
import english from './words.en.json'
import serbian from './words.sr.json'

/**
 * THE WORDS OF THE TWO DEVELOPMENT CONTROLS, KEPT WHERE ONLY THEY CAN REACH THEM.
 *
 * The role switch and the switch of the day are not in the production bundle
 * (`dev/tools.ts`, ADL A15 of 01.08.2026: „ugašena kontrola je i dalje kod koji putuje u
 * paketu", and the measure is a `grep` over `dist/`). Their code went on 09.10.2026. Their
 * WORDS did not: `role.*`, `clock.*` and `server.named` stood in `sr.json` and `en.json`,
 * which every screen imports whole, so a production bundle carried „Današnji datum" and
 * „Vrati na stvarni datum" for a control it does not draw. What exists only because the
 * database does not yet exist must not reach the public address (ADL A15), and a sentence
 * for a control that is not there is the same thing as the control.
 *
 * **The same mechanism as the code, and for the same reason it works.** These two files
 * are imported here, and here is imported by the two switches and by nothing else. The
 * switches are reached through `loadTheDevControls`, which is `null` in a build without
 * `VITE_DEV_TOOLS=1` (`dev/tools.ts`), so the bundler never sees them, nor this module, nor
 * the two files. In a QA build all of them are in. `productionPackage.test.ts` asks the
 * bundler for both builds and holds each side.
 *
 * **Why not a branch inside `i18n/config.ts`.** A dictionary imported whole is one string
 * in the bundle, and deleting a key from it at run time deletes nothing from the package.
 * What the bundler can drop is a module nobody imports, so the words are a module of their
 * own.
 *
 * **The names are the ones they had**, `role.label`, `clock.reset`, `server.named`, so a
 * key read in a switch reads as it always did. They are asked of this dictionary and not
 * of `sr.json`, and `i18n/said.test.ts` holds that: a file that imports this module is
 * answered by it, every other file by the dictionary of the portal. That is also what
 * stops a key of the portal being written here, where it would be asked of the wrong book:
 * a screen that read `role.label` would find it missing in `sr.json`.
 */
const DICTIONARIES: Record<'sr' | 'en', Dictionary> = {
  sr: serbian,
  en: english,
}

/** The translator of the controls: the language of the address, the book of the controls. */
export function useDevWords(): { t: (key: string, params?: TranslateParams) => string } {
  const { locale } = useI18n()
  const text = dictionaryLocale(locale)

  return { t: (key, params) => translate(DICTIONARIES[text], text, key, params) }
}

/** Both books, for the guard that holds them to each other and to what the controls ask. */
export const DEV_WORDS = DICTIONARIES
