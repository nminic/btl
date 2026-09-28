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
 *  Seven from 31.08.2026, **eight since 20.09.2026**, and **seven again since
 *  28.09.2026**, when the biography left the registration and took its rule with it (the
 *  owner had already struck that same sentence off the panel it moved to, on 31.08.2026,
 *  so it has no screen left to stand on). The eighth was the owner asking for the rule
 *  about the length of a password to stand beside the field on the screen a link out of
 *  a message lands on (`pages/account/NewPassword.tsx`). His reason is what separates
 *  that field from the password field of the registration form, which is one of the
 *  fifty four he had deleted and still carries no rule: whoever reads this one arrived
 *  from a message with no rule in front of him, and a password box empties itself on
 *  every refusal, so learning the rule from the server costs him the whole thing typed
 *  again.
 *
 *  It is in this list on the same terms as the others, which is the point: it is
 *  declared as a `hintKey` on the screen that draws it, so the sweep below counts it,
 *  and the day somebody adds an eighth without being asked this fails. A rule that
 *  reached a screen WITHOUT a `hintKey` is the shape three of them outlived the
 *  deletion in, and that is what the second case refuses. */
const KEPT = [
  'newPassword.passwordHint',
  'newResult.linkHint',
  'newResult.photoHint',
  'newResult.raceKindHint',
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

    /* Nine fields and seven rules, because two of them are asked for on two forms:
       the link and the picture stand on both roads a result is reported by, so one
       wording answers for both. The ninth is the password's rule itself, declared on the
       screen that draws it rather than in a definition, which is what makes it visible
       to the sweep above at all.

       ~~Ten and eight.~~ The biography's rule went on 28.09.2026 with the field it stood
       beside, which is one field and one rule fewer. */
    expect(carried).toHaveLength(9)
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
  it('lets a refused press put the cursor on the group itself', async () => {
    /* ~~Lets the summary of errors put the cursor inside the group.~~ The summary went
       on 28.09.2026 and the cursor took its job over (`forms/FormRenderer.tsx`,
       `owed`), so the group is now focused outright rather than linked to. What it
       needed then it needs now: a group is not focusable of itself, so without
       `tabIndex={-1}` the cursor would stay where the press left it.

       MEASURED AS A PRESS AND NOT AS A CALL TO `focus()`. Calling it by hand says only
       that the attribute is there, and would go on passing the day nothing calls it -
       which is the state this whole branch was written to get out of. The three fields
       above the sex are answered first, so the group is the FIRST thing wrong on the
       form and a cursor that merely went to the top would fail. */
    const user = setupUser()
    renderForm()

    const group = screen.getByRole('radiogroup', { name: 'Pol' })

    expect(group).toHaveAttribute('tabindex', '-1')

    await user.type(screen.getByLabelText(/^Ime$/), 'Vladan')
    await user.type(screen.getByLabelText(/^Prezime$/), 'Đurišić')
    await user.type(screen.getByLabelText(/^Ime oca$/), 'Milan')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(group, 'the cursor stopped short of the group').toHaveFocus()
    /* And it arrives on the group rather than on one of its buttons, which is the
       difference the mark on the group makes: „Muški" is one option out of two and
       says nothing about what was asked. */
    expect(within(group).getAllByRole('radio')[0]).not.toHaveFocus()
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

  it('refuses to go through with neither taken, and says so on the group itself', async () => {
    /* ~~And the summary above the form names the group and leads to it.~~ The summary
       went on 28.09.2026 („zbirne greske kao u prilogu ne treba da se pojavljuju"),
       and with it the one reason a group needed an address at all: a link has to
       point somewhere, and a group has no single control to point at.

       WHAT THE GROUP STILL OWES IS THE SAME, and is now owed on the group and on its
       buttons rather than above the form: that it is marked wrong, and that what is
       wrong is readable from wherever the cursor lands. Sex and category are the two
       things nothing is chosen for, so they are the likeliest errors on this form. */
    const user = setupUser()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    const sex = screen.getByRole('radiogroup', { name: /^Pol/ })

    expect(screen.getByRole('radiogroup', { name: /^Kategorija/ })).toBeInTheDocument()

    /* The group says what is wrong with it, and says it to whoever is standing on the
       group. Read through the address rather than by looking under it: `aria-describedby`
       is what a screen reader follows, so a message drawn but not named there is a
       message only the eye gets. */
    const at = must(
      sex.getAttribute('aria-describedby'),
      'the group says nothing about what is wrong with it',
    )

    expect(must(document.getElementById(at), 'what the group points at'))
      .toHaveTextContent(words('form.errors.required'))

    /* And every button in it carries the mark the cursor is found by, so a press that
       is refused over this group has somewhere to go (`FormRenderer.tsx`, `owed`). */
    for (const one of within(sex).getAllByRole('radio')) {
      expect(one).toHaveAttribute('aria-invalid', 'true')
    }
  })
})

/**
 * The words a key stands for, out of the dictionary the form is drawn in.
 *
 * Read rather than written out here: seventeen labels copied into this file would
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
function rowsTheDefinitionAsksFor(): { fields: FieldDef[]; columns: number; ofItsOwn: number }[] {
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
      /* Never under what the form itself declares, which is how a row of two
         fields is two THIRDS of the line and not two halves (`types.ts`,
         `FormDef.columns`). The larger of the two, because the number on the
         form is a floor: this reads the renderer's rule rather than repeating
         its outcome. */
      columns: Math.max(
        registracija.columns ?? 0,
        fields.reduce((so, one) => so + (one.type === 'place' ? 2 : 1), 0),
      ),
      /* And what the fields alone would have asked for, which is the only way to
         say whether the floor is ever actually a ceiling. */
      ofItsOwn: fields.reduce((so, one) => so + (one.type === 'place' ? 2 : 1), 0),
    }))
}

