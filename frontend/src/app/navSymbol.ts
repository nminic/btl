/**
 * THE SYMBOLS THE HEADER DRAWS IN PLACE OF ITS WORDS ON A TELEPHONE (owner, 16.11.2026, PDL „Pravilnik
 * prelazi u podnožje, a Timovi postaju treća kartica BTL tabela”, answer 6, chosen with my
 * recommendation): „Takmičari dve ljudske figure, BTL tabele lista od tri reda sa rednim brojem, Top
 * liste postolje od tri stepenika, Lige pehar, Kalendar list kalendara, Administracija tri klizača,
 * koverta i sličica ostaju kakve jesu, Prijavi se strelica koja ulazi u vrata, Učlani se figura sa
 * znakom plus”.
 *
 * A closed set, named here and drawn in `app/icons.tsx` (`NavSymbolIcon`), the shape `actionSymbol.ts`
 * has for the buttons that act on one thing. Every entry of the navigation names one of these
 * (`NavSection.symbol` in `app/routes.ts`, which the compiler asks of every entry), and the two links of
 * a visitor name theirs in `app/Shell.tsx`. The envelope and the picture are not here: they are the
 * header's own (`MailIcon`, and the circle `AccountMenu` draws).
 */
export const NAV_SYMBOL = {
  /** Takmičari: two people, a head and shoulders each. */
  people: 'people',
  /** BTL tabele: a list of three rows, each with its place in front of it. */
  ranking: 'ranking',
  /** Top liste: a podium of three steps. */
  steps: 'steps',
  /** Lige: a cup. */
  trophy: 'trophy',
  /** Kalendar: a sheet of a calendar. */
  calendar: 'calendar',
  /** Administracija: three sliders, and not a cog (PDL 29.07.2026, „Zasebnog zupčanika u zaglavlju nema"). */
  sliders: 'sliders',
  /** Prijavi se: an arrow going in through a door. */
  signIn: 'signIn',
  /** Učlani se: a person with a plus beside him. */
  join: 'join',
} as const

export type NavSymbol = (typeof NAV_SYMBOL)[keyof typeof NAV_SYMBOL]
