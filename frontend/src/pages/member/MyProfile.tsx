import { useSession } from '../../session/useSession'
import { CompetitorProfile } from '../CompetitorProfile'
import { SignedOut } from './SignedOut'
import './Member.css'

/* The same profile everyone else sees, and nothing under it.
 *
 * A row of five buttons stood here until 23.08.2026: my results, my membership,
 * messages, settings, sign out. Every one of them is in the menu behind the
 * picture in the header, and the owner had the row taken out: „sve je to vec
 * vidljivo iz klika na profilnu sliku gore desno portala". One way in, at the top
 * of every screen, rather than a second one at the foot of a single screen.
 *
 * A signed-in member sees no different front page and no different profile; what
 * differs is what the header offers them (PDL P14, P28a). */
export function MyProfile() {
  const { memberNumber } = useSession()

  if (memberNumber === null) {
    return <SignedOut />
  }

  return (
    <div className="member">
      <CompetitorProfile memberNumber={memberNumber} />

    </div>
  )
}
