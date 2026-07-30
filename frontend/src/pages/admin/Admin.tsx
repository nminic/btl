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

const SCREENS = [
  { path: 'administracija/verifikacija', key: 'nav.verification' },
  { path: 'administracija/entiteti', key: 'nav.entities' },
  { path: 'administracija/znacke', key: 'admin.badges' },
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
