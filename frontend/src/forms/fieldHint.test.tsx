import { screen, waitFor, within } from '@testing-library/react'
import { fireEvent, render } from '@testing-library/react'
import { ClockProvider } from '../clock/ClockProvider'
import { I18nProvider } from '../i18n/I18nProvider'
import { registracija, FORMS } from './definitions'
import type { FieldDef } from './types'
import sr from '../i18n/sr.json'
import { bare, inside, sources, WHOLE_PORTAL } from '../test/sources'

/** Every form the portal defines, as its own registry lists them. */
const ALL_FORMS = Object.values(FORMS)
import { FormRenderer } from './FormRenderer'
import { must } from '../test/at'
import { setupUser } from '../test/user'

/** The rules the owner keeps on the whole portal, written out once and read by two
 *  cases: the one that counts what forms carry, and the one that refuses to see any of
 *  them written into a screen by hand. Two lists would drift, and the drift would show
 *  as a guard quietly holding one fewer.
 *
 *  Seven from 31.08.2026, and **eight since 20.09.2026**: the owner asked for the rule
 *  about the length of a password to stand beside the field on the screen a link out of
 *  a message lands on (`pages/account/NewPassword.tsx`). His reason is what separates
 *  that field from the password field of the registration form, which is one of the
 *  fifty four he had deleted and still carries no rule: whoever reads this one arrived
 *  from a message with no rule in front of him, and a password box empties itself on
 *  every refusal, so learning the rule from the server costs him the whole thing typed
 *  again.
 *
 *  It is in this list on the same terms as the other seven, which is the point: it is
 *  declared as a `hintKey` on the screen that draws it, so the sweep below counts it,
 *  and the day somebody adds a ninth without being asked this fails. A rule that
 *  reached a screen WITHOUT a `hintKey` is the shape three of them outlived the
 *  deletion in, and that is what the second case refuses. */
const KEPT = [
  'newPassword.passwordHint',
  'newResult.linkHint',
  'newResult.photoHint',
  'newResult.raceKindHint',
  'registration.bioHint',
  'registration.fatherNameHint',
  'registration.idNumberHint',
  'registration.parentConsentHint',
]

/** A name as it stands inside a regular expression, where its dots are dots and
 *  not "any character at all". */
const asWritten = (name: string) => name.replaceAll('.', String.raw`\.`)

/**
 * The rule a field carries, asked for rather than printed under it.
 *
 * Owner, 11.08.2026: „Svuda ćemo koristiti tooltip". What must not change with
 * it is that the rule is still read out with the field: a rule only sighted
 * people have is a rule half the people filling in the form do not.
 */
function renderForm() {
  render(
    <ClockProvider simulatedDay={null}>
      <I18nProvider locale="sr">
        <FormRenderer form={registracija} onSubmit={() => {}} />
      </I18nProvider>
    </ClockProvider>,
  )
}

/**
 * Eight rules on the whole portal, and these are they.
 *
 * The owner read a numbered list of all sixty one on 31.08.2026 and named the ones
 * to keep, with the words for six of them; „sve ostalo treba obrisati". He asked for
 * an eighth on 20.09.2026, beside the password on the screen a link out of a message
 * lands on. Counted here rather than left to whoever adds a field: a rule added
 * quietly is the state this began in, a dozen paragraphs on one form, and a rule
 * taken away quietly is how the ones he kept would leave.
 */
