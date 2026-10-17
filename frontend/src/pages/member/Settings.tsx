import { Link } from 'react-router'
import { MEMBERSHIP_ADDRESS } from '../../app/routes'
import { Resource } from '../../components/Resource'
import { useCompetitors } from '../../data/useResource'
import { useTheme } from '../../app/useTheme'
import type { Theme } from '../../app/themeContext'
import { Sentence } from '../../i18n/Sentence'
import { useI18n } from '../../i18n/useI18n'
import { MEMBERS, recordsOf } from '../admin/entityForms'
import { useOverlay } from '../admin/overlay'
import { ChangePassword } from './ChangePassword'
import { MailLanguageChoice } from './MailLanguageChoice'
import { PersonalData } from './PersonalData'
import { ProfileBio } from './ProfileBio'
import { ProfilePicture } from './ProfilePicture'
import { ProfileVisibility } from './ProfileVisibility'
import { useScreenForEveryAccount } from './memberScreen'
import { useMyData } from './useMyData'
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
 * a return deliberate rather than accidental.
 *
 * <p><b>THE SCREEN HAS FOUR SHAPES SINCE 17.10.2026, AND WHICH ONE IS DRAWN IS DECIDED BY THE
 * HOOK AND BY NOTHING ON THIS PAGE</b> (`memberScreen.tsx`, `useScreenForEveryAccount`). Three of
 * them are the ones of 11.10.2026, and the fourth is below them. PDL P8,
 * the entry „Šta sme neplaćen član" (10.10.2026) and its addition of 11.10.2026, both chosen by
 * the owner between offered outcomes - the sentences are the record's and not his own words:
 *
 * <ul>
 * <li><b>A member whose fee stands</b> is drawn everything, exactly as he was, and now the language
 * of his mail.</li>
 * <li><b>Somebody who registered and has not paid</b> is drawn his data and his password and the
 * theme: „Sme: [...] lozinku, adresu pošte i svoje podatke za evidenciju i majicu. Ne sme ništa
 * što ga čini vidljivim ili ga uključuje u ligu: sliku, biografiju, skrivanje profila". The three
 * panels that are left out are the three that entry names, and a sentence says they open when his
 * fee is recorded.</li>
 * <li><b>A member whose fee has lapsed</b> is drawn the theme and one sentence: his data and his
 * password are answered 404 (the addition of 11.10.2026: „izmena podataka (PUT /api/me) i lozinke
 * (PUT /api/me/password) mu daje 404"), and so are the picture, the biography and the switch,
 * which this screen did not draw him before either - he is on no row of the public list they are
 * drawn from. That is now said by the shape rather than by that accident. The sentence, since
 * 16.10.2026, says his data and his password open once his fee is renewed, with a link to the page
 * he renews it on ({@link WhatOpensWhenTheFeeIsRenewed}).</li>
 * <li><b>An account with no competitor record</b> - a moderator, a superadmin - is drawn the
 * language of its mail and nothing else, since 17.10.2026. It was told „Ovaj deo je za takmičare"
 * before, as on every screen of the member area (PDL P21: administration is nobody's member), and
 * that stays true of every other screen; this one has a setting that is the ACCOUNT's and not a
 * competitor's (PDL, the answers of 17.10.2026: „Jezik pošte sme da promeni svako ko ima nalog [...]
 * jer je to podešavanje naloga a ne takmičarsko pravo", chosen by the owner between offered
 * outcomes; the sentence is the record's and not his own words). **Its password and its theme are
 * NOT drawn to it, and that is a boundary rather than a decision**: nothing the owner has said
 * covers them for administration, the password route's answer for such an account has not been
 * measured here, and the language was asked for by name.</li>
 * </ul>
 *
 * <p>The language of the mail (`MailLanguageChoice`) is the one panel drawn in every shape.
 *
 * <p><b>The server is the authority in all four and this is only what is worth offering.</b> A
 * control drawn to a reader whose every press is refused does nothing for him, and the owner's
 * word for that is that it is worse than none (PDL P11, 15.08.2026, „Kontrola koja ništa ne radi
 * je gora nego da je nema"; that a refused press counts as doing nothing is this record's reading
 * and not the entry's), so what is refused is not drawn; a reader who ends up pressing something
 * the door answers 404 is told what every screen of this portal tells him then. */
export function Settings() {
  const { t } = useI18n()
  const who = useScreenForEveryAccount()
  const overlay = useOverlay()
  const { theme, choose } = useTheme()
  /* Above the early return, because a hook is: called after it, the order of
     hooks changes between a signed in reader and a signed out one. */
  const competitors = useCompetitors()

  if (who.standing === null) {
    return who.instead
  }

  const { memberNumber } = who
  /* WHOSE LANGUAGE OF MAIL THIS IS, for the panel that holds it (`MailLanguageChoice`): the member number
     where there is one and the account where there is not, which is every reader this screen draws. */
  const reader = who.memberNumber === null ? String(who.account) : who.memberNumber

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
          screen and stopped being true in the same commit that let it.

          **ONLY FOR A MEMBER WHOSE FEE STANDS**, since 11.10.2026: the public list these
          three are drawn from carries nobody else, and the server answers nobody else the
          writes behind the picture and the biography. Somebody who has not paid is drawn his
          data below instead, from the one answer that has a row for him. */}
      {who.standing === 'standing' && (
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
      )}

      {who.standing === 'neverPaid' && <TheDataOfSomebodyWhoHasNotPaid account={who.account} />}

      {/* **THE ONE SENTENCE A MEMBER WHOSE FEE HAS LAPSED IS TOLD**, since 16.10.2026 (PDL P8, the
          entry „Šta sme neplaćen član", the decision of that day, chosen by the owner between
          offered outcomes; the sentence is the record's and not his own words): „Članu kome je
          istekla članarina strana Podešavanja dobija jednu rečenicu da se podaci i lozinka otvaraju
          kad članarina bude obnovljena, uz vezu na stranu za obnovu." Rejected in the same entry:
          a page with only the choice of theme and no sentence. The words are the assistant's and the
          owner changes them on QA (PDL, same entry). Drawn by the flag the session carries
          (`standing === 'lapsed'`) and by nothing else, so a member whose fee stands and somebody who
          never paid are not told it: the second has a sentence of his own below, and the first has
          nothing to be told. */}
      {who.standing === 'lapsed' && <WhatOpensWhenTheFeeIsRenewed />}

      {/* Outside the block above, because it asks nothing of the member record: a
          password belongs to the ACCOUNT, and an account that races and one that only
          moderates have one each. It is drawn after the profile and before the
          preferences for the same reason the personal data is drawn first - this is
          the part of the screen that is about the account itself rather than about
          how it likes to be shown.

          **NOT DRAWN TO A MEMBER WHOSE FEE HAS LAPSED**, since 11.10.2026: `PUT
          /api/me/password` answers him 404. It is drawn to somebody who has not paid, whom
          the same entry lets change it. **And named for the two who see it rather than excluded
          for the two who do not**, since 17.10.2026: an administration account with no member is
          drawn this screen for the language of its mail only, so a condition written as „anybody
          but a lapsed member" would have drawn it a password it was never offered. */}
      {(who.standing === 'standing' || who.standing === 'neverPaid') && <ChangePassword />}

      {who.standing !== 'account' && (
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
      )}

      {/* **THE ONE PANEL DRAWN TO EVERY KIND OF SIGNED IN ACCOUNT**, since 17.10.2026: the language
          the portal's mail to this account is written in. PDL, the answers of 17.10.2026 (chosen by
          the owner between offered outcomes; the sentence is the record's and not his own words):
          „Jezik pošte sme da promeni svako ko ima nalog, i član bez plaćene članarine i član kome
          je istekla, jer je to podešavanje naloga a ne takmičarsko pravo." So it stands outside
          every `who.standing` condition on this screen, and it is the only panel an administration
          account with no member is drawn (`useScreenForEveryAccount`). It stands after the theme,
          which is the other thing the reader keeps for himself, and before the one panel that is
          about other people. */}
      <MailLanguageChoice reader={reader} />

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
          with the tab.

          **ONLY FOR A MEMBER WHOSE FEE STANDS**, for the reason given above the first panel:
          hiding a profile is one of the three things somebody who has not paid may not do. */}
      {who.standing === 'standing' && (
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
      )}
    </div>
  )
}

