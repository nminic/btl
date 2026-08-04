import { Link } from 'react-router'
import { Resource } from '../../components/Resource'
import {
  combinePair,
  combineResources,
  useCompetitors,
  useEvents,
  useResults,
} from '../../data/useResource'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { useMayOpen, usePermittedQueues } from './mayOpen'
import { usePending } from './pending'
import { totalWaiting } from './queues'
import '../member/Member.css'

/* The two sections and the price list, which is the whole of administration: the
 * screens inside a section are reached from the navigation beside it
 * (SectionNav), and the price list is in no section because nothing is created
 * or removed on it (entityForms.ts).
 *
 * The price list joined this list on 04.08.2026, when the navigation lost its
 * groups: it had stood in the header beside the two sections, and taking the
 * group away without putting it here would have left it an address nothing
 * leads to. */
const SCREENS = [
  { path: 'administracija/verifikacija', key: 'nav.verification' },
  { path: 'administracija/entiteti', key: 'nav.entities' },
  { path: 'administracija/cenovnik', key: 'admin.pricing' },
]

export function Admin() {
  const { locale, t } = useI18n()
  const { submissions, decisions } = useSession()
  /* The same two questions the navigation and the section ask, asked here too.
     This screen was left behind when the rest of administration learned to show
     a moderator only what he holds (owner, 30.07.2026): it counted all eight
     queues while the header beside it counted his, and it offered the badges to
     somebody with no right to them. */
  const mayOpen = useMayOpen()
  const queues = usePermittedQueues()
  const screens = SCREENS.filter((screen) => mayOpen(screen.path))
  /* The counter used to hold pending results alone, so it said nought while the
   * entry beside it said how much was really waiting. Both numbers now come out
   * of countsFor, which is also what the navigation counts with: two numbers on
   * one screen must not be able to disagree. */
  const state = combinePair(
    combineResources(useCompetitors(), useEvents(), useResults()),
    usePending(),
  )

  const pendingResults = submissions.filter((one) => one.status === 'pending').length

  return (
    <div className="member">
      {/* Unseen, like every other administrative screen (owner, 30.07.2026):
          the name is in the navigation and in the browser tab, and a page with
          no name at all is one a screen reader cannot announce. */}
      <h1 className="visually-hidden">{t('admin.title')}</h1>

      <Resource state={state}>
        {([[competitors, events, results], items]) => {
          const waiting = totalWaiting({ pendingResults, items, decisions }, queues)

          return (
            <>
              <dl className="admin__counts">
                <div>
                  <dt>{t('admin.waiting')}</dt>
                  <dd>{formatNumber(waiting, locale)}</dd>
                </div>
                <div>
                  <dt>{t('admin.members')}</dt>
                  <dd>{formatNumber(competitors.length, locale)}</dd>
                </div>
                <div>
                  <dt>{t('admin.events')}</dt>
                  <dd>{formatNumber(events.length, locale)}</dd>
                </div>
                <div>
                  <dt>{t('admin.results')}</dt>
                  <dd>{formatNumber(results.length, locale)}</dd>
                </div>
              </dl>

              <div className="member__links">
                {screens.map((screen) => (
                  <Link
                    key={screen.path}
                    className="button button--secondary"
                    to={`/${locale}/${screen.path}`}
                  >
                    {t(screen.key)}
                  </Link>
                ))}
              </div>
            </>
          )
        }}
      </Resource>
    </div>
  )
}
