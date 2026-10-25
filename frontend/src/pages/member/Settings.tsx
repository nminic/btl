import { Link } from 'react-router'
import { MEMBERSHIP_ADDRESS } from '../../app/routes'
import { Resource } from '../../components/Resource'
import type { Competitor } from '../../data/types'
import { useCompetitors, type ResourceState } from '../../data/useResource'
import { useTheme } from '../../app/useTheme'
import type { Theme } from '../../app/themeContext'
import { Sentence } from '../../i18n/Sentence'
import { useI18n } from '../../i18n/useI18n'
import { MEMBERS, recordsOf } from '../admin/entityForms'
import { useOverlay } from '../admin/overlay'
import { ChangePassword } from './ChangePassword'
import { MailLanguageChoice } from './MailLanguageChoice'
import { ProfileBio } from './ProfileBio'
import { ProfilePicture } from './ProfilePicture'
import { ProfileVisibility } from './ProfileVisibility'
import { useScreenForEveryAccount } from './memberScreen'
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
 * <p><b>THE SCREEN HAS THREE SHAPES SINCE 23.10.2026, AND WHICH ONE IS DRAWN IS DECIDED BY THE
 * HOOK AND BY NOTHING ON THIS PAGE</b> (`memberScreen.tsx`, `useScreenForEveryAccount`). The fourth
 * of 17.10.2026, somebody who registered and has not paid, is gone: the address sends him to the
 * page he pays on and he is not drawn the password or the theme (PDL 22.10.2026, „Član koji još
 * nije platio: bez reči nalog, samo Članarina": „Sve opcije koje mu nisu dostupne privremeno (dakle
 * sve osim Članarine) ne treba da mu uopšte budu dostupne"). The three that are left are below, and
 * the first two are the ones of 11.10.2026. PDL P8,
 * the entry „Šta sme neplaćen član" (10.10.2026) and its addition of 11.10.2026, both chosen by
 * the owner between offered outcomes - the sentences are the record's and not his own words:
 *
 * <ul>
 * <li><b>A member whose fee stands</b> is drawn everything, exactly as he was, and now the language
 * of his mail.</li>
 * <li><b>A member whose fee has lapsed</b> is drawn the theme and one sentence: his data and his
 * password are answered 404 (the addition of 11.10.2026: „izmena podataka (PUT /api/me) i lozinke
 * (PUT /api/me/password) mu daje 404"), and so are the picture, the biography and the switch,
 * which this screen did not draw him before either - he is on no row of the public list they are
 * drawn from. That is now said by the shape rather than by that accident. The sentence, since
 * 16.10.2026, says his data and his password open once his fee is renewed, with a link to the page
 * he renews it on ({@link WhatOpensWhenTheFeeIsRenewed}).</li>
 * <li><b>An account with no competitor record</b> - a moderator, a superadmin - is drawn the
 * language of its mail since 17.10.2026 (PDL, the answers of 17.10.2026: „Jezik pošte sme da promeni
 * svako ko ima nalog [...] jer je to podešavanje naloga a ne takmičarsko pravo", chosen by the owner
 * between offered outcomes; the sentence is the record's and not his own words), and **the theme and
 * the password with it, since the evening of the same day** (PDL, the answers of 17.10.2026 in the
 * evening, chosen by the owner between offered outcomes; the sentence is the
 * record's and not his own words: „Nalog administracije bez člana na strani Podešavanja vidi sve troje: jezik pošte, izbor
 * teme i promenu lozinke"; rejected there: the language and the password without the theme, and the
 * language alone). It was told „Ovaj deo je za takmičare" before, as on every screen of the member area
 * (PDL P21: administration is nobody's member), and that stays true of every other screen. The
 * password route takes such an account (`MePasswordApiTest`, the case for both roles), and it is
 * the member whose fee has LAPSED that the route answers 404, which is the third shape and not this
 * one.</li>
 * </ul>
 *
 * <p>The language of the mail (`MailLanguageChoice`) is the one panel drawn in every shape, and the
 * theme is drawn in every shape too.
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

      {/* **THREE TALL ROWS OF TWO COLUMNS, since 23.10.2026** (PDL, „Strana Podešavanja u tri visoka
          reda sa dve kolone", owner: „lični podaci (prilog) ispadaju sa strane, lozinka prelazi levo na
          njeno mesto, a Privatnost tekst iz priloga ide u desni stubac pored boksa za lozinku. Slično
          tome, Profilna slika sa svim opcijama treba da bude u nivou levog stupca, a u desni stubac treba
          da dođe u njenoj visini Tekst o sebi boks."). The third row is the two that were already beside
          each other, the theme and the language of the mail. On a telephone every row is one column, as
          the UI standard of this repository asks (`CLAUDE.md`), from the same `.member__pair`; the two
          boxes of a row are as tall as each other (`.member__row`, `Member.css`).

          **THE PERSONAL DATA ARE NOT ON THIS SCREEN FOR ANYBODY.** A member whose fee stands changes them
          on the card „Podaci" of his own profile (PDL 22.10.2026, „Profil dobija karticu „Podaci""), and
          somebody who has not paid yet on the page „Moji podaci" (PDL 22.10.2026, „Neka ima u navigaciji
          stranu Moji Podaci dok nije odobren"), which draws the same panel (`PersonalData.tsx`).

          **THE FIRST ROW: THE PASSWORD, AND BESIDE IT WHO SEES THE PROFILE.** The password is drawn to a
          member whose fee stands and to an administration account with no member (PDL, the answers of
          17.10.2026 in the evening: „Nalog administracije bez člana na strani Podešavanja vidi sve
          troje"), named for the two who see it rather than excluded for the one who does not, so a
          fifth way of being signed in is not handed a password by a condition written as „anybody but a
          lapsed member" (`PUT /api/me/password` answers a lapsed member 404). Somebody who has not paid
          is not among them since 23.10.2026: he is not on this screen at all (`memberScreen.tsx`). The
          switch that hides the profile is a member's whose fee stands and nobody else's: hiding a
          profile is one of the three things somebody who has not paid may not do (PDL P8, 10.10.2026).
          Where it is not drawn the password takes the whole row (`.member__pair > :only-child`). */}
      {(who.standing === 'standing' || who.standing === 'account') && (
        <div className="member__pair member__row">
          <ChangePassword />
          {who.standing === 'standing' && <HisPrivacy competitors={competitors} memberNumber={memberNumber} />}
        </div>
      )}

      {/* **THE ONE SENTENCE A MEMBER WHOSE FEE HAS LAPSED IS TOLD**, since 16.10.2026 (PDL P8, the
          entry „Šta sme neplaćen član", the decision of that day, chosen by the owner between
          offered outcomes; the sentence is the record's and not his own words): „Članu kome je
          istekla članarina strana Podešavanja dobija jednu rečenicu da se podaci i lozinka otvaraju
          kad članarina bude obnovljena, uz vezu na stranu za obnovu." The data are on the card of his
          profile now and not here, and they open with the fee all the same (`PUT /api/me` answers him
          404), so the sentence stays true as it is written. Drawn by the flag the session carries
          (`standing === 'lapsed'`) and by nothing else. */}
      {who.standing === 'lapsed' && <WhatOpensWhenTheFeeIsRenewed />}

      {/* **THE SECOND ROW: THE PICTURE, AND BESIDE IT THE WORDS ABOUT ONESELF**, each going for review
          on its own (owner, 15.08.2026). Only for a member whose fee stands: the public list these two
          are drawn from carries nobody else, and the server answers nobody else the writes behind them
          (PDL P8, 10.10.2026). */}
      {who.standing === 'standing' && (
        <Resource state={competitors} inline>
          {(everybody) => {
            const me = everybody.find((one) => one.memberNumber === memberNumber)

            if (me === undefined) {
              return null
            }

            return (
              <div className="member__pair member__row">
                <ProfilePicture me={me} />
                {/* KEYED BY THE MEMBER, BECAUSE EVERYTHING THAT PANEL HOLDS BELONGS TO ONE PERSON:
                    what he typed, what stands on his profile, what of his is waiting, and what the
                    server last said. One visit can hold two people - a shared laptop at a race - and
                    without this the second reads the first man's words out of the box. **The reach of
                    this `key` is this screen and no other**: `ProfileBio` is drawn here and nowhere
                    else in `src`. */}
                <ProfileBio key={me.memberNumber} me={me} />
              </div>
            )
          }}
        </Resource>
      )}

      {/* **THE THIRD ROW: THE THEME AND THE LANGUAGE OF THE MAIL**, beside each other since 18.10.2026
          (PDL P11, owner, „Strana Podešavanja, sa snimaka": „Boksovi „Tema" i „Jezik pošte" stoje jedan
          pored drugog u istom redu"). Drawn in every shape: the language of the mail is an account's
          setting and not a competitor's right (PDL, the answers of 17.10.2026). */}
      <div className="member__pair member__row">
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

        <MailLanguageChoice reader={reader} />
      </div>
    </div>
  )
}

/**
 * **WHO SEES THE PROFILE, the panel beside the password.** The published privacy policy has promised
 * this control since it was written („U podešavanjima možete sakriti profil"), and the owner chose the
 * control rather than striking the sentence (06.09.2026).
 *
 * <p>Read through the overlay rather than off the file, so the box shows what was chosen in this visit
 * and not what the data shipped with; since 28.09.2026 what puts a choice into that overlay is the
 * server's own answer (`ProfileVisibility.tsx`), so a choice made here survives a reload. Keyed by the
 * member, because „Sačuvano." and a refusal both belong to whoever pressed, and one visit can hold two
 * people.
 */
function HisPrivacy({
  competitors,
  memberNumber,
}: {
  competitors: ResourceState<Competitor[]>
  memberNumber: string | null
}) {
  const overlay = useOverlay()

  return (
    <Resource state={competitors} inline>
      {(everybody) => {
        const me = recordsOf(MEMBERS, everybody, overlay).find((one) => one.memberNumber === memberNumber)

        return me === undefined ? null : <ProfileVisibility key={me.memberNumber} me={me} />
      }}
    </Resource>
  )
}

/**
 * THE SENTENCE FOR A MEMBER WHOSE FEE HAS LAPSED, with the way to the page he renews it on.
 *
 * <p>The way is the page he pays on (`MEMBERSHIP_ADDRESS`, the same address `SentToTheFee` sends
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
