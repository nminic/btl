import { Resource } from '../../components/Resource'
import { useCompetitors } from '../../data/useResource'
import { useTheme } from '../../app/useTheme'
import type { Theme } from '../../app/themeContext'
import { useI18n } from '../../i18n/useI18n'
import { MEMBERS, recordsOf } from '../admin/entityForms'
import { useOverlay } from '../admin/overlay'
import { ChangePassword } from './ChangePassword'
import { PersonalData } from './PersonalData'
import { ProfileBio } from './ProfileBio'
import { ProfilePicture } from './ProfilePicture'
import { ProfileVisibility } from './ProfileVisibility'
import { useMemberScreen } from './memberScreen'
import './Member.css'

const THEMES: Theme[] = ['dark', 'light']

/* Where the cog in the header leads. The theme switch used to sit in the
 * header; it moved here because the header is for getting around the portal,
 * and a control you press once a year does not belong next to the ones you
 * press every visit (PDL P28a).
 *
 * **THERE IS NO NOTIFICATION PANEL HERE, AND THAT IS A DECISION RATHER THAN AN
 * OVERSIGHT** (PDL, owner, 28.09.2026: „Ekran za podesavanja obavestenja se sklanja u
 * celini"). Until that day this screen ended in a panel of three checkboxes bound to
 * `NOTIFICATION_KEYS` in the session, and all three were a promise the portal cannot
 * keep: „Kad mi rezultat bude odobren" and „Kad mi neko izmeni rezultat" are two of the
 * mails P22 (11.08.2026) makes obligatory - „Sest mejlova iz spiska su obavezni i clan
 * ih ne moze iskljuciti" - and „Povremene vesti iz lige" was a newsletter the same
 * decision abolished. With all three gone the panel held no switch at all, and the owner
 * chose to take the panel rather than leave an empty one: „Ekran koji ne radi nista je
 * obecanje da negde postoji izbor."
 *
 * <p><b>What brings it back, named in the same decision:</b> „ako sutra nastane mejl koji
 * sme da se iskljuci, ekran se pravi ponovo." `settings.test.tsx` is the floor that makes
 * a return deliberate rather than accidental. */
export function Settings() {
  const { t } = useI18n()
  const who = useMemberScreen()
  const overlay = useOverlay()
  const { theme, choose } = useTheme()
  /* Above the early return, because a hook is: called after it, the order of
     hooks changes between a signed in reader and a signed out one. */
  const competitors = useCompetitors()

  if (who.memberNumber === null) {
    return who.instead
  }

  const { memberNumber } = who

  return (
    <div className="member">
      <h1>{t('settings.title')}</h1>
      <p className="member__note">{t('settings.intro')}</p>

      {/* First, because this is the part of the screen other people see. The theme
          and the notifications are the reader's own business; a name, a town and a
          picture are what the league sees beside each other.

          The order inside it is the order of how much a thing is HIS: his own data
          first, which he changes himself and which takes effect at once (PDL P28b,
          1); then the two that go to a moderator before anybody else sees them. The
          sentence here said „the picture is the only thing other people see" until
          24.09.2026, which was true while a name could not be edited from this
          screen and stopped being true in the same commit that let it. */}
      <Resource state={competitors} inline>
        {(competitors) => {
          const me = competitors.find((one) => one.memberNumber === memberNumber)

          if (me === undefined) {
            return null
          }

          /* The picture and the words about oneself, one under the other and
             each going for review on its own (owner, 15.08.2026). */
          return (
            <>
              <PersonalData me={me} />
              <ProfilePicture me={me} />
              {/* KEYED BY THE MEMBER, BECAUSE EVERYTHING THAT PANEL HOLDS BELONGS TO ONE
                  PERSON: what he typed, what stands on his profile, what of his is waiting,
                  and what the server last said. `SessionProvider` sits above the router so
                  it never comes down and the sign in screen is walkable while somebody is
                  signed in, so one visit can hold two people - a shared laptop at a race -
                  and without this the second reads the first man's words out of the box.
                  The identical fault cost `ProfilePicture.tsx` a round of review, and it
                  mends its own with a member carried beside the row because its state lives
                  in the session and survives a remount; this panel's does not, so the
                  cheaper and more complete answer is to say whose panel it is.

                  **The reach of this `key` is this screen and no other**, which is the
                  question the rule of 28.09.2026 asks of every one: `ProfileBio` is drawn
                  here and nowhere else in `src`. */}
              <ProfileBio key={me.memberNumber} me={me} />
            </>
          )
        }}
      </Resource>

      {/* Outside the block above, because it asks nothing of the member record: a
          password belongs to the ACCOUNT, and an account that races and one that only
          moderates have one each. It is drawn after the profile and before the
          preferences for the same reason the personal data is drawn first - this is
          the part of the screen that is about the account itself rather than about
          how it likes to be shown. */}
      <ChangePassword />

      <section className="member__panel" aria-labelledby="settings-appearance">
        <h2 className="profile__section" id="settings-appearance">
          {t('settings.appearance')}
        </h2>

        <fieldset className="field field--radio">
          <legend className="field__label">{t('settings.themeLabel')}</legend>
          {THEMES.map((one) => (
            <div key={one} className="field__confirm">
              <input
                className="field__control"
                type="radio"
                name="theme"
                id={`theme-${one}`}
                value={one}
                checked={theme === one}
                onChange={() => choose(one)}
              />
              <label className="field__label" htmlFor={`theme-${one}`}>
                {t(one === 'dark' ? 'settings.themeDark' : 'settings.themeLight')}
              </label>
            </div>
          ))}
        </fieldset>
      </section>

      {/* **What other people see, and the one thing on this screen that is not only the
          reader's own business.** The published privacy policy has promised this control since
          it was written („U podešavanjima možete sakriti profil od posetilaca koji nisu
          prijavljeni"), and until 06.09.2026 nothing in the code answered for it. The owner
          chose the control rather than striking the sentence.

          Read through the overlay rather than off the file, so the box shows what was chosen
          in this visit and not what the data shipped with. **Since 28.09.2026 what puts a
          choice into that overlay is the server's own answer** - the panel sends
          `PUT /api/me` and writes the overlay only inside the arm the answer authorised
          (`ProfileVisibility.tsx`), so a choice made here survives a reload instead of dying
          with the tab. */}
      <Resource state={competitors} inline>
        {(everybody) => {
          const me = recordsOf(MEMBERS, everybody, overlay).find(
            (one) => one.memberNumber === memberNumber,
          )

          /* Keyed by the member for the reason the biography panel above it is: „Sačuvano."
             and a refusal both belong to whoever pressed, and one visit can hold two
             people. */
          return me === undefined ? null : <ProfileVisibility key={me.memberNumber} me={me} />
        }}
      </Resource>
    </div>
  )
}
