/**
 * THE LANGUAGE AN ACCOUNT'S MAIL IS WRITTEN IN, as this side of the portal reads it and writes it.
 *
 * <p>PDL, the answers of 17.10.2026 on the language of the mail (PR 545; chosen by the owner between
 * offered outcomes, so the sentence is the record's and not his own words): „Jezik pošte sme da
 * promeni svako ko ima nalog, i član bez plaćene članarine i član kome je istekla, jer je to
 * podešavanje naloga a ne takmičarsko pravo." The server holds it on the account
 * (`account.mail_language`, V59), answers it on `GET /api/me` as `mailLanguage`, and changes it
 * on `PUT /api/me/mail-language` (`MeMailLanguageApi`), which answers `{ "language": … }` with the
 * value the row now holds.
 *
 * <p><b>It is NOT the language of the page.</b> The page's language is the first segment of the
 * address (`i18n/config.ts`, PDL 03.10.2026: „Ekran ne pamti jezik") and remembers nothing; this is
 * a fact about the ACCOUNT. Registration is the one place the two meet, once, and only to choose
 * the first value (`Registration.tsx`); after that neither moves the other.
 *
 * <p><b>The two codes are written here and are not taken from `LOCALES`</b>, for the reason that
 * decides which of them a future change would break first: the pages of the portal and the languages
 * its mail is written in are two sets that happen to be equal today. A third language of the page
 * borrowed into this list would offer a member a choice `MailLanguage.of` answers 400. The floor is
 * `mailLanguage.test.ts`, which reads the codes out of `MailLanguage.java` and requires exactly
 * these.
 */
export const MAIL_LANGUAGES = ['sr', 'en'] as const

export type MailLanguage = (typeof MAIL_LANGUAGES)[number]

/** Where the choice is sent. */
export const THE_MAIL_LANGUAGE_GOES_TO = '/api/me/mail-language'

function languageAt(body: unknown, name: 'mailLanguage' | 'language'): MailLanguage | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const said: unknown = Reflect.get(body, name)

  return MAIL_LANGUAGES.find((one) => one === said) ?? null
}

/**
 * The language `GET /api/me` says the account's mail is written in, or nothing when it says
 * something else.
 *
 * <p>Nothing, and not Serbian: a body without the name is a portal one release ahead of its server,
 * and a radio group that opened on „Srpski" over a row that holds „English" would be the portal
 * telling a reader what his mail is written in without having asked.
 */
export function mailLanguageOfMe(body: unknown): MailLanguage | null {
  return languageAt(body, 'mailLanguage')
}

/**
 * The language `PUT /api/me/mail-language` says the row holds NOW, or nothing when it says
 * something else.
 *
 * <p>The group is moved by this and never by what was pressed: `MeMailLanguageApi` answers the value
 * it read back out of the database after writing it, so a screen that folded in the pressed value
 * would agree with the table on every request that worked and claim something on every one that did
 * not (`ProfileVisibility.tsx` makes the identical argument for its own box).
 */
export function mailLanguageChosenIn(body: unknown): MailLanguage | null {
  return languageAt(body, 'language')
}

/**
 * THE ONE REASON `PUT /api/me/mail-language` NAMES, and the sentence this screen has for it.
 *
 * <p>No control on the screen can send it - the two radios send one of the two codes - and it is
 * answered because the route names it and a request that goes round the screen meets the route with
 * nothing in between. `pages/account/refusals.test.ts` reads the Java file and requires a sentence
 * for every reason it declares.
 */
export const WHEN_CHOOSING_THE_LANGUAGE_OF_MAIL: Record<string, string> = {
  theFormIsNotComplete: 'settings.mailLanguageNotChosen',
}