/**
 * THE SENTENCE FOR A MEMBER WHOSE FEE HAS LAPSED, with the way to the page he renews it on.
 *
 * <p>The way is the page he pays on (`MEMBERSHIP_ADDRESS`, the same address `NotAMemberYet` sends
 * somebody who has not paid to), and it stands INSIDE the sentence as a link, so a screen reader
 * hears where it goes without a label repeating what the sentence says (`i18n/Sentence.tsx`, the
 * same arrangement the club on a profile uses). It is named by what the menu calls it
 * (`nav.membership`), so the link and the entry in the menu cannot be two names for one page.
 */
function WhatOpensWhenTheFeeIsRenewed() {
  const { locale, t } = useI18n()

  return (
    <p className="member__note">
      <Sentence text={t('settings.opensWhenTheFeeIsRenewed')} slot="renewal">
        <Link to={`/${locale}/${MEMBERSHIP_ADDRESS}`}>{t('nav.membership')}</Link>
      </Sentence>
    </p>
  )
}

/**
 * HIS DATA, FOR SOMEBODY WHO REGISTERED AND HAS NOT PAID, and the one sentence about what is not
 * here.
 *
 * <p>A component of its own and not a branch of {@link Settings}, because it is the only place
 * that reads `GET /api/me` for him (`useMyData`) and a hook cannot be called under a condition:
 * drawn inside the screen it would ask the server on every visit of every member whose fee
 * stands, for an answer nobody reads.
 *
 * <p>The sentence says what he cannot find here and when it opens: the picture, the biography
 * and the switch that hides a profile are the three things the entry of 10.10.2026 names (PDL P8)
 * among the ones that make a member visible or put him in the league, and he gets them with his
 * number.
 */
function TheDataOfSomebodyWhoHasNotPaid({ account }: { account: number }) {
  const { t } = useI18n()
  const mine = useMyData(account)

  return (
    <>
      <Resource state={mine} inline>
        {(data) => <PersonalData me={data} />}
      </Resource>
      <p className="member__note">{t('settings.opensWithTheFee')}</p>
    </>
  )
}