/**
 * Which part of the form each field stands in, as the owner settled it on the
 * EVENING of 28.09.2026, having seen the first draft on QA.
 *
 * Written out by hand, and that is the whole point of it. Every other case in
 * this describe reads the grouping OUT of the definition, which is right for
 * asking whether the renderer draws what it is told and useless for asking
 * whether it is told the right thing: carry a field from one group to another in
 * `registracija.form.json` and a derived case changes its question and its answer
 * in the same move and goes on passing. This one does not, because it does not
 * read the definition at all.
 *
 * Its floor is the case below it, which holds this table and the form to the same
 * seventeen names in BOTH directions, so a field added without a place here, or a
 * line here for a field the form no longer asks for, fails on the day it happens
 * rather than the day somebody looks. The portal already does this once, in
 * `pages/publicData.test.tsx`, for the same reason.
 *
 * **`null` is a place too, and it is the one thing this table could not say
 * before today.** Owner: „Sekcija Saglasnosti ne treba da ima naziv, samo ispod
 * Kategorije i veličine majice treba da stoji checkbox koji je tu i sada sa
 * opisom, i na kraju dugme za slanje prijave." A field written here with a name
 * would pass by standing in any group at all; written as `null` it fails the
 * moment anything wraps it, which is the only way to hold a part of a form that
 * is not a part.
 */
