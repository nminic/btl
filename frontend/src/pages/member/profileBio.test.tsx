import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fireEvent, screen, within } from '@testing-library/react'
import type { Competitor } from '../../data/types'
import { clearResourceCache } from '../../data/client'
import { must } from '../../test/at'
import { measurePicture } from '../../test/picture'
import { renderAt } from '../../test/render'
import { serverThat } from '../../test/serverAnswers'
import { aCompetitor } from '../../test/theAnswer'
import sr from '../../i18n/sr.json'
import { translate } from '../../i18n/translate'
import { inside, SEP, sources, WHOLE_PORTAL } from '../../test/sources'
import { setupUser } from '../../test/user'

/* Changing what a member wrote about themselves, after joining.
 *
 * Owner, 15.08.2026, asked what should happen to somebody whose biography was
 * refused: „Panel u Podešavanjima, kao za sliku." Until then a refusal reached
 * the member with a reason they had nowhere to act on, and the screen said so.
 *
 * These follow the shape of the picture panel's tests, and for the same reason
 * they were written that way: what has to be proved is the errand, not the
 * markup. Nothing here navigates in order to prove that the queue is read
 * afresh, because in this suite `router.navigate` does not unmount the screen,
 * so a component holding its own state passes such a test (profilePicture.test).
 */

const members: Competitor[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/competitors.json'), 'utf-8'),
)

/** Somebody who has written one, and somebody who has not, taken out of the
 *  file rather than named here: if the seed changes, this says so instead of
 *  passing.
 *
 *  Whether the fee is standing is not asked any more, because there is nothing
 *  left to ask it of: `/api/competitors` answers only for members whose fee is
 *  (owner, 13.09.2026), so being in the list IS the condition this used to spell
 *  out as `one.active`. */
const withOne = must(
  members.find((one) => (one.bio ?? '').trim() !== ''),
  'a member whose profile carries a biography',
)
const withNone = must(
  members.find((one) => (one.bio ?? '').trim() === ''),
  'a member whose profile carries none',
)

const panelFor = async () => within(await screen.findByRole('region', { name: 'Tekst o sebi' }))

const box = async () => (await panelFor()).getByLabelText(/Svojim rečima|Tekst o sebi/)

