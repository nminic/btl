import { Resource } from '../../components/Resource'
import { useI18n } from '../../i18n/useI18n'
import { useScreenForTheUnpaidOnly } from './memberScreen'
import { PersonalData } from './PersonalData'
import { useMyData } from './useMyData'
import './Member.css'

/**
 * „MOJI PODACI": WHERE SOMEBODY WHO REGISTERED AND HAS NOT PAID CHANGES HIS DATA, until the fee is
 * recorded and he is given a number.
 *
 * <p>Owner, 22.10.2026 (PDL, „Član koji još nije platio: bez reči nalog, samo Članarina"): „Neka ima u
 * navigaciji stranu Moji Podaci dok nije odobren koja je iznad Moja Članarina." His data left the
 * settings for everybody on 23.10.2026 (a member whose fee stands changes his on the card „Podaci" of
 * his profile) and he has neither a profile nor a card, so without this page he would have nowhere to
 * change them, which the decision of 10.10.2026 still lets him do („svoje podatke za evidenciju i
 * majicu"). It draws the panel the card draws (`PersonalData.tsx`) and sends to the same route, so the
 * two cannot be told different things; the father's name is the administration's and the address of
 * post is not changed here, for the reasons that panel gives (PDL 22.10.2026, „Ime oca i dalje menja
 * samo administracija").
 *
 * <p><b>Drawn to nobody else.</b> Which of the readers is his is the hook's to say
 * (`memberScreen.tsx`, `useScreenForTheUnpaidOnly`), and what everybody else is drawn instead is
 * decided there as well; the menu draws the entry to him alone (`app/routes.ts`, `accountMenuFor`).
 *
 * <p><b>Read off the answer that has a row for him</b> (`useMyData`, `GET /api/me`), because the
 * public list carries members whose fee stands and he is on no row of it. A read that fails says so in
 * the portal's own words and offers to ask again (`components/Resource.tsx`), and the heading stays.
 */
export function MyData() {
  const { t } = useI18n()
  const who = useScreenForTheUnpaidOnly()

  if (who.account === null) {
    return who.instead
  }

  return (
    <div className="member">
      <h1>{t('nav.myData')}</h1>
      <HisData account={who.account} />
    </div>
  )
}

/** His data, asked for under his own cookie and held against the account it was asked for. */
function HisData({ account }: { account: number }) {
  const mine = useMyData(account)

  return (
    <Resource state={mine} inline>
      {(data) => <PersonalData me={data} />}
    </Resource>
  )
}