const STANDS_IN: Record<string, string | null> = {
  firstName: 'Osnovni podaci',
  lastName: 'Osnovni podaci',
  fatherName: 'Osnovni podaci',
  gender: 'Osnovni podaci',
  birthDate: 'Osnovni podaci',
  idNumber: 'Osnovni podaci',
  email: 'Pristup nalogu',
  password: 'Pristup nalogu',
  passwordRepeat: 'Pristup nalogu',
  address: 'Kontakt i dostava',
  phone: 'Kontakt i dostava',
  city: 'Kontakt i dostava',
  firstSeason2027: 'Takmičenje',
  shirtSize: 'Takmičenje',
  /* ~~`photo: 'Profil'` and `bio: 'Profil'` stood here.~~ Both left on 28.09.2026 and
     the group „Profil" left with them, because a group is the fields that stand in it:
     „Profilna sekcija se sa slikom i svojim rečima izbacuje iz registracione forme - to
     ce clan popunjavati naknadno kad bude odobren" (owner). The picture goes to
     `POST /api/me/photo` and the words to `PUT /api/me`, each from its own panel under
     Settings, and the 360 characters moved with the box to `profil.form.json` rather
     than being copied into code. */
  healthStatement: null,
  parentConsent: null,
  parentRelation: null,
}

/**
 * Which fields share a row, and in what order, as it was settled on 28.09.2026.
 *
 * Written out for the reason `STANDS_IN` is, and found the same way: a mutation
 * that carried the town onto the row above it, and another that split the picture
 * from the words beside it, BOTH PASSED every derived case in this file. They had
 * to. A case that reads the rows out of the definition and then looks for them on
 * screen asks a question the definition answers, so moving a field in the
 * definition moves the question with it.
 *
 * The thirds are the owner's, twice over: „Podeli je racionalno na trećine
 * horizontalno" on 12.08.2026, and again on 28.09.2026 when he was offered one
 * column instead and kept them. So what they are is worth writing down.
 *
 * Its floor is the case below: this table and the fields the definition puts on a
 * row must be the same names, once each, in both directions.
 */
const ROWS_ARE: string[][] = [
  ['firstName', 'lastName', 'fatherName'],
  /* „U drugom redu idu Pol […], polje datum rođenja koje je sa sve date pickerom
     u liniji sa Prezime poljem i na kraju broj ličnog dokumenta." The date in
     the SECOND column is the whole of why the order is this one and not the
     other: under „Prezime". */
  ['gender', 'birthDate', 'idNumber'],
  ['email', 'password', 'passwordRepeat'],
  /* „Prvi red je Adresa […] i telefon (Treća kolona je prazna)", after his own
     correction a minute later: „Moja greška, izvini, adresa ne zauzima duplu
     širinu. PO trećinu". */
  ['address', 'phone'],
  /* „Drugi red su jednake trećine za Mesto i Državu (Treća kolona je prazna)",
     which is ONE field: the town carries the country beside it and the two are
     two columns of the three (`FormRenderer.css`, `.field--place`). */
  ['city'],
  ['firstSeason2027', 'shirtSize'],
  /* ~~A seventh row stood here, the picture beside the words.~~ Both left on
     28.09.2026: „Profilna sekcija se sa slikom i svojim recima izbacuje iz
     registracione forme - to ce clan popunjavati naknadno kad bude odobren"
     (owner). The member writes about himself on `member/ProfileBio.tsx` instead. */
  /* A seventh row again from 28.09.2026, and a different pair: the two fields the
     form asks for only where the competitor is under sixteen. Owner, that day:
     „Ukoliko se pojavi potreba za punoletnim licem na dnu forme kako je sad: Oba
     polja nose po trećinu u jednom redu (treća kolona prazna)". Two names for three
     columns, which is what `columns: 3` on the form already means: the row is as
     wide as the form declares, not as wide as the fields on it
     (`FormRenderer.tsx`, `columnsOf`).

     This row is drawn only part of the time, which no other row here is, so the
     case below types a date of birth in 2015 before it counts. */
  ['parentConsent', 'parentRelation'],
]

