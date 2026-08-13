import type { FieldDef, FieldType, FormDef } from '../types'
import writtenCena from './admin-cena.form.json'
import writtenClan from './admin-clan.form.json'
import writtenDogadjaj from './admin-dogadjaj.form.json'
import writtenLiga from './admin-liga.form.json'
import writtenModerator from './admin-moderator.form.json'
import writtenStrana from './admin-strana.form.json'
import writtenTim from './admin-tim.form.json'
import writtenTrka from './admin-trka.form.json'
import writtenPredlogTima from './predlog-tima.form.json'
import writtenPrijava from './prijava-sa-trke.form.json'
import writtenRegistracija from './registracija.form.json'
import writtenUnosRezultata from './unos-rezultata.form.json'

/* The one door every form definition comes through.
 *
 * A form is data (PDL P30), and data on disk knows nothing about the types the
 * portal draws with: TypeScript reads `"type": "text"` out of JSON as `string`,
 * not as one of the twelve members of `FieldType`. Every screen used to close
 * that gap for itself with a type assertion, twenty-six times over, which is
 * what ADL A14 bans: an assertion silences the compiler without ever looking at
 * the value.
 *
 * Here the gap is closed once, by looking. A definition naming a field type the
 * portal cannot draw throws where it is read, rather than reaching a renderer
 * that has no branch for it.
 *
 * Converted once per form and kept, rather than on each call: these constants
 * are handed to `FormRenderer` as a prop, and a fresh object on every render is
 * a changed prop on every render (ADL A2 records what that cost the race form).
 */

/** Every field type the portal draws, as something a written one can be checked
 *  against. A record rather than a list, so a type added to `FieldType` and
 *  forgotten here does not compile. */
const FIELD_TYPES: Record<FieldType, true> = {
  text: true,
  email: true,
  password: true,
  date: true,
  number: true,
  select: true,
  country: true,
  place: true,
  choice: true,
  checkbox: true,
  textarea: true,
  photo: true,
}

/** A field as JSON is able to describe one: everything `FieldDef` carries,
 *  except that the type is still only a string. */
type WrittenField = Omit<FieldDef, 'type'> & { type: string }

/** A form as JSON is able to describe one. */
export type WrittenForm = Omit<FormDef, 'fields'> & { fields: WrittenField[] }

function isFieldType(value: string): value is FieldType {
  return Object.hasOwn(FIELD_TYPES, value)
}

/**
 * A written definition read as a form, or an exception naming what is wrong
 * with it.
 *
 * Exported for the sweep over every file in this folder
 * (`forms/definitions.test.ts`), which is what makes the check reach a
 * definition nobody has imported yet.
 */
export function formDef(written: WrittenForm): FormDef {
  return {
    ...written,
    fields: written.fields.map((field) => {
      if (!isFieldType(field.type)) {
        throw new Error(`Form ${written.id}, field ${field.name}: ${field.type} is not a field type`)
      }

      return { ...field, type: field.type }
    }),
  }
}

export const cena = formDef(writtenCena)
export const clan = formDef(writtenClan)
export const dogadjaj = formDef(writtenDogadjaj)
export const liga = formDef(writtenLiga)
export const moderator = formDef(writtenModerator)
export const strana = formDef(writtenStrana)
export const tim = formDef(writtenTim)
export const trka = formDef(writtenTrka)
export const predlogTima = formDef(writtenPredlogTima)
export const prijava = formDef(writtenPrijava)
export const registracija = formDef(writtenRegistracija)
export const unosRezultata = formDef(writtenUnosRezultata)

/** Every definition this folder offers, by the file it is written in. Used by
 *  the sweep that holds the folder and this file to each other: a definition
 *  added as a file and not read here is a form nothing can draw. */
export const FORMS: Record<string, FormDef> = {
  'admin-cena.form.json': cena,
  'admin-clan.form.json': clan,
  'admin-dogadjaj.form.json': dogadjaj,
  'admin-liga.form.json': liga,
  'admin-moderator.form.json': moderator,
  'admin-strana.form.json': strana,
  'admin-tim.form.json': tim,
  'admin-trka.form.json': trka,
  'predlog-tima.form.json': predlogTima,
  'prijava-sa-trke.form.json': prijava,
  'registracija.form.json': registracija,
  'unos-rezultata.form.json': unosRezultata,
}
