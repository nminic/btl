import { useEffect, useRef, useState } from 'react'
import type { SponsorEntered } from '../../data/types'
import { AskedLabel } from '../../forms/AskedLabel'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { DeleteSheet } from './DeleteSheet'
import { theLogoOf, theSponsorsHaveChanged, WHEN_SENDING_A_LOGO } from './sponsorWrites'
import '../Leagues.css'
import '../member/Member.css'
import './Sponsors.css'

/** A logo chosen and not yet sent: the file, and what can be drawn of it. */
type Picked = { name: string; picture: string; file: File }

/**
 * The types the field offers to pick: „Logo se otprema kao PNG, WebP ili JPEG, ne SVG." (PDL 24.11.2026).
 * What the picker offers and not what decides: a file of another type chosen past it is sent all the
 * same and refused by the route, which knows a picture by its bytes and never by its name
 * (`SponsorLogoApi`, ADL A12a), and the refusal is said here.
 */
const THE_TYPES_OFFERED = 'image/png,image/webp,image/jpeg'

/**
 * THE LOGO OF A SPONSOR, IN ITS FORM, SENT AND TAKEN DOWN AT ONCE (owner, PDL 24.11.2026: „Potrebno mi je
 * da se Podese wrapperi ili kako vec treba da se ucitava znak sponzora (njegov logo) koji se automatski
 * prikazuje kako treba i u boksu sa desne strane, i u donjoj liniji.").
 *
 * <p><b>The shape of a league's mark</b> (`LeagueMarkModeration.tsx`): a box under the form that writes at
 * once and holds nothing the form holds, a button that sends the chosen file and one that takes the logo
 * down behind a question. <b>Without the circle</b>: „Logo se ne seče u krug; čuva se ceo, providnost
 * ostaje", so no crop is chosen and none is sent.
 *
 * <p><b>Shown as the front page will show it</b>, in the box of the day and in a tile of the strip, on the
 * surface those lie on and with no plate behind it: „Logo stoji providno na tamnoj pozadini, bez svetle
 * pločice." The logo that stands is shown until another is chosen, and the chosen one in its place until
 * it is sent, so what is looked at before the press is what the press will put on the front page.
 *
 * <p><b>A sponsor with no logo is on neither</b> (derived 24.11.2026 and not the owner's sentence;
 * `SponsorApi`), and the box says so while there is none.
 */
export function SponsorLogo({ sponsor }: { sponsor: SponsorEntered }) {
  const { t } = useI18n()
  const [shown, setShown] = useState<string | null>(sponsor.logo)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [sending, setSending] = useState(false)
  /* The press that is out, read in the handler and not off the state, which is true only after the
     render the press causes: two presses in one tick would send the logo twice. */
  const outstanding = useRef(false)
  const [answer, setAnswer] = useState<Exclude<Answer, { got: 'done' }> | null>(null)
  const [said, setSaid] = useState<'saved' | 'removed' | null>(null)
  const sentence = useRef<HTMLParagraphElement>(null)
  const id = String(sponsor.id)

  useEffect(() => {
    if (said !== null) {
      sentence.current?.focus()
    }
  }, [said])

  function choose(file: File | undefined): void {
    setAnswer(null)
    setSaid(null)

    if (file === undefined) {
      setPicked(null)

      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      setPicked({ name: file.name, picture: String(reader.result), file })
    }

    reader.readAsDataURL(file)
  }

  async function save(chosen: Picked): Promise<void> {
    outstanding.current = true
    setSending(true)
    setAnswer(null)
    setSaid(null)

    const body = new FormData()

    body.append('picture', chosen.file)

    const answered = await askTheServer(theLogoOf(sponsor.id), body)

    outstanding.current = false
    setSending(false)

    if (answered.got !== 'done') {
      setAnswer(answered)

      return
    }

    theSponsorsHaveChanged()
    setShown(chosen.picture)
    setPicked(null)
    setSaid('saved')
  }

  async function takeDown(): Promise<void> {
    setAnswer(null)
    setSaid(null)

    const answered = await askTheServer(theLogoOf(sponsor.id), {}, 'DELETE')

    if (answered.got !== 'done') {
      setAnswer(answered)

      return
    }

    theSponsorsHaveChanged()
    setShown(null)
    setSaid('removed')
  }

  const drawn = picked?.picture ?? shown

  return (
    <section className="leagues__counting" aria-labelledby={`sponsor-logo-${id}`}>
      <h2 className="leagues__counting-title" id={`sponsor-logo-${id}`}>
        {t('sponsorLogo.title')}
      </h2>

      {drawn === null ? (
        <p className="member__note">{t('sponsorLogo.none')}</p>
      ) : (
        <>
          <p className="member__note">{t(picked === null ? 'sponsorLogo.standing' : 'sponsorLogo.chosen')}</p>
          {/* The same picture twice, in the two frames it is drawn in: named once, and the second is
              decoration beside it, so a screen reader hears one picture and not two. */}
          <div className="sponsor-logo__previews">
            <div className="sponsor-logo__box">
              <img src={drawn} alt={t('sponsorLogo.alt', { name: sponsor.name })} />
            </div>
            <div className="sponsor-logo__tile">
              <img src={drawn} alt="" />
            </div>
          </div>
        </>
      )}
      <p className="member__note">{t('sponsorLogo.atOnce')}</p>

      <div className="rankings__field rankings__field--wide">
        <AskedLabel id={`sponsor-logo-file-${id}`} asked={false} unmarked>
          {t('sponsorLogo.choose')}
        </AskedLabel>
        <input
          id={`sponsor-logo-file-${id}`}
          /* Cleared by being drawn afresh, as the picker of a picture is (`CropChooser.tsx`): a file field
             cannot be emptied by setting its value. */
          key={picked === null ? 'empty' : picked.name}
          type="file"
          accept={THE_TYPES_OFFERED}
          onChange={(event) => choose(event.target.files?.[0])}
        />
      </div>

      <p className="member__actions">
        <button
          type="button"
          className="button button--primary"
          aria-disabled={picked === null || sending}
          onClick={() => {
            if (picked === null || outstanding.current) {
              return
            }

            void save(picked)
          }}
        >
          {t('sponsorLogo.save')}
        </button>
        {shown !== null && (
          <DeleteSheet
            name={t('sponsorLogo.title')}
            opener={t('sponsorLogo.remove')}
            asks={t('sponsorLogo.removeAsks')}
            look="button button--secondary"
            onDelete={takeDown}
          />
        )}
      </p>

      {said !== null && (
        <p className="member__note" ref={sentence} tabIndex={-1} role="status">
          {t(said === 'saved' ? 'sponsorLogo.saved' : 'sponsorLogo.removed')}
        </p>
      )}
      {answer !== null && <ServerSaid answer={answer} refusals={WHEN_SENDING_A_LOGO} />}
    </section>
  )
}
