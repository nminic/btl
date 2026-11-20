/* The sponsors of the front page, for as long as there is no content model behind them.
 *
 * The list is empty, and that is the rule rather than an omission: the old front page was showing a
 * news item from May 2016 in November 2020, which announced "abandoned" far louder than an empty
 * space would have. „Sponzor dana" i traka logotipa se ne prikazuju ako nema aktivnog sponzora (PDL
 * P24, „Tri pravila protiv utiska napuštenog sajta"), so with nothing here neither of them is drawn,
 * and the front page is the layout of variant A without the two (owner, 20.11.2026).
 *
 * The entries arrive with the screen on which the administration enters them, which is a later piece
 * of work than the layout (PDL P24, „raspored naslovne ide pre ekrana za unos sponzora"). Nobody is
 * written here in the meantime: a sponsor made up for the page would be a sponsor the league does not
 * have.
 *
 * The news went on 17.11.2026 (owner, PDL P16: „Ne planiram da imam vesti"), and with them the list of
 * news that stood beside this one.
 */

export type SponsorEntry = {
  id: string
  /** The name, which is the link on the box of the day and the name of the tile in the strip. */
  name: string
  /** Where both of those lead, in a new window. Never written out on the page: „Domen sponzora se ne
   *  ispisuje" (PDL P24, 18.11.2026). */
  url: string
  /** The address of the logo, drawn 64px tall on the box of the day and inside a 120×48 tile on the
   *  strip, never distorted (PDL P24). */
  logo: string
  /** Two lines on the box of the day. That it fits them is held where it is entered: at most 80
   *  characters and never all in capitals (PDL P24, 18.11.2026). */
  description: string
}

export const SPONSORS: SponsorEntry[] = []