describe('the rules that were kept', () => {
  it('are the eight he named, beside those fields and no others', () => {
    /* **Both homes of the fact, not one.** Fifty nine of the sixty one stood in the
       JSON definitions and two were built in code, in `pages/admin/entityForms.ts`;
       a check that read only the definitions was green while one of those two was
       still on the screen (review, 31.08.2026). So the sweep reads the sources, the
       way the portal's other sweeps do, and a rule added anywhere lands here. */
    const swept = sources()

    /* **The floor and the witness, the same two the case below carries.** They were
       added there and not here in the same round, and the asymmetry is the whole of
       this: the definitions alone answer with the seven, so a sweep that reached
       nothing would leave this green while a rule built in code stood on a screen —
       which is the one case this half exists for. The witness names
       `pages/admin/entityForms.ts` rather than any file, because that is the file
       whose two rules the definitions could not see (review, 31.08.2026). */
    expect(swept.length).toBeGreaterThan(WHOLE_PORTAL)
    expect(swept.some(({ path }) => path.endsWith(inside('admin', 'entityForms.ts')))).toBe(true)

    const carried = [
      ...ALL_FORMS.flatMap((form) =>
        form.fields.filter((field) => field.hintKey !== undefined).map((field) => field.hintKey),
      ),
      ...swept.flatMap(({ code }) =>
        [...bare(code).matchAll(/hintKey:\s*'([^']+)'/g)].map((one) => one[1]),
      ),
    ]

    expect([...new Set(carried)].sort()).toEqual(KEPT)

    /* Ten fields and eight rules, because two of them are asked for on two forms:
       the link and the picture stand on both roads a result is reported by, so one
       wording answers for both. The tenth is the eighth rule itself, declared on the
       screen that draws it rather than in a definition, which is what makes it visible
       to the sweep above at all. */
    expect(carried).toHaveLength(10)
  })

  it('are never written into a screen by hand, under any name they have had', () => {
    /* Which is the half the sweep above could not see, and the reason three rules
       outlived it.

       **Without a number**, because the one that stood here, „fifty four", matched no
       reading of the list: by occurrences it was fifty two and by distinct keys fifty,
       and today, with the definitions grown, it is neither of those either (review,
       31.08.2026). A count written into prose is a fact with a second home that nobody
       updates; the sweep above counts, and this says what it cannot see.

       It counts `hintKey`, and a rule written straight
       into a screen carries no such thing: the box for a biography had one in a
       `<p>` of its own, and the chooser for a picture took one as a prop, so both
       stood on the portal while a test said seven and meant seven **of one kind**.
       The owner had all three deleted on 31.08.2026, and this is what stops a
       fourth being written the same way tomorrow.

       **Two names are asked for, not one.** The first draft asked only for names
       ending in `rule`, and a review answered it by hand-writing `registration.
       bioHint` into a second screen: one of the seven, drawn beside a field no form
       asks it for, and the sweep said nothing. The names do not have to be guessed
       at, they are listed above, so both are held: **the three that were deleted
       must not come back under their old names, and a rule that is kept must reach a
       field through something the case above can count, never by being typed into a
       `t(…)` call.**

       **What „through something the case above can count" means since 20.09.2026.**
       It was „through the form that asks for it" while every rule came from a
       definition. The eighth does not: `pages/account/NewPassword.tsx` builds its two
       controls by hand and the sentence takes a number, which `FormRenderer` does not
       interpolate. So it declares a `hintKey` of its own and hands that to the hint,
       and the sweep above counts it exactly as it counts a definition's. What this
       case refuses is unchanged and is the thing that actually went wrong: a name
       written out inside a call, where nothing counts it.

       **Only the opening of the call is read**, which is the shape `i18n/said.test.ts`
       already uses and the shape the first draft got wrong: it asked for the closing
       `')` too, so `t('bio.rule', { count: 360 })` was invisible and the whole rule
       could come back with the suite green (measured in review, 31.08.2026). The
       word boundary is there for the same reason from the other side, so that
       `format('x.rule')` is not read as a call to `t`.

       **What this does not catch**, said plainly rather than left to be found: a
       rule invented under a wholly new name, `t('picture.explanation')` and the
       like. The name of this case said „whatever they are named" until 31.08.2026 and
       promised exactly that; it now says „under any name they have had", which is the
       two the expression really reads: a name ending in `rule`, and the ones listed
       above. Holding every paragraph on the portal would mean deciding which of them
       counts as a rule beside a field, and that is a question about the word rather
       than a defect in the code. Comments blanked, so a note naming a key is not
       read as using one. */
    const swept = sources()

    /* The floor and the witness, because a sweep that finds nothing agrees with
       everything: emptied, this passed while the rule stood on the screen. Held
       the way `app/filterParams.test.ts` holds its own. */
    expect(swept.length).toBeGreaterThan(WHOLE_PORTAL)
    expect(swept.some(({ path }) => path.endsWith(inside('member', 'ProfileBio.tsx')))).toBe(true)

    /* Either quotation mark, because nothing in the repository imposes one. The
       first draft read only single quotes, and the sentence above promised „under
       any name they have had“ while a rule written `t("registration.bioHint")` was
       invisible to it (review, 31.08.2026). oxlint's `quotes` rule is not switched on
       here, so the habit of the codebase is the only thing keeping the other mark out,
       and a habit is not a gate. */
    const banned = new RegExp(
      `\\bt\\(\\s*['"]([A-Za-z0-9_.]*[Rr]ule|${KEPT.map(asWritten).join('|')})['"]`,
      'g',
    )
    const byHand = swept.flatMap(({ path, code }) =>
      [...bare(code).matchAll(banned)].map((one) => `${path}: ${String(one[1])}`),
    )

    expect(byHand).toEqual([])
  })
})

describe('an answer chosen from buttons', () => {
  it('says what is wrong with it, on the group and on every button in it', async () => {
    /* The rule beside such a group went out on 31.08.2026 with the other fifty
       four, and the case that measured it went with it. **This half did not go**:
       a description is read for whatever holds the focus, and what holds it is a
       button, so the complaint has to be on the group for whoever arrives at the
       group and on each button for whoever tabs into one (WCAG 2.2 SC 3.3.1).

       Left with the deleted case, both were measured passing with the attribute
       taken off (review, 31.08.2026). */
    const user = setupUser()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    const group = await screen.findByRole('radiogroup', { name: 'Pol' })
    const said = must(group.getAttribute('aria-describedby'), 'what describes the group')

    expect(said).toContain('field-gender-error')
    expect(document.getElementById(said)).not.toBeNull()

    for (const one of within(group).getAllByRole('radio')) {
      expect(one.getAttribute('aria-describedby'), one.getAttribute('value') ?? '').toContain(
        'field-gender-error',
      )
    }
  })
})