describe('the words a member wrote about themselves, changed later', () => {
  it('opens on what stands on the profile, and refuses to send it back unchanged', async () => {
    /* A box that opened empty would read as „write one" to somebody who has
       written one, and what they are usually here to do is mend a sentence. The
       button is told off rather than switched off, so it stays reachable and
       says why it will not act. */
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber)

    const panel = await panelFor()

    expect(await box()).toHaveValue(withOne.bio)
    expect(panel.getByText(sr.bio.standing)).toBeVisible()

    const send = panel.getByRole('button', { name: 'Pošalji na odobrenje' })

    expect(send).toHaveAttribute('aria-disabled', 'true')
    expect(send).not.toBeDisabled()
    expect(send).toHaveAccessibleDescription('Izmeni tekst da bi imao šta da pošalješ.')

    /* Pressed anyway, because reachable means pressable: the refusal lives in
       the handler as well as in the attribute. */
    await user.click(send)

    expect((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' })).toBeVisible()
  })

  it('says the limit on the way into the box, not by stopping the typing', async () => {
    /* The box cuts at 360 characters, and until 16.08.2026 that number lived
       only in a counter drawn `aria-hidden`, with nothing pointing at it. A
       member who cannot see the screen met the limit as a wall: the keys simply
       stopped working. `LongBox` says in its own comment that pointing at the
       count is the caller's business (forms/LongBox.tsx), and the comment box on
       an event does it (pages/event/RateEvent.tsx); this panel did not.
     *
       The rule beside the box said the number in words and it went out on
       31.08.2026 with the last three of its kind, so what carries it now is the
       count alone. **And the count says what is left, not what the whole is**,
       which is the same thing only for an empty box: somebody with a biography
       already written hears „Još 123 znaka" and hears 360 nowhere on this screen.
       That is still an instruction on the way in rather than a wall met in silence
       (WCAG 2.2 SC 3.3.2, and the wall itself is named by `registration.bioFull`),
       but it is less than the rule said, so it is measured both ways rather than
       described from the empty one. A first draft of this comment claimed the
       number was still said, and only the empty box was drawn (review, 31.08.2026).

       One id, and it is the whole of what the description may say: a second one
       here would point at an element that no longer exists, which is read as
       nothing at all and which no assertion about text can see. */
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const field = await box()

    expect(field).toHaveAttribute('aria-describedby', 'settings-bio-left')
    expect(field).toHaveAccessibleDescription(/Još 360 znak/)

    /* Every id in the list points at something. Asked of the document rather than
       of the attribute, because an attribute naming a ghost reads the same. */
    for (const id of must(field.getAttribute('aria-describedby'), 'what describes the box').split(' ')) {
      expect(document.getElementById(id), id).not.toBeNull()
    }
  })

  it('says what is left of the limit to somebody who has already written', async () => {
    /* The other half of the sentence above, and the half that changed: what this
       member used to hear was the rule, which carried 360 whatever they had
       written. Now the description carries the remainder **and no longer carries the
       rule**, and that is what this freezes so the difference is a decision rather
       than a thing nobody wrote down.

       Two things, not one. „The remainder and nothing else" is what an earlier
       version of this line promised, and it is not what the two assertions below say:
       they say the remainder is there and that 360 is not. Whether anything else
       stands beside them is unmeasured, and saying so is cheaper than a sentence that
       has to be believed (review, 31.08.2026). */
    renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber)

    const field = await box()

    expect(field).toHaveAccessibleDescription(/Još \d+ znak/)
    expect(field).not.toHaveAccessibleDescription(/360/)
  })

  it('asks somebody with nothing on their profile to write rather than to change', async () => {
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const panel = await panelFor()

    expect(await box()).toHaveValue('')
    expect(panel.getByRole('button', { name: 'Pošalji na odobrenje' })).toHaveAccessibleDescription(
      'Napiši nešto da bi mogao da pošalješ.',
    )
    /* And the sentence above the box says there is nothing yet, rather than
       „this is what stands on your profile" over an empty box. Both sentences
       ran and neither was read, so a review swapped one for the other and the
       whole suite stayed green. */
    expect(panel.getByText(sr.bio.none)).toBeVisible()
    expect(panel.queryByText(sr.bio.standing)).not.toBeInTheDocument()
  })

  /**
   * AND A `null` BIOGRAPHY OPENS THE SAME WAY, WHICH IS A ROW THE SERVER NEVER ACTUALLY
   * HANDS A MEMBER ABOUT HIMSELF.
   *
   * **Why this case builds a row the server would never really answer.** `CompetitorApi`'s
   * condition on `bio` asks only whether the CALLER is signed in, never whether the row is
   * his own, so a member's own row never comes back null: he must be signed in to have a
   * "my own row" at all. Built here anyway, because `ProfileBio`'s `me.bio ?? ''` is a guard
   * against that condition and `profile/visible.ts`'s ever drifting apart, and a guard
   * nothing exercises is a branch nothing checks (rule of 14.09.2026).
   */
  it('reads a null biography the same as an empty one, in case the two guards ever disagree', async () => {
    clearResourceCache()

    const { stop } = serverThat((path) =>
      path === '/api/competitors'
        ? new Response(
            JSON.stringify([{ ...aCompetitor, memberNumber: withNone.memberNumber, bio: null }]),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        : null,
    )

    try {
      renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

      const panel = await panelFor()

      expect(await box()).toHaveValue('')
      expect(panel.getByText(sr.bio.none)).toBeVisible()
      expect(panel.queryByText(sr.bio.standing)).not.toBeInTheDocument()
    } finally {
      stop()
      clearResourceCache()
    }
  })

  it('reaches the moderator as a text, under the member it belongs to', async () => {
    /* The queue holds two sorts and decides them differently: a text is refused
       with a plain reason, a picture with an instruction to work from
       (pages/admin/queues.ts). Sent as the wrong sort, or under the wrong
       number, the reason reaches the wrong inbox. Both are read off the card. */
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'superadmin', withOne.memberNumber)

    await panelFor()
    await user.clear(await box())
    await user.type(await box(), 'Trčim od 2015, najviše po Fruškoj gori.')
    await user.click((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' }))

    await router.navigate('/sr/administracija/verifikacija/trkacki-profil')

    const heading = await screen.findByRole('heading', {
      name: `${withOne.firstName} ${withOne.lastName}`,
    })
    const card = within(must(heading.closest('li'), 'the card the heading stands in'))

    expect(card.getByText(/Fruškoj gori/)).toBeVisible()
    /* The number is drawn beside the name on the card, so a moderator can tell
       two members of one name apart; read loosely, because the card writes it
       inside a sentence rather than on its own. */
    expect(card.getByText(new RegExp(withOne.memberNumber))).toBeVisible()
    /* The decision offered is the one for a text and not the one for a picture,
       and the two are not told apart by the buttons: both are refused with a
       reason and both carry „Odbij" and „Odobri". What differs is what the
       moderator is asked to write, which `outcomeFor` decides (queues.ts): a
       picture is handed back with an instruction precise enough to work from, a
       text with a plain reason. So the words in the box are read, not the
       buttons. A review renamed the sort on both sides at once and this test
       stayed green while it read them. */
    expect(card.getByRole('button', { name: 'Odbij' })).toBeVisible()
    expect(card.getByRole('button', { name: 'Odobri' })).toBeVisible()

    await user.click(card.getByRole('button', { name: 'Odbij' }))

    expect(screen.getByLabelText('Razlog odbijanja')).toHaveAttribute(
      'placeholder',
      sr.review.reasonPlaceholder,
    )
  })

  it('offers nothing more while one is waiting, and says what was sent', async () => {
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber)

    await panelFor()
    await user.clear(await box())
    await user.type(await box(), 'Nešto sasvim drugo o sebi.')
    await user.click((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' }))

    const panel = await panelFor()
    const told = panel.getByText(/čeka odobrenje/)

    expect(told).toBeVisible()
    /* The reader is taken to what replaced the control they pressed, rather than
       dropped on the body with nothing announced (WCAG 2.2 SC 4.1.3, 2.4.3). */
    expect(told).toHaveFocus()
    expect(panel.queryByRole('button', { name: 'Pošalji na odobrenje' })).not.toBeInTheDocument()
    /* And what was sent is on screen, so somebody who cannot remember what they
       wrote does not have to guess while it is out of their hands. */
    expect(panel.getByText('Nešto sasvim drugo o sebi.')).toBeVisible()
  })

  it('hands the box straight back once the text is approved in the same visit', async () => {
    /* The panel reads decisions as well as proposals, so somebody whose text is
       approved while they are still on the portal is not left told to wait. That
       was written down in a comment and nothing measured it: a review made the
       filter ignore decisions altogether and all 1935 tests stayed green.
     *
       Walked rather than stated: the member sends, the moderator approves on the
       queue, the member comes back and the box is theirs again. Both roles in
       one session, which is what the development switch is for. */
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'superadmin', withOne.memberNumber)

    await panelFor()
    await user.clear(await box())
    await user.type(await box(), 'Trčim jer volim šumu.')
    await user.click((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' }))

    expect((await panelFor()).getByText(/čeka odobrenje/)).toBeVisible()

    await router.navigate('/sr/administracija/verifikacija/trkacki-profil')

    const heading = await screen.findByRole('heading', {
      name: `${withOne.firstName} ${withOne.lastName}`,
    })
    const card = within(must(heading.closest('li'), 'the card the heading stands in'))

    await user.click(card.getByRole('button', { name: 'Odobri' }))
    await router.navigate('/sr/podesavanja')

    const panel = await panelFor()

    expect(panel.queryByText(/čeka odobrenje/)).not.toBeInTheDocument()
    expect(panel.getByRole('button', { name: 'Pošalji na odobrenje' })).toBeVisible()
  })

  it('is not held up by a picture the same member is waiting on', async () => {
    /* Two sorts on one queue, and one waiting does not silence the other: they
       are separate errands about one profile (owner, 15.08.2026). */
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber)

    const picture = within(await screen.findByRole('region', { name: 'Profilna slika' }))

    await user.upload(
      await picture.findByLabelText(/Izaberi novu sliku/),
      new File(['slika'], 'nova.jpg', { type: 'image/jpeg' }),
    )
    await measurePicture()
    await picture.findByLabelText('Veličina isečka')
    await user.click(picture.getByRole('button', { name: 'Pošalji na odobrenje' }))

    expect((await panelFor()).getByRole('button', { name: 'Pošalji na odobrenje' })).toBeVisible()
  })

  it('downloads nothing about anybody else to say what is waiting', async () => {
    /* The same limit the picture panel carries, and for the same reason: the
       only place an earlier visit is written is the whole verification queue,
       which holds names and postal addresses of people who are not members yet.
       Reading it here would download all of that into a member`s browser
       (pages/publicData.test.tsx refuses it by name). */
    const asked: string[] = []
    const real = globalThis.fetch

    globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      asked.push(String(input))

      return real(input, init)
    }

    try {
      renderAt('/sr/podesavanja', 'competitor', withOne.memberNumber)

      await panelFor()

      expect(asked.filter((one) => one.includes('verification'))).toEqual([])
    } finally {
      globalThis.fetch = real
    }
  })
})

describe('where a biography can be sent for review at all', () => {
  it('is this screen and nowhere else, and the net says so by reading the sources', () => {
    /* MOVED HERE ON 28.09.2026 from `pages/Registration.test.tsx`, where it stood beside
       the registration's own biography box. The box left the registration that day, so a
       net about „which screen can send a biography for review" no longer has anything to
       do with that file, and what it names is this one.
     *
       ~~It had a second half, which spelt out the words of the rule beside the field:
       `sr.registration.bioHint`.~~ That rule was one of the seven the owner kept on
       31.08.2026 („Registracija → Svojim rečima"), and it was kept ON THE REGISTRATION -
       the same day he deleted the identical sentence from THIS panel, by name, with two
       others. So when the field moved here it moved to the one screen whose rule he had
       already struck, and the sentence has no home left. The key is gone from both
       dictionaries with it. What a member sees instead is the count in the box, which is
       what that deletion left standing and what the two cases above measure.
     *
       Four attempts at mechanising this, and the fourth is the reason there is no fifth.
       „These five words are not on the screen" was beaten by a review putting the same
       promise back in different words. „One form definition has a box for a biography"
       was beaten because the panel the owner decided on uses no form definition. „No
       source file contains `kind: 'bio'`" was beaten by `const kind = SORT`, and by
       double quotes: a guard that reads source text guards the spelling. Counting the
       controls on Settings was beaten twice over.
     *
       What it does not catch is still named, so nobody reads it as cover: a panel that
       builds the sort through a variable, or writes it in double quotes, walks past. What
       it does catch is the plain one, which is how both the picture and this panel are
       written. */
    /* And the net is asked whether it caught anything at all before it is asked what it
       caught. Narrowed to one folder by accident, it would go on passing over a panel
       written in plain sight: measured, with the root cut to `src/clock`, the guard
       stayed green while the panel stood there. */
    const swept = sources()

    expect(swept.length).toBeGreaterThan(WHOLE_PORTAL)
    expect(swept.some(({ path }) => path.endsWith(inside('member', 'ProfileBio.tsx')))).toBe(true)
    /* And it holds no helper. Nothing under `src/test/` ships, so a sentence written in
       one of them is not something the portal does; read as though it were, a plain line
       in a comment there failed a guard about screens. */
    expect(swept.filter(({ path }) => path.includes(inside('src', 'test', '')))).toEqual([])

    const sending = swept
      .filter(({ code }) => code.includes("kind: 'bio'") || code.includes('kind: "bio"'))
      /* Named from `src` down, and cut at the **last** `src` rather than the first: a
         checkout into a folder that itself carries `src` would otherwise make every path
         unrecognisable and this list impossible to read. */
      .map(({ path }) => path.slice(path.lastIndexOf(inside('src', ''))).split(SEP).join('/'))

    expect(sending).toEqual(['src/pages/member/ProfileBio.tsx'])
  })
})

/**
 * THE BOX ITSELF, WHICH MOVED HERE ON 28.09.2026 RATHER THAN BEING DELETED.
 *
 * These eight stood in `pages/Registration.test.tsx` and measured `forms/LongBox.tsx`
 * through the registration's own biography field. The owner took that field off the
 * registration that day („Profilna sekcija se sa slikom i svojim recima izbacuje iz
 * registracione forme - to ce clan popunjavati naknadno kad bude odobren"), so the box
 * they are about is THIS one: the only place on the portal a member writes about himself.
 *
 * **Moved and not rewritten from memory.** What each of them measures is unchanged, and so
 * is the number, because the number moved with the box (`profil.form.json`). The old copy
 * is gone rather than left standing: a case measuring a field no screen draws reads as
 * cover, and `CLAUDE.md` names moving logic as the commonest way a dead copy is born.
 */
describe('the box a member writes about themselves in', () => {
  it('counts down what is left and refuses more than the limit', async () => {
    /* Owner, 01.08.2026. Three hundred and sixty is the limit the box has always
       carried; what it did with it was mark the field wrong after the fact. It refuses
       at the door now, and says how much room is left before anybody runs out of it. */
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const panel = await panelFor()
    const field = await box()

    expect(panel.getByText('Još 360 znakova')).toBeVisible()

    await user.type(field, 'Trčim zbog druženja.')
    expect(panel.getByText('Još 340 znakova')).toBeVisible()

    /* Tall enough for the whole of it from the start, so nothing that fits has to be
       read through a scrollbar. */
    expect(field).toHaveAttribute('rows', '6')
    expect(field).toHaveAttribute('maxlength', '360')
  })

  it('tells whoever cannot see the count that it is there', async () => {
    /* The count was printed under the box and described by nothing, so a screen reader
       read the label on arrival and never the one number that says how much of the box
       is already spent. */
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const field = await box()
    const described = (field.getAttribute('aria-describedby') ?? '').split(' ')
    const counter = must(document.getElementById(described[described.length - 1] ?? ''), 'brojač')

    expect(counter).toHaveTextContent('Još 360 znakova')
  })

  it('counts in Serbian, which has three forms and not one', () => {
    /* „Još 1 znakova" is not a sentence anybody writes. The engine has had plural forms
       since it was written and this key was a single string.
     *
       The key is still called `registration.bioLeft` although the box is no longer on the
       registration: `LongBox` draws it for every long box the portal has, so the prefix
       names where it was first needed and not where it may be used. Said here so the next
       reader does not take that prefix for a claim. */
    expect(translate(sr, 'sr', 'registration.bioLeft', { count: 1 })).toBe('Još 1 znak')
    expect(translate(sr, 'sr', 'registration.bioLeft', { count: 3 })).toBe('Još 3 znaka')
    expect(translate(sr, 'sr', 'registration.bioLeft', { count: 7 })).toBe('Još 7 znakova')
  })

  it('says so when there is no room left, rather than counting nought', async () => {
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const panel = await panelFor()
    const field = await box()

    await user.click(field)
    /* Exactly the limit, so the box is full and nothing was lost filling it. */
    await user.paste('x'.repeat(360))

    expect(field).toHaveValue('x'.repeat(360))
    /* Twice in the markup and once to a reader: the line under the box, hidden from the
       reader because the same words reach it through `aria-describedby`, and the region
       that says it. The region is on the page from the start and empty until now, because
       one that is added together with its text is one a screen reader often misses. */
    expect(panel.getAllByText('Dosta je, granica je 360 znakova.')).toHaveLength(2)
    expect(panel.getByRole('status')).toHaveTextContent('Dosta je, granica je 360 znakova.')
  })

  it('keeps the region quiet while there is still room', async () => {
    /* It used to hold the count and change on every keystroke, which is three hundred and
       fifty-nine announcements of a number nobody was waiting to hear, each one to be got
       through before anything else could be said.

       **Asked of EVERY region and not of „the" one, which is what moving this case here
       cost and what it bought.** On the registration the box was the only thing on the
       screen that spoke, so `getByRole('status')` meant the box's region. This panel has
       another: the one that says the text has not changed, drawn exactly while the box is
       untouched, which is the state this case is about. `getByRole` therefore found two
       and threw - measured, not foreseen.

       So what is held is the thing that actually matters, and it is the stronger of the
       two: NOTHING on this panel announces the wall or a lost paste while there is still
       room. Written as „the region is empty" it was also a claim about which region that
       is, and that claim was the half that did not survive the move. */
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const panel = await panelFor()

    expect(panel.getAllByRole('status').length).toBeGreaterThan(0)
    expect(
      panel
        .getAllByRole('status')
        .map((one) => one.textContent ?? '')
        .filter((said) => /Dosta je|Nalepljeni tekst/.test(said)),
    ).toEqual([])
  })

  it('says how much of a paste was thrown away, rather than throwing it away in silence', async () => {
    /* The limit is refused at the door, and the browser refuses in silence: 400
       characters into a box that holds 360 keeps 360 and drops 40 without a word. The
       counter then reads „the box is full", which is read as „I filled it". */
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const panel = await panelFor()
    const field = await box()

    await user.click(field)
    await user.paste('x'.repeat(400))

    const said =
      'Nalepljeni tekst je bio 40 znakova duži nego što staje, pa taj višak nije primljen.'

    /* On the screen once and to a reader once: the visible sentence is hidden from the
       reader, and the region that was there all along says it. */
    expect(panel.getAllByText(said)).toHaveLength(2)
    expect(panel.getByRole('status')).toHaveTextContent(said)

    /* And it goes the moment the writer does anything themselves. Not when the box drops
       below its limit, which was the first rule and left the message standing through
       every edit that kept the length: typing over a selected character is an edit the
       writer made and the length does not move. */
    await user.type(field, '{Backspace}x')
    expect(panel.queryByText(/Nalepljeni tekst/)).toBeNull()
  })

  it('counts what a paste over a selection really loses, not what it brought', async () => {
    /* Pasting over the whole box is not an overflow: what the selection gives back is
       room. Without this the rule is arithmetic no test touches, so taking the two the
       wrong way round would go green.

       The event is dispatched rather than performed, because neither Ctrl+A nor a
       selection set on the element moves the selection userEvent pastes against, and a
       paste into a box that is full is the other case, not this one. What is being checked
       is the arithmetic the handler does with the selection it is given, and that is
       exactly what this hands it. */
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const panel = await panelFor()
    const field = (await box()) as HTMLTextAreaElement

    await user.click(field)
    await user.paste('x'.repeat(360))

    field.setSelectionRange(0, 360)
    fireEvent.paste(field, { clipboardData: { getData: () => 'y'.repeat(380) } })

    expect(panel.getByRole('status')).toHaveTextContent(
      'Nalepljeni tekst je bio 20 znakova duži nego što staje, pa taj višak nije primljen.',
    )
  })

  it('does not charge a Windows clipboard for its line endings', async () => {
    /* The clipboard carries CR LF and a textarea keeps LF, so counting the clipboard as it
       comes charges the writer one character per line for something the box never held.
       Ten lines of thirty-six, which is 360 in the box and 369 on the clipboard: it all
       fits, and nothing is lost. */
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const panel = await panelFor()
    const field = await box()

    await user.click(field)
    await user.paste(Array.from({ length: 10 }, () => 'x'.repeat(35)).join('\r\n'))

    expect(panel.queryByText(/Nalepljeni tekst/)).toBeNull()
  })

  it('says nothing when the paste fits', async () => {
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', withNone.memberNumber)

    const panel = await panelFor()
    const field = await box()

    await user.click(field)
    await user.paste('x'.repeat(40))

    expect(panel.queryByText(/Nalepljeni tekst/)).toBeNull()
    expect(panel.getByText('Još 320 znakova')).toBeVisible()
  })
})