/**
 * Which group comes before which, as it was settled on 28.09.2026.
 *
 * Written out for the reason `STANDS_IN` and `ROWS_ARE` are, and found the same
 * way: a mutation that carried the three fields of `Saglasnosti` to the front of
 * `registracija.form.json`, and another that carried `Za evidenciju članova` to
 * its end, BOTH PASSED every case above this one. They had to: `STANDS_IN` asks
 * which group a field stands in and `ROWS_ARE` asks which fields share a row, and
 * a group that moves whole keeps every field's answer to both of those questions
 * the same. Neither one reads, and neither one could read, which group comes
 * first.
 *
 * The order is the owner's choice among three offered outcomes, and the names
 * are not his (`PDL.md`, „Registraciona forma ide u imenovane grupe, ne u niz
 * redova": „Sedam grupa, redom kojim ih forma crta").
 *
 * Its floor is the case below: this table and the groups `STANDS_IN` sorts
 * fields into must be the same names, once each, in both directions.
 */
const GROUPS_ARE: string[] = [
  'Osnovni podaci',
  'Pristup nalogu',
  'Kontakt i dostava',
  'Takmičenje',
]

describe('a form laid out in groups', () => {
  it('puts every field that stands on a row into the table of rows, once', () => {
    /* The floor under `ROWS_ARE`. Both directions, and once each: a field on a row
       with no place in the table fails, a name here for a field that is on no row
       fails, and a name written twice fails. */
    const written = ROWS_ARE.flat()
    const onARow = registracija.fields
      .filter((one) => one.row !== undefined)
      .map((one) => one.name)

    expect(written.length, 'a field is written into the table of rows twice').toBe(
      new Set(written).size,
    )
    expect(written.toSorted()).toEqual(onARow.toSorted())
  })

  it('draws the rows that were settled on, holding what they hold in the order they hold it', async () => {
    const user = setupUser()

    renderForm()
    await user.type(screen.getByLabelText(/Datum rođenja/), '01012015')

    const drawn = [...document.querySelectorAll<HTMLElement>('.form__row')]

    expect(drawn.length, 'the form draws a different number of rows than were settled on').toBe(
      ROWS_ARE.length,
    )

    ROWS_ARE.forEach((names, at) => {
      const row = must(drawn[at], `the row at ${at}`)
      const boxes = [...row.querySelectorAll<HTMLElement>('.field')]

      expect(boxes.length, `the row at ${at} holds a different number of fields`).toBe(names.length)

      names.forEach((name, place) => {
        const field = must(
          registracija.fields.find((one) => one.name === name),
          `the form no longer asks for ${name}`,
        )

        expect(
          within(must(boxes[place], `the field at ${place} of the row at ${at}`))
            .queryAllByLabelText(labelFound(field.labelKey)).length,
          `${name} is not the field at ${place} of the row at ${at}`,
        ).toBeGreaterThan(0)
      })
    })
  })

  it('names the same seventeen fields the form asks for, and no others', () => {
    /* The floor under the table above. Held in both directions: a field added to
       the form without a place in the table fails here, and so does a line left
       behind for a field that is gone. */
    expect(Object.keys(STANDS_IN).toSorted()).toEqual(
      registracija.fields.map((one) => one.name).toSorted(),
    )
  })

  it('stands each field in the part of the form it was given, and not in another', async () => {
    /* The one case that would notice a field carried from one group to another in
       the definition. Owner, 28.09.2026: „Koristi redosled po svom misljenju i
       organizuj je bolje," choosing, between three offered outcomes, groups over
       one column. The seven names, and where each field sits inside them, are
       not his: they were not reported to him before they were written (`PDL.md`,
       „Registraciona forma ide u imenovane grupe, ne u niz redova", corrected
       28.09.2026 after a PR 420 review found the first draft of this very
       sentence claimed otherwise).

       Also the only case that pins the words of a legend, since it looks the
       group up by the name a person reads. */
    const user = setupUser()

    renderForm()
    await user.type(screen.getByLabelText(/Datum rođenja/), '01012015')

    for (const [name, stands] of Object.entries(STANDS_IN)) {
      const field = must(
        registracija.fields.find((one) => one.name === name),
        `the form no longer asks for ${name}`,
      )

      if (stands === null) {
        /* The tail, which is a part of the form that is not a part of it. Asked
           of the element and not of the role, for the reason the case below
           gives: `group` is a role the country list carries too, so „inside no
           group" read through the role would be answered by a field that sits
           inside the renderer's own fieldset and merely outside an `optgroup`.
           What must not be over it is `.form__group`, which is the wrapper the
           renderer draws and the only thing that puts a name over anything. */
        expect(
          screen.getByLabelText(labelFound(field.labelKey)).closest('.form__group'),
          `${name} is drawn inside a group, and the owner asked for it to stand under none`,
        ).toBeNull()

        continue
      }

      expect(
        within(screen.getByRole('group', { name: stands }))
          .queryAllByLabelText(labelFound(field.labelKey)).length,
        `${name} does not stand in „${stands}"`,
      ).toBeGreaterThan(0)
    }
  })

  it('names the same five groups STANDS_IN sorts fields into, once each', () => {
    /* The floor under `GROUPS_ARE`, the same shape as the floor under `STANDS_IN`
       two cases above and under `ROWS_ARE` at the top of this describe: held in
       both directions, so a group that reaches `STANDS_IN` without a line here,
       or a line here for a group nothing stands in any longer, fails on the day
       it happens rather than the day somebody looks. */
    /* The names, and not the absence of one: a field that stands under no group
       has no line to be owed here, and `null` swept in among them would ask this
       table to carry a group that is not drawn. What holds THOSE fields is the
       case above, which looks for the wrapper over each one and demands there be
       none. */
    const named = [...new Set(Object.values(STANDS_IN).filter((one) => one !== null))]

    expect(named.length, 'no field of the form stands in a named group').toBeGreaterThan(0)
    expect(
      Object.values(STANDS_IN).filter((one) => one === null).length,
      'no field of the form stands outside every group, and the owner asked for a tail that does',
    ).toBeGreaterThan(0)
    expect(GROUPS_ARE.length, 'a group is written into the table of groups twice').toBe(
      new Set(GROUPS_ARE).size,
    )
    expect(GROUPS_ARE.toSorted()).toEqual(named.toSorted())
  })

  it('draws the groups in the order that was settled on', () => {
    /* Asked of the element and not of the role, for the same reason `draws no
       group at all on a form whose fields name none` below asks it that way:
       `group` is a role the portal uses elsewhere for its own reasons, and on
       THIS form the country list beside „Mesto" is one more owner of it,
       through the native role `<optgroup>` carries (`CountryOptions.tsx`).
       Measured directly: `screen.getAllByRole('group')` here finds nine
       elements where the renderer draws seven groups, because the list's two
       `<optgroup>`s sit nested inside the fieldset „Kontakt i adresa" and no
       role tells the two kinds apart. What must be counted is the renderer's
       own wrapper, which is a `fieldset` standing directly in the form. */
    renderForm()

    const form = must(document.querySelector('form'), 'the form')
    const groups = [...form.querySelectorAll<HTMLElement>(':scope > fieldset')]

    expect(groups.length, 'the form draws a different number of groups than were settled on').toBe(
      GROUPS_ARE.length,
    )

    GROUPS_ARE.forEach((name, at) => {
      expect(must(groups[at], `the group at ${at}`)).toHaveAccessibleName(name)
    })
  })

  /* Owner, 28.09.2026: „organizuj je bolje, možda ponovo jedno ispod drugog",
     choosing, between three offered outcomes, the one that keeps the thirds of
     12.08.2026 (`PDL.md`: „Podeli je racionalno na trećine horizontalno") and
     names the parts instead of undoing them.

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
      if (field.groupKey === undefined) {
        expect(
          screen.getByLabelText(labelFound(field.labelKey)).closest('.form__group'),
          `${field.name} names no group and is drawn inside one`,
        ).toBeNull()

        continue
      }

      expect(
        within(screen.getByRole('group', { name: words(field.groupKey) }))
          .queryAllByLabelText(labelFound(field.labelKey)).length,
        `${field.name} is not drawn inside „${words(field.groupKey)}"`,
      ).toBeGreaterThan(0)
    }

    for (const field of onlyAChildIsAsked) {
      expect(
        screen.queryAllByLabelText(labelFound(field.labelKey)).length,
        `${field.name} is drawn before anybody said how old the competitor is`,
      ).toBe(0)
    }

    /* And then with a date that makes the competitor a child, when all seventeen
       are drawn. The guardian's two are the ones a reordering is likeliest to
       lose, because they are the only two that are not there to be seen. */
    await user.type(screen.getByLabelText(/Datum rođenja/), '01012015')

    for (const field of asked) {
      if (field.groupKey === undefined) {
        expect(
          screen.getByLabelText(labelFound(field.labelKey)).closest('.form__group'),
          `${field.name} names no group and is drawn inside one once a guardian is asked for`,
        ).toBeNull()

        continue
      }

      expect(
        within(screen.getByRole('group', { name: words(field.groupKey) }))
          .queryAllByLabelText(labelFound(field.labelKey)).length,
        `${field.name} is not drawn inside „${words(field.groupKey)}" once a guardian is asked for`,
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

    for (const { fields, columns, ofItsOwn } of wanted) {
      const first = must(fields[0], 'a row of the definition holds no field')

      /* **The floor under `FormDef.columns` being a FLOOR.** A number declared on
         the form widens a row that would have been narrower; it must never be
         asked to narrow one, because a row with more fields than columns does
         not lose them, it drops them onto a second line where nothing on this
         form would say a word about it. Measured here rather than promised in a
         comment on the type. */
      expect(
        ofItsOwn,
        `the row ${first.name} stands in holds more than the ${String(registracija.columns)} columns the form declares`,
      ).toBeLessThanOrEqual(columns)
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

  it('draws no group at all on a form whose fields name none', () => {
    /* Groups are drawn into the renderer that draws twelve forms, and eleven of
       them asked for nothing. What holds them where they were is that a field
       naming no group takes the path it took before groups existed, and this is
       what says so: measured the day it was written, eleven of the twelve are
       byte for byte what origin/main draws.

       Over the registry rather than over a list written here, so a thirteenth
       form is covered on the day it is added and not on the day somebody
       remembers this file. */
    const untouched = ALL_FORMS.filter((form) =>
      form.fields.every((one) => one.groupKey === undefined),
    )

    expect(untouched.length, 'every form the portal has names a group').toBeGreaterThan(0)

    for (const form of untouched) {
      const { container } = render(
        <ClockProvider simulatedDay={null}>
          <I18nProvider locale="sr">
            <FormRenderer form={form} onSubmit={() => {}} />
          </I18nProvider>
        </ClockProvider>,
      )

      /* Asked of the element and not of the role, which is the one place on this
         form where a role query says less rather than more: `group` is a role the
         portal uses elsewhere for its own reasons, and `admin-clan` draws two of
         them before this change exists (`components/CropChooser`,
         `components/GenderTabs` and the box that holds a country). What must not
         appear is the renderer's own wrapper, which is a `fieldset` standing
         directly in the form, and no role tells those apart. */
      expect(
        must(container.querySelector('form'), `${form.id} drew no form`)
          .querySelectorAll(':scope > fieldset').length,
        `${form.id} is wrapped in a fieldset and its definition names no group`,
      ).toBe(0)
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

  /**
   * EVERY ROW OF THIS FORM IS THREE COLUMNS, WHATEVER STANDS ON IT.
   *
   * Owner, 12.08.2026: „Podeli je racionalno na trećine horizontalno", and on
   * 28.09.2026 three times over about the rows that do not fill them: „Treća
   * kolona je prazna", „(Treća kolona je prazna)", „treća trećina je prazna".
   *
   * Asked of EVERY row rather than of the three he named, and that is the whole
   * difference between this case and a list of three: „Adresa, Telefon" being
   * three columns wide is not a fact about that row, it is the same fact as
   * „Mesto" being three columns wide, and a case that names three rows goes on
   * passing the day a fourth is added narrow.
   *
   * The number is read off the form rather than written here, so there is one
   * place to move it; that it is THREE and not something else is the line below,
   * which is the only thing in this file that says so out loud.
   */
  it('draws every row of the registration in thirds, filled or not', async () => {
    const user = setupUser()

    renderForm()
    await user.type(screen.getByLabelText(/Datum rođenja/), '01012015')

    expect(registracija.columns, 'the registration form no longer asks for thirds').toBe(3)

    const drawn = [...document.querySelectorAll<HTMLElement>('.form__row')]

    expect(drawn.length, 'the registration draws no rows at all').toBeGreaterThan(0)

    /* And at least one row that does NOT fill them, or this case is satisfied by
       a form on which every row happens to hold three fields and says nothing
       about the empty third at all. Three such rows today; one is the floor. */
    const short = rowsTheDefinitionAsksFor().filter(({ ofItsOwn }) => ofItsOwn < 3)

    expect(
      short.length,
      'no row of the registration leaves a column empty, so this case cannot see one',
    ).toBeGreaterThan(0)

    for (const row of drawn) {
      expect(row, 'a row of the registration is not drawn in thirds').toHaveStyle({
        '--columns': '3',
      })
    }
  })

  /**
   * THE TAIL: no name over it, the confirmation in it, and the button last.
   *
   * Owner, 28.09.2026: „Sekcija Saglasnosti ne treba da ima naziv, samo ispod
   * Kategorije i veličine majice treba da stoji checkbox koji je tu i sada sa
   * opisom, i na kraju dugme za slanje prijave."
   *
   * Three things and three assertions, because they fail apart: a tail drawn
   * inside a nameless wrapper, a tail drawn before the groups, and a button
   * drawn above what it sends are three different mistakes and the first two
   * both pass a case that only looks for the confirmation.
   */
  it('ends in a tail nothing is written over, after the last group and before the button', () => {
    renderForm()

    const form = must(document.querySelector('form'), 'the form')
    const confirmation = screen.getByLabelText(labelFound('registration.healthStatement'))

    /* Nothing over it. Not „the legend says nothing", which a legend drawn empty
       would satisfy: no wrapper at all. */
    expect(
      confirmation.closest('.form__group'),
      'the confirmation is wrapped in a group, and the owner asked for no name over it',
    ).toBeNull()

    /* And after the last of them. `compareDocumentPosition` alone would answer
       „following" for a node the group CONTAINS, so containment is refused
       first: `DOCUMENT_POSITION_CONTAINED_BY` always carries `FOLLOWING` with
       it, and without this the confirmation would satisfy „after the last
       group" by being inside it. */
    const groups = [...form.querySelectorAll<HTMLElement>(':scope > fieldset')]
    const last = must(groups.at(-1), 'the form draws no group')

    expect(last.contains(confirmation), 'the confirmation stands inside the last group').toBe(false)
    expect(
      Boolean(last.compareDocumentPosition(confirmation) & Node.DOCUMENT_POSITION_FOLLOWING),
      'the confirmation is drawn before the last group rather than after it',
    ).toBe(true)

    /* And the button after the confirmation, which is the last of his sentence.
       Same refusal of containment, for the same reason. */
    const sending = screen.getByRole('button', { name: words('registration.submit') })

    expect(sending.contains(confirmation), 'the confirmation stands inside the button').toBe(false)
    expect(
      Boolean(confirmation.compareDocumentPosition(sending) & Node.DOCUMENT_POSITION_FOLLOWING),
      'the button that sends the form is drawn above what it sends',
    ).toBe(true)
  })
})