describe('the rule beside a field', () => {
  it('is not printed on the page, and is still what the field is described by', () => {
    renderForm()

    const father = screen.getByLabelText(/^Ime oca$/)
    const said = father.getAttribute('aria-describedby')

    expect(said).toBe('field-fatherName-hint')

    const rule = document.getElementById('field-fatherName-hint')

    expect(rule).toHaveTextContent(/po zakonu/)
    /* In the document and out of sight: `clip-path` rather than `display: none`,
       which would take it out of the accessibility tree and with it the rule.
       jsdom applies no stylesheet, so what is held here is the shape that makes
       that possible, not the pixels. */
    expect(rule).toHaveClass('hint__text')
  })

  it('is put away by a press anywhere but the letter that opens it', async () => {
    /* What the box being laid over the page costs, and what pays for it. It
       covers whatever is under it, so a box left open by a finger used to
       swallow the first press on the control beneath and nothing said why. Now
       that press closes it and the second one lands (owner, 12.08.2026).

       The words close it too, and that is the half that was missing: the box
       hangs under the head of the field and therefore over the field's own
       control, so on a telephone the control is under the words for most of its
       width. Exempted, a press there did nothing at all and there was no way to
       reach the control except by pressing somewhere else first.

       Hovering is untouched, which is what SC 1.4.13 asks for: the pointer
       travels from the letter into the words and they stay. */
    const user = setupUser()
    renderForm()

    const hint = must(
      screen
        .getByLabelText(/^Ime oca$/)
        .closest('.field')
        ?.querySelector<HTMLElement>('.hint'),
      'the rule beside the father’s name',
    )
    const asked = within(hint).getByRole('button', { name: 'Objašnjenje' })
    const words = must(hint.querySelector<HTMLElement>('.hint__text'), 'the words')

    await user.hover(asked)

    expect(asked).toHaveAttribute('aria-expanded', 'true')

    /* Into the words, which must keep them open. */
    await user.hover(words)

    expect(asked).toHaveAttribute('aria-expanded', 'true')

    /* Pressed on the words, which must not. */
    await user.pointer({ target: words, keys: '[MouseLeft>]' })

    expect(asked).toHaveAttribute('aria-expanded', 'false')
  })

  it('is put away by a press on anything else on the page', async () => {
    const user = setupUser()
    renderForm()

    const hint = must(
      screen
        .getByLabelText(/^Ime oca$/)
        .closest('.field')
        ?.querySelector<HTMLElement>('.hint'),
      'the rule beside the father’s name',
    )
    const asked = within(hint).getByRole('button', { name: 'Objašnjenje' })

    await user.hover(asked)

    expect(asked).toHaveAttribute('aria-expanded', 'true')

    await user.pointer({ target: screen.getByLabelText(/^Adresa za slanje$/), keys: '[MouseLeft>]' })

    expect(asked).toHaveAttribute('aria-expanded', 'false')
  })

  it('is closed by Escape pressed anywhere, while the pointer stays put', async () => {
    /* The case the whole rule exists for (WCAG 2.2 SC 1.4.13): somebody typing
       into a field with the pointer resting on the letter beside another one.
       The press goes to the field, not to the button, so a handler on the button
       never hears it and the box stayed open under a pointer that had not moved.
       SC 1.4.13 asks that it can be put away without moving either. */
    const user = setupUser()
    renderForm()

    const hint = must(
      screen
        .getByLabelText(/^Ime oca$/)
        .closest('.field')
        ?.querySelector<HTMLElement>('.hint'),
      'the rule beside the father’s name',
    )
    const asked = within(hint).getByRole('button', { name: 'Objašnjenje' })

    /* The keyboard goes first and stays where it is: pressing anything after
       this is pressing it into the field, not into the button. */
    await user.click(screen.getByLabelText(/^Adresa za slanje$/))
    await user.hover(asked)

    expect(asked).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText(/^Adresa za slanje$/)).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(asked).toHaveAttribute('aria-expanded', 'false')
    /* And neither the pointer nor the keyboard was moved to do it, which is the
       whole of what SC 1.4.13 asks. */
    expect(screen.getByLabelText(/^Adresa za slanje$/)).toHaveFocus()
  })

  it('stays open under a pointer that leaves while the keyboard is on it', async () => {
    /* Two reasons hold it open and they are counted apart: taking the pointer
       away must not close what the focus is still holding. */
    const user = setupUser()
    renderForm()

    const hint = must(
      screen
        .getByLabelText(/^Ime oca$/)
        .closest('.field')
        ?.querySelector<HTMLElement>('.hint'),
      'the rule beside the father’s name',
    )
    const asked = within(hint).getByRole('button', { name: 'Objašnjenje' })

    await user.click(asked)
    await user.unhover(asked)

    expect(asked).toHaveFocus()
    expect(asked).toHaveAttribute('aria-expanded', 'true')
  })

  it('opens on the button beside the field, and closes on leaving it', async () => {
    /* A press opens it and so does arriving with the keyboard. It does not
       close on a second press: a press is also an arrival, so a toggle would
       fight the focus the same press brings and the two would end where they
       started. */
    const user = setupUser()
    renderForm()

    const asked = within(
      screen.getByLabelText(/^Ime oca$/).closest('.field') ?? document.body,
    ).getByRole('button', { name: 'Objašnjenje' })

    expect(asked).toHaveAttribute('aria-expanded', 'false')

    await user.click(asked)

    expect(asked).toHaveAttribute('aria-expanded', 'true')

    /* Both reasons have to go: the press left the keyboard on it and the press
       left the pointer on it too. */
    await user.tab()
    await user.unhover(asked)

    expect(asked).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes on Escape, and lets everything else have that press too', async () => {
    /* The press is not stopped. Stopped, it never reached the listeners waiting
       on the same document on the way back up, which is where the calendar, the
       menus in the header and the list of towns all sit: a tooltip open anywhere
       on the page meant none of them closed. What the stopping was for was a
       form inside a sheet, and the portal has none, so nothing is stopped. */
    const user = setupUser()
    let outside = 0

    render(
      <ClockProvider simulatedDay={null}>
        <I18nProvider locale="sr">
          <div onKeyDown={() => (outside += 1)}>
            <FormRenderer form={registracija} onSubmit={() => {}} />
          </div>
        </I18nProvider>
      </ClockProvider>,
    )

    const asked = within(
      must(
        screen.getByLabelText(/^Ime oca$/).closest<HTMLElement>('.field'),
        'the field of the father’s name',
      ),
    ).getByRole('button', { name: 'Objašnjenje' })

    await user.click(asked)

    expect(asked).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')

    expect(asked).toHaveAttribute('aria-expanded', 'false')
    expect(outside).toBe(1)
  })

  it('opens under the pointer and closes when it leaves', async () => {
    /* A tooltip is a thing a pointer asks for by resting on it. Held on the
       wrapper rather than on the letter, so that reaching down for the words
       does not close them on the way (WCAG 2.2 SC 1.4.13). */
    const user = setupUser()
    renderForm()

    const hint = must(
      screen
        .getByLabelText(/^Ime oca$/)
        .closest('.field')
        ?.querySelector<HTMLElement>('.hint'),
      'the rule beside the address',
    )
    const asked = within(hint).getByRole('button', { name: 'Objašnjenje' })

    await user.hover(asked)

    expect(asked).toHaveAttribute('aria-expanded', 'true')

    /* And the words themselves hold it open, so they can be read to the end and
       taken: the pointer travels from the letter into them without the box
       closing under it (WCAG 2.2 SC 1.4.13, hoverable). */
    await user.hover(within(hint).getByText(/po zakonu/))

    expect(asked).toHaveAttribute('aria-expanded', 'true')

    await user.unhover(within(hint).getByText(/po zakonu/))

    expect(asked).toHaveAttribute('aria-expanded', 'false')
  })

  it('says which field it is about without taking that field its name', () => {
    /* „Objašnjenje: Pol" would put the name of the field into the name of the
       button, and then every way of finding a control by its name finds two. */
    renderForm()

    const asked = within(
      screen.getByLabelText(/^Ime oca$/).closest('.field') ?? document.body,
    ).getByRole('button', { name: 'Objašnjenje' })

    expect(asked).toHaveAttribute('aria-describedby', 'field-fatherName-label')
    expect(document.getElementById('field-fatherName-label')).toHaveTextContent('Ime oca')
  })
})

