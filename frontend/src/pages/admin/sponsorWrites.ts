import { clearResourceCache } from '../../data/client'
import { LOCALES } from '../../i18n/config'
import { WHEN_SENDING_A_PICTURE } from '../member/photoWrites'

/**
 * WHAT A SPONSOR IS WRITTEN AS (`SponsorWriteApi.Upsert`), for `POST /api/sponsors` and
 * `PUT /api/sponsors/{id}` alike.
 *
 * <p>Every one of the three boxes travels as a boolean, ticked or not: the route reads a missing box as
 * unticked, and a box that is not sent would be a box this screen cannot untick. The English description
 * travels as it was typed; the route stores nothing where nothing but white space was sent, and that is
 * the English front page showing the Serbian one („ako engleska nije upisana, engleska naslovna pokazuje
 * srpsku", PDL 24.11.2026).
 */
export type Upsert = {
  name: string
  url: string
  descriptionSr: string
  descriptionEn: string
  main: boolean
  inRotation: boolean
  inStrip: boolean
}

export function upsertFrom(values: Record<string, string | boolean>): Upsert {
  const text = (name: string): string => String(values[name] ?? '')

  return {
    name: text('name'),
    url: text('url'),
    descriptionSr: text('descriptionSr'),
    descriptionEn: text('descriptionEn'),
    main: values.main === true,
    inRotation: values.inRotation === true,
    inStrip: values.inStrip === true,
  }
}

/** Where one sponsor is changed and deleted. */
export function theSponsor(id: number): string {
  return `/api/sponsors/${String(id)}`
}

/** Where one sponsor's logo is sent and taken down, at once. */
export function theLogoOf(id: number): string {
  return `${theSponsor(id)}/logo`
}

/** Where one sponsor is moved one place earlier or later in the manual order. */
export function theMoveOf(id: number, way: 'up' | 'down'): string {
  return `${theSponsor(id)}/${way}`
}

/**
 * THE SPONSORS HAVE CHANGED, SO EVERY ANSWER OF THEM THIS VISIT HOLDS IS OUT OF DATE: the list of the
 * administration, and the front page in both of its languages.
 *
 * <p>The front page goes too because it reads the same rows (`SponsorApi`): a sponsor entered, ticked into
 * the strip, moved, given a logo or deleted here is a front page that is now wrong, and a reader who goes
 * from this screen to the front page in the same visit would otherwise be drawn the answer from before.
 * Both languages, because the cache keeps one answer per address and the two languages are two addresses
 * (`data/client.ts`, `addressOf`).
 */
export function theSponsorsHaveChanged(): void {
  clearResourceCache('sponsors/all')

  for (const locale of LOCALES) {
    clearResourceCache('sponsors', locale)
  }
}

/**
 * WHAT `SponsorWriteApi` REFUSES, by the names it declares, and the sentence each is answered with.
 *
 * <p>The form refuses an empty name, link or Serbian description, a field over 80 characters and a link
 * that is not `http://` or `https://` before anything is sent (`forms/definitions/admin-sponzor.form.json`);
 * these are answered all the same, because the route decides and the request can still meet a rule the
 * form does not know.
 *
 * <p><b>`theDescriptionIsInCapitals` IS NOT HERE ON PURPOSE.</b> The owner overturned that rule on
 * 24.11.2026, asked which sentence the portal should say for a description in capitals: „Kako napiše neka
 * napiše. Ovo uređuje osoba koja zna šta radi." (PDL, „[OBORENO za velika slova 24.11.2026, vlasnik ...]
 * Portal ne proverava velika slova; ograničenje od 80 znakova ostaje."). So the screen offers no sentence
 * for it and the route has to stop refusing it, which `pages/account/refusals.test.ts` holds until it does.
 */
export const WHEN_WRITING_A_SPONSOR: Record<string, string> = {
  theFormIsNotComplete: 'admin.sponsorSaveRefused.theFormIsNotComplete',
  theNameIsTooLong: 'admin.sponsorSaveRefused.theNameIsTooLong',
  theLinkIsNotALink: 'admin.sponsorSaveRefused.theLinkIsNotALink',
  theDescriptionIsTooLong: 'admin.sponsorSaveRefused.theDescriptionIsTooLong',
}

/**
 * WHAT `SponsorLogoApi` REFUSES, which is what every picture of the portal is refused for and by the
 * same constants (`MePhotoApi`'s three), so it is answered in the same sentences. Not the fourth of
 * those, about the circle: a logo is not cut („Logo se ne seče u krug; čuva se ceo, providnost ostaje"),
 * so no crop is sent and none can be refused.
 */
export const WHEN_SENDING_A_LOGO: Record<string, string> = Object.fromEntries(
  Object.entries(WHEN_SENDING_A_PICTURE).filter(([reason]) => reason !== 'theCropIsNotACircle'),
)
