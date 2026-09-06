import { useParams } from 'react-router'
import { PageMeta } from '../app/PageMeta'
import { useFilterParams } from '../app/useFilterParams'
import { GenderTabs } from '../components/GenderTabs'
import { Resource } from '../components/Resource'
import { combinePair, useEvents, useLeagues } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import { LeagueResults } from './league/LeagueResults'
import './Profile.css'

/**
 * One competition: its name, which half of the field is being read, and the
 * standing.
 *
 * **Nothing else, since 07.09.2026.** The owner: „na strani Lige ne postoje
 * propozicije i nagrade (one se vide samo na listi svih liga), pa ni događaji koji
 * ulaze u ligu, a ni dugme rezultati jer se odmah prikazuju rezultati." What the
 * organiser has written is read on the list of competitions, where it is also
 * changed; the events that count are the terms of the competition and are read
 * there too.
 *
 * **So the page has one part and no nav.** It had two, and the second address
 * (`/liga/:slug/rezultati`) named the same page as the first once the parts
 * collapsed into one. Two addresses for one page is the thing this portal refuses
 * everywhere else (P11), so that address is gone rather than kept as an alias.
 *
 * **And one control, level with the name, at the far right**, which is where every
 * screen on the portal keeps the one thing that says which table is being read
 * (owner, 05.08.2026, and again on 07.09.2026 for this screen: „da postoji filter
 * gore desno da se biraju Muškarci ili Žene ... kao što je recimo za Timove").
 * Drawn here rather than inside the standing, because it belongs to the row the
 * heading is on, and that row is this page's.
 *
 * A league is a subset of events, never a different scoring formula and, since
 * 31.08.2026, never its own way of grouping the field either.
 */
export function LeagueDetail() {
  const { t } = useI18n()
  const { slug } = useParams()
  const [params, setParams] = useFilterParams()
  /* Only what the head needs. The grid asks for the races, the results and the members itself, so
     a competition still names itself while the heaviest file on the portal is on its way. */
  const state = combinePair(useLeagues(), useEvents())

  /* The page goes back to its first with the half of the field, the way the main
     standing drops the age category with it (`pages/Rankings.tsx`): read on page
     three of the men, the women may have one page in all, and `pageFrom` would
     land the reader on their last rather than on their first. Written the same way
     as there, so the two controls behave alike. */
  function chooseGender(next: 'M' | 'F') {
    const merged = new URLSearchParams(params)

    merged.set('pol', next === 'M' ? 'm' : 'z')
    merged.delete('strana')
    setParams(merged)
  }

  return (
    <Resource state={state}>
      {([leagues, events]) => {
        const league = leagues.find((one) => one.slug === slug)

        if (league === undefined) {
          return <h1>{t('leagues.notFound')}</h1>
        }

        return (
          <>
            <PageMeta
              title={t('seo.league.recordTitle', { name: league.name })}
              description={t('seo.league.recordDescription', {
                name: league.name,
                season: league.season,
              })}
            />

            <div className="profile">
              <header className="profile__head rankings--tooled">
                {/* The name of a competition already carries its season, so it is the whole title
                    on its own, and nothing stands under it (owner, 31.07.2026). */}
                <h1>{league.name}</h1>

                <div className="rankings__head-tool">
                  {/* Named by the competition itself and not by a word out of the
                      dictionary. „Muškarci / Žene" is the same pair of buttons on
                      four screens; what tells a reader which of them they have
                      landed on is the name of the thing they are choosing inside,
                      and here that is this competition. */}
                  <GenderTabs
                    gender={params.get('pol') === 'z' ? 'F' : 'M'}
                    label={league.name}
                    onChange={chooseGender}
                  />
                </div>
              </header>

              <LeagueResults league={league} events={events} />
            </div>
          </>
        )
      }}
    </Resource>
  )
}