describe('the rule of a field, once it is open', () => {
  it('is put away by Escape even when the keyboard is standing on it', async () => {
    /* Answered on the document while it is open (FieldHint.tsx), so the press
       reaches it wherever the keyboard happens to be. */
    const user = setupUser()
    renderForm()

    const asked = within(
      must(
        screen.getByLabelText(/^Ime oca$/).closest<HTMLElement>('.field'),
        'the field of the father’s name',
      ),
    ).getByRole('button', { name: 'Objašnjenje' })

    await user.click(asked)

    expect(asked).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')

    expect(asked).toHaveAttribute('aria-expanded', 'false')
  })

  it('is asked for again after it was put away', async () => {
    /* Escape puts it away and nothing more: the next time the pointer or the
       keyboard arrives, it is a new asking. */
    const user = setupUser()
    renderForm()

    const asked = within(
      must(
        screen.getByLabelText(/^Ime oca$/).closest<HTMLElement>('.field'),
        'the field of the father’s name',
      ),
    ).getByRole('button', { name: 'Objašnjenje' })

    await user.click(asked)
    await user.keyboard('{Escape}')
    await user.unhover(asked)
    await user.hover(asked)

    expect(asked).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('a rule the screen hands in about a town', () => {
  it('is what the field says, rather than the one about the country', () => {
    /* The rule about the country is the last resort: it is written where a town
       is asked for and nothing else is wrong with it. A screen that has
       something more particular to say about the same field has said it, and
       that is what belongs on the screen. */
    const user = setupUser()

    render(
      <ClockProvider simulatedDay={null}>
        <I18nProvider locale="sr">
          <FormRenderer
            form={{
              id: 'proba',
              titleKey: 'proba.naslov',
              submitKey: 'proba.posalji',
              fields: [{ name: 'city', type: 'place', labelKey: 'proba.mesto', required: true }],
            }}
            onSubmit={() => {}}
            check={() => ({ city: { key: 'proba.vecPostoji' } })}
          />
        </I18nProvider>
      </ClockProvider>,
    )

    return user
      .type(screen.getByRole('combobox', { name: /proba.mesto/ }), 'Zaseok pod brdom')
      .then(() => user.click(screen.getByRole('button', { name: 'proba.posalji' })))
      .then(() => {
        expect(screen.getByText('proba.vecPostoji')).toBeInTheDocument()
        expect(screen.queryByText('Izaberi državu uz mesto.')).toBeNull()
      })
  })
})

describe('Escape while a rule is open', () => {
  it('lets the press through to whatever else was waiting for it', async () => {
    /* Stopped every time, an open tooltip swallowed Escape for the whole
       portal: the list of towns, the calendar, and the menus in the header all
       answer Escape themselves, and this listener runs before every one of
       them. The pointer resting on a letter is not a reason for any of them to
       stop working. */
    const user = setupUser()
    renderForm()

    const letter = within(
      must(
        screen.getByLabelText(/^Ime oca$/).closest<HTMLElement>('.field'),
        'the field of the father’s name',
      ),
    ).getByRole('button', { name: 'Objašnjenje' })

    fireEvent.mouseOver(letter)

    expect(letter).toHaveAttribute('aria-expanded', 'true')

    /* A list of towns, open, with the keyboard in it. */
    await user.type(screen.getByLabelText(/^Mesto$/), 'Beo')
    await screen.findByRole('listbox')

    await user.keyboard('{Escape}')

    /* Both answer the same press: the rule is put away and the list closes. */
    expect(letter).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull()
    })
  })

})

describe('what nothing else was holding', () => {
  it('lets the summary of errors put the cursor inside the group', () => {
    /* A group is not focusable of itself, so following the link only scrolled:
       the keyboard stayed where it was, which is not what a list of things to
       fix promises. */
    renderForm()

    const group = screen.getByRole('radiogroup', { name: 'Pol' })

    expect(group).toHaveAttribute('tabindex', '-1')

    group.focus()

    expect(group).toHaveFocus()
  })

  it('keeps the letter out of what is read aloud', () => {
    /* The button is named „Objašnjenje" and shows „i". A control whose visible
       words are not in its name cannot be spoken to (WCAG 2.2 SC 2.5.3), so the
       letter is a drawing as far as a screen reader is concerned. */
    renderForm()

    const asked = within(
      must(
        screen.getByLabelText(/^Ime oca$/).closest<HTMLElement>('.field'),
        'the field of the father’s name',
      ),
    ).getByRole('button', { name: 'Objašnjenje' })

    expect(asked).toHaveAccessibleName('Objašnjenje')
    expect(must(asked.querySelector('span'), 'the letter drawn in it')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })

  it('asks for the rule again when the keyboard arrives after Escape', () => {
    renderForm()

    const asked = within(
      must(
        screen.getByLabelText(/^Ime oca$/).closest<HTMLElement>('.field'),
        'the field of the father’s name',
      ),
    ).getByRole('button', { name: 'Objašnjenje' })

    fireEvent.focus(asked)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(asked).toHaveAttribute('aria-expanded', 'false')

    fireEvent.blur(asked)
    fireEvent.focus(asked)

    expect(asked).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('two rules standing side by side', () => {
  it('does not leave one open when the pointer sweeps into the other', () => {
    /* Two fields do stand next to each other in a row: „Ime oca" and „Broj
       pošte" and „Lozinka" are sixteen pixels apart, and a pointer sweeping from
       the open words of one into the letter of the other is one sample of
       movement. Asked whether it was still in „a hint" rather than in this one,
       the first stayed open with nothing holding it. */
    renderForm()

    const letterOf = (label: RegExp) =>
      within(
        must(
          screen.getByLabelText(label).closest<HTMLElement>('.field'),
          'the field of that name',
        ),
      ).getByRole('button', { name: 'Objašnjenje' })

    const father = letterOf(/^Ime oca$/)
    const document_ = letterOf(/^Broj ličnog dokumenta$/)

    fireEvent.mouseOver(father)

    expect(father).toHaveAttribute('aria-expanded', 'true')

    fireEvent.mouseOut(father, { relatedTarget: document_ })
    fireEvent.mouseOver(document_, { relatedTarget: father })

    expect(father).toHaveAttribute('aria-expanded', 'false')
    expect(document_).toHaveAttribute('aria-expanded', 'true')
  })

  it('is put away by one Escape, however many are open', () => {
    /* The press is heard on the way down, so every hint that is open hears it,
       and it is stopped before it reaches whatever the form is standing in. */
    renderForm()

    const letterOf = (label: RegExp) =>
      within(
        must(
          screen.getByLabelText(label).closest<HTMLElement>('.field'),
          'the field of that name',
        ),
      ).getByRole('button', { name: 'Objašnjenje' })

    const father = letterOf(/^Ime oca$/)
    const document_ = letterOf(/^Broj ličnog dokumenta$/)

    fireEvent.mouseOver(father)
    fireEvent.focus(document_)

    expect(father).toHaveAttribute('aria-expanded', 'true')
    expect(document_).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(father).toHaveAttribute('aria-expanded', 'false')
    expect(document_).toHaveAttribute('aria-expanded', 'false')
  })

  it('stays put away while the pointer only stirs inside the same letter', () => {
    /* Escape leaves the pointer where it is, and `mouseover` bubbles out of the
       letter drawn inside the button: a hair of movement over twenty four pixels
       brought back what had just been put away. */
    renderForm()

    const asked = within(
      must(
        screen.getByLabelText(/^Ime oca$/).closest<HTMLElement>('.field'),
        'the field of the father’s name',
      ),
    ).getByRole('button', { name: 'Objašnjenje' })
    const drawn = must(asked.querySelector('span'), 'the letter drawn in it')

    fireEvent.mouseOver(asked)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(asked).toHaveAttribute('aria-expanded', 'false')

    fireEvent.mouseOut(asked, { relatedTarget: drawn })
    fireEvent.mouseOver(asked, { relatedTarget: drawn })

    expect(asked).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('the pointer leaving the rule of a field', () => {
  it('closes it when the pointer leaves the window entirely', () => {
    /* Then there is nowhere it went: `relatedTarget` is null, which is not an
       element and so is not this hint either. Dispatched rather than acted,
       because leaving a window is not something a person does inside one. */
    renderForm()

    const hint = must(
      screen
        .getByLabelText(/^Ime oca$/)
        .closest('.field')
        ?.querySelector<HTMLElement>('.hint'),
      'the rule beside the father’s name',
    )
    const asked = within(hint).getByRole('button', { name: 'Objašnjenje' })

    fireEvent.mouseOver(asked)

    expect(asked).toHaveAttribute('aria-expanded', 'true')

    fireEvent.mouseOut(asked, { relatedTarget: null })

    expect(asked).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes it when the pointer goes to something that is not a hint', () => {
    renderForm()

    const hint = must(
      screen
        .getByLabelText(/^Ime oca$/)
        .closest('.field')
        ?.querySelector<HTMLElement>('.hint'),
      'the rule beside the father’s name',
    )
    const asked = within(hint).getByRole('button', { name: 'Objašnjenje' })

    fireEvent.mouseOver(asked)
    fireEvent.mouseOut(asked, { relatedTarget: screen.getByLabelText(/^Ime oca$/) })

    expect(asked).toHaveAttribute('aria-expanded', 'false')
  })

  it('keeps it open while the pointer moves from the words back to the letter', () => {
    /* The other direction of the same journey: both halves ask about the hint
       they stand in, not about themselves. */
    renderForm()

    const hint = must(
      screen
        .getByLabelText(/^Ime oca$/)
        .closest('.field')
        ?.querySelector<HTMLElement>('.hint'),
      'the rule beside the father’s name',
    )
    const asked = within(hint).getByRole('button', { name: 'Objašnjenje' })
    const words = must(hint.querySelector<HTMLElement>('.hint__text'), 'the words of the rule')

    fireEvent.mouseOver(asked)
    fireEvent.mouseOut(asked, { relatedTarget: words })
    fireEvent.mouseOver(words)
    fireEvent.mouseOut(words, { relatedTarget: asked })

    expect(asked).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('a link inside the words of a field', () => {
  it('leads to the rules, in the language the form is being read in', () => {
    /* The confirmation says what is being agreed to and points at it (owner,
       11.08.2026). The address carries no language of its own in the definition:
       it is added here, from the page (ADL A2). */
    renderForm()

    const toRules = screen.getByRole('link', { name: 'pravilnikom' })

    expect(toRules).toHaveAttribute('href', '/sr/pravilnik')
    /* In a tab of its own, or following it would throw away a form that is half
       filled in. */
    expect(toRules).toHaveAttribute('target', '_blank')
  })

  it('keeps the sentence whole when a translation drops the mark', () => {
    /* „{link}" is the sort of thing that goes missing when somebody translates
       from the Serbian, and the dictionary guard cannot see it: the key resolves
       either way. What must not happen is the link sliding to the end of a
       sentence it belongs in the middle of. */
    render(
      <ClockProvider simulatedDay={null}>
        <I18nProvider locale="sr">
          <FormRenderer
            form={{
              id: 'proba',
              titleKey: 'proba.naslov',
              submitKey: 'proba.posalji',
              fields: [
                {
                  name: 'saglasnost',
                  type: 'checkbox',
                  labelKey: 'proba.bezOznake',
                  linkKey: 'proba.veza',
                  linkTo: 'pravilnik',
                },
              ],
            }}
            onSubmit={() => {}}
          />
        </I18nProvider>
      </ClockProvider>,
    )

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('proba.bezOznake')).toBeInTheDocument()
  })
})

describe('an answer chosen from buttons', () => {
  /* Owner, 11.08.2026: sex and category are buttons rather than lists, nothing
     is chosen to begin with, and exactly one must be. */
  it('starts with neither taken, and takes one at a time', async () => {
    const user = setupUser()
    renderForm()

    const male = screen.getByRole('radio', { name: 'Muški' })
    const female = screen.getByRole('radio', { name: 'Ženski' })

    expect(male).not.toBeChecked()
    expect(female).not.toBeChecked()

    await user.click(female)

    expect(female).toBeChecked()
    expect(male).not.toBeChecked()

    /* And it works as a switch: pressing the other one takes the first off. */
    await user.click(male)

    expect(male).toBeChecked()
    expect(female).not.toBeChecked()
  })

  it('carries the words of a confirmation and its letter in one head', () => {
    /* The class is what puts them on one line: written only in the stylesheet,
       taking it off the element would have left the letter under the sentence
       and every test would still have passed (jsdom computes no layout). */
    renderForm()

    const confirm = must(
      screen.getByLabelText(/zdravstveno sposoban/).closest<HTMLElement>('.field'),
      'the field of the confirmation',
    )

    expect(confirm.querySelector('.field__head--confirm')).not.toBeNull()
  })

  it('refuses to go through with neither taken, and says which group is missing', async () => {
    const user = setupUser()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    const summary = screen.getByRole('alert')

    const toSex = within(summary).getByRole('link', { name: 'Pol' })

    expect(toSex).toBeInTheDocument()
    expect(within(summary).getByRole('link', { name: 'Kategorija' })).toBeInTheDocument()

    /* And it leads somewhere. Every other field is reached through its own
       control, which carries the id the summary points at; a group has no one
       control, so without an id of its own the link „Pol" pointed at nothing,
       and these two are the likeliest errors on this form. */
    const at = must(toSex.getAttribute('href'), 'the address the summary points at')

    expect(document.getElementById(at.replace('#', ''))).toBeInTheDocument()
  })
})

/**
 * The words a key stands for, out of the dictionary the form is drawn in.
 *
 * Read rather than written out here: nineteen labels copied into this file would
 * be a second home for every one of them, and the day one is reworded the guard
 * would be holding the old one.
 */
function words(key: string): string {
  /* Walked rather than asserted into shape: the portal refuses type assertions
     (`styles/noAssertions`), and a dictionary read with `as` would go on saying
     it holds a string after the day it holds an object. */
  const holds = (one: unknown): one is Record<string, unknown> =>
    typeof one === 'object' && one !== null

  let said: unknown = sr

  for (const step of key.split('.')) {
    said = holds(said) ? said[step] : undefined
  }

  return String(must(said, `the dictionary says nothing for ${key}`))
}

/**
 * How a field is found on screen by the words the definition gives it.
 *
 * Cut at the first `{` because one label carries a link inside its words, and
 * anchored at the front with what may follow it, because a field that need not
 * be answered is drawn „Telefon (neobavezno)" and because „Ime" would otherwise
 * find „Ime oca" as well.
 */
function labelFound(labelKey: string): RegExp {
  const said = words(labelKey)
  const head = said.split('{')[0] ?? ''
  const asWords = head.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)

  /* A label that carries a link inside its words goes on after the part that is
     written down, so what is written down is a prefix and nothing may be asked
     about what follows it. */
  return said.includes('{') ? new RegExp(`^${asWords}`) : new RegExp(`^${asWords}(\\s*\\(|$)`)
}

/**
 * The rows the DEFINITION asks for, counted the way the renderer counts them.
 *
 * A run of neighbours carrying one number, which is what a row is
 * (`FormRenderer.rowsOf`), and a town counted as two columns because it carries
 * the country beside it (`columnsOf`). Derived rather than written out, so a
 * field moved from one row to another is a failure here rather than a table in
 * this file quietly describing a form that no longer exists.
 */
function rowsTheDefinitionAsksFor(): { fields: FieldDef[]; columns: number }[] {
  const rows: FieldDef[][] = []

  for (const field of registracija.fields) {
    const last = rows.at(-1)

    if (last !== undefined && last[0]?.row !== undefined && last[0].row === field.row) {
      last.push(field)
    } else {
      rows.push([field])
    }
  }

  return rows
    .filter((fields) => fields[0]?.row !== undefined)
    .map((fields) => ({
      fields,
      columns: fields.reduce((so, one) => so + (one.type === 'place' ? 2 : 1), 0),
    }))
}

describe('a form laid out in groups', () => {
  /* Owner, 28.09.2026: „organizuj je bolje, možda ponovo jedno ispod drugog". He
     was offered four ways and took the one that keeps the thirds of 12.08.2026
     (`PDL.md`: „Podeli je racionalno na trećine horizontalno") and names the
     parts instead of undoing them.

     What is held here is the JOIN, and it is held for EVERY field rather than
     for a few. A case that says the group „Ko ste" exists, and another that says
     „Broj ličnog dokumenta" is drawn, both pass while the document number sits
     under „Ko ste": between them nothing asks WHICH group a field is in. So the
     pairs are read out of the definition and every one of them is looked for on
     screen, and moving a single field from one group to another fails here. */
  it('draws every field inside the group its own definition names', async () => {
    const user = setupUser()

    renderForm()

    const asked = registracija.fields
    const onlyAChildIsAsked = asked.filter((one) => one.showWhenYoungerThan !== undefined)

    expect(asked.length, 'the registration form asks for nothing').toBeGreaterThan(0)
    expect(onlyAChildIsAsked.length, 'no field of the form waits on a date of birth').toBeGreaterThan(0)

    /* Twice, because a field can be in its group in one state of the form and
       nowhere in the other. First as the form opens, when the two a guardian
       answers are not drawn at all. */
    for (const field of asked.filter((one) => one.showWhenYoungerThan === undefined)) {
      const named = must(field.groupKey, `${field.name} is asked for and names no group`)

      expect(
        within(screen.getByRole('group', { name: words(named) }))
          .queryAllByLabelText(labelFound(field.labelKey)).length,
        `${field.name} is not drawn inside „${words(named)}"`,
      ).toBeGreaterThan(0)
    }

    for (const field of onlyAChildIsAsked) {
      expect(
        screen.queryAllByLabelText(labelFound(field.labelKey)).length,
        `${field.name} is drawn before anybody said how old the competitor is`,
      ).toBe(0)
    }

    /* And then with a date that makes the competitor a child, when all nineteen
       are drawn. The guardian's two are the ones a reordering is likeliest to
       lose, because they are the only two that are not there to be seen. */
    await user.type(screen.getByLabelText(/Datum rođenja/), '01012015')

    for (const field of asked) {
      const named = must(field.groupKey, `${field.name} is asked for and names no group`)

      expect(
        within(screen.getByRole('group', { name: words(named) }))
          .queryAllByLabelText(labelFound(field.labelKey)).length,
        `${field.name} is not drawn inside „${words(named)}" once a guardian is asked for`,
      ).toBeGreaterThan(0)
    }
  })

  it('keeps the rows of the definition inside those groups, and counts their columns', async () => {
    /* The thirds are not undone by the groups; they are only freed from having to
       be filled to three ACROSS a boundary. That is the whole of what the owner
       bought: before this, the three fields no other row claimed had to share one,
       and the number of an identity document stood beside the size of a shirt.

       Named by the field a row begins with rather than by its position, because a
       guard that reads „the fifth row" goes on passing after a reordering and
       measures something else. */
    const user = setupUser()

    renderForm()
    await user.type(screen.getByLabelText(/Datum rođenja/), '01012015')

    const wanted = rowsTheDefinitionAsksFor()

    expect(wanted.length, 'the definition puts no field on a row').toBeGreaterThan(0)
    expect(document.querySelectorAll('.form__row')).toHaveLength(wanted.length)

    for (const { fields, columns } of wanted) {
      const first = must(fields[0], 'a row of the definition holds no field')
      const drawn = must(
        screen.getByLabelText(labelFound(first.labelKey)).closest<HTMLElement>('.form__row'),
        `the row ${first.name} stands in`,
      )

      expect(drawn).toHaveStyle({ '--columns': String(columns) })

      const inRow = [...drawn.querySelectorAll<HTMLElement>('.field')]

      /* Nothing else on it: a row that GAINED a field passes every line that only
         asks that what belongs is there. */
      expect(
        inRow.length,
        `the row ${first.name} stands in carries something the definition does not put there`,
      ).toBe(fields.length)

      /* And in the order the definition gives them, held on the boxes rather than
         on the labels, because the label of a field carries the letter of its
         explanation as well. Owner, 11.08.2026, about the one row where the order
         was his: „ide sa leve strane polje za upload... a onda boks za svojim
         rečima". Two fields swapped inside one row keep the count and the columns,
         so without this nothing would say a word about it. */
      fields.forEach((field, at) => {
        expect(
          within(must(inRow[at], `the field at ${at} of the row ${first.name} stands in`))
            .queryAllByLabelText(labelFound(field.labelKey)).length,
          `${field.name} is not the field at ${at} of its row`,
        ).toBeGreaterThan(0)
      })
    }
  })

  it('leaves the fields on no row standing on their own, as every other form does', async () => {
    const user = setupUser()

    renderForm()
    await user.type(screen.getByLabelText(/Datum rođenja/), '01012015')

    for (const field of registracija.fields.filter((one) => one.row === undefined)) {
      expect(
        screen.getByLabelText(labelFound(field.labelKey)).closest('.form__row'),
        `${field.name} is on a row, and the definition puts it on none`,
      ).toBeNull()
    }
  })
})
