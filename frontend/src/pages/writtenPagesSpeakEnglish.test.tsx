import { act, cleanup, screen, within } from '@testing-library/react'
import { clearResourceCache } from '../data/client'
import type { StaticPage } from '../data/types'
import { renderAt } from '../test/render'
import { serverThat, type Asked } from '../test/serverAnswers'

/**
 * THE WRITTEN PAGES IN THE LANGUAGE OF THE ADDRESS, WHICH THE PORTAL DID NOT ASK FOR UNTIL
 * 28.09.2026.
 *
 * <p><b>What was measured before a line of this branch was written.</b> On
 * `/en/uslovi-koriscenja` the portal asked for `/api/pages` with no parameter at all, drew
 * „Uslovi korišćenja" - the Serbian terms of use - and `document.documentElement.lang` said
 * `en` over every word of it. `GET /api/pages?lang=en` had answered „Terms of use" since V43.
 * Switching the language on a mounted written page made NO new request and left the Serbian
 * text where it was, because the two caches in `data/client.ts` were keyed by the resource's
 * NAME and two languages are one name.
 *
 * <p><b>Every case here answers the two languages DIFFERENTLY, and asserts both.</b> That is
 * the whole reason this file builds its own server instead of leaning on the harness: the
 * generated `test/mock/pages.json` is the Serbian answer and there is no English one, so a
 * case that only asked „is the text Serbian on /en" would pass over a portal that sends the
 * right parameter and over one that sends none, and could not tell which it was looking at.
 * With both languages answered and both asserted, sending one language's tag where the other
 * belongs fails on one side or the other.
 *
 * <p><b>What is deliberately NOT here: a sentence telling the reader his page was not
 * translated.</b> That is the owner's own decision among outcomes he was priced (ADL,
 * 18.09.2026): „Kad prevoda nema, vraca se na srpski, BEZ napomene. Citalac uvek dobije tekst
 * i portal nema rupu", with the cost he accepted written beside it - „dobije ga na jeziku koji
 * nije trazio i to mu niko ne kaze". So the fallback is measured as text and as a `lang`
 * attribute, which nobody reads and no screen reader mispronounces, and never as prose.
 */

/** One case's worth of server, kept here so `stop` cannot be forgotten. */
let stop: (() => void) | null = null

afterEach(() => {
  stop?.()
  stop = null
  /* The two caches are module scope and outlive a case, so a case that left one full would
     decide what the next one measures - and what these cases measure IS the cache. */
  clearResourceCache()
})

/**
 * A server that answers each language with its own words, and records what was asked.
 *
 * @param byLanguage the pages to answer with, by the tag in the address. A tag this map has
 *                   no entry for is answered 404, which is what makes „the portal asked for a
 *                   language nobody serves" a visible failure rather than a silent fallback.
 */
function aServerAnswering(byLanguage: Record<string, StaticPage[]>): Asked[] {
  const it = serverThat((path) => {
    if (!path.startsWith('/api/pages')) {
      return null
    }

    /* `String` rather than a check for absence, and that is not laziness: a branch for „the
       portal sent no language" is a branch no case here can take, because every one of them
       renders a screen that sends one. `String(null)` is a key this map never holds, so the
       address with no parameter is answered 404 - which is how a portal that stopped sending
       the language would fail here - and there is no unreachable branch to account for. */
    const pages = byLanguage[String(new URL(path, 'https://portal.test').searchParams.get('lang'))]

    return pages === undefined
      ? new Response('not found', { status: 404 })
      : new Response(JSON.stringify(pages), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
  })

  stop = it.stop

  return it.asked
}

/** Every address this visit spent on the written pages, in order. */
const askedForPages = (asked: Asked[]) =>
  asked.filter((one) => one.path.startsWith('/api/pages')).map((one) => one.path)

/* THE TERMS OF USE IN BOTH LANGUAGES, whole in each.
 *
 * Two sections and not one, so „the screen draws the translated title" cannot pass for „the
 * screen draws the translated text": the title and the body are two facts and the server's
 * own rule joins them (`PageApi.pagesIn`, whole or nothing). The governing-version sentence is
 * on the English one and on neither Serbian one, which is where the owner put it (PDL,
 * 27.09.2026, „Odredbu o merodavnosti nose SAMO engleske strane"). */
const TERMS_IN_SERBIAN: StaticPage = {
  slug: 'uslovi-koriscenja',
  title: 'Uslovi korišćenja',
  language: 'sr',
  sections: [
    { heading: '1. Ko smo', body: 'Ligu vodi Sportsko udruženje BTL.' },
    { heading: '2. Članarina', body: 'Članarina se plaća za sezonu.' },
  ],
}

const TERMS_IN_ENGLISH: StaticPage = {
  slug: 'uslovi-koriscenja',
  title: 'Terms of use',
  language: 'en',
  sections: [
    { heading: '1. Who we are', body: 'The league is run by the BTL sports association.' },
    { heading: '2. The fee', body: 'The Serbian version of these terms is the binding one.' },
  ],
}

/* AND THE PRIVACY POLICY BESIDE IT, so neither page is the only record of its kind in the
 * answer: with one page in the list, „the screen drew the page it was asked for" is satisfied
 * by a screen that draws whatever came first. */
const POLICY_IN_SERBIAN: StaticPage = {
  slug: 'politika-privatnosti',
  title: 'Politika privatnosti',
  language: 'sr',
  sections: [{ heading: '1. Rukovalac', body: 'Podacima rukuje udruženje.' }],
}

const POLICY_IN_ENGLISH: StaticPage = {
  slug: 'politika-privatnosti',
  title: 'Privacy policy',
  language: 'en',
  sections: [{ heading: '1. The controller', body: 'The association holds your data.' }],
}

const BOTH_LANGUAGES = {
  sr: [POLICY_IN_SERBIAN, TERMS_IN_SERBIAN],
  en: [POLICY_IN_ENGLISH, TERMS_IN_ENGLISH],
}

describe('a written page on an English address', () => {
  it('is asked for in the language of the address, and answered in it', async () => {
    const asked = aServerAnswering(BOTH_LANGUAGES)

    renderAt('/en/uslovi-koriscenja')

    expect(await screen.findByRole('heading', { level: 1, name: 'Terms of use' })).toBeVisible()

    /* THE JOIN, AND IT IS THE POINT OF THIS CASE: which language of the address goes into
       which parameter of the request. Asserted as the whole address, so a request that
       carried the other language, or carried none, is a different string. */
    expect(askedForPages(asked)).toEqual(['/api/pages?lang=en'])

    /* And the body, not only the title: the server translates a page whole and the screen has
       to draw the whole of what came. */
    expect(screen.getByText('The league is run by the BTL sports association.')).toBeVisible()
    expect(
      screen.getByText('The Serbian version of these terms is the binding one.'),
    ).toBeVisible()
    expect(screen.queryByText('Ligu vodi Sportsko udruženje BTL.')).not.toBeInTheDocument()
  })

  it('is asked for in Serbian on a Serbian address, which is the other half of the same join', async () => {
    const asked = aServerAnswering(BOTH_LANGUAGES)

    renderAt('/sr/uslovi-koriscenja')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Uslovi korišćenja' }),
    ).toBeVisible()
    expect(askedForPages(asked)).toEqual(['/api/pages?lang=sr'])
    expect(screen.getByText('Ligu vodi Sportsko udruženje BTL.')).toBeVisible()
    expect(screen.queryByText('Terms of use')).not.toBeInTheDocument()
  })

  it('marks the words with the language they are really in, which is the page’s own', async () => {
    aServerAnswering(BOTH_LANGUAGES)

    renderAt('/en/uslovi-koriscenja')

    const heading = await screen.findByRole('heading', { level: 1, name: 'Terms of use' })
    const article = heading.closest('article')

    expect(article).toHaveAttribute('lang', 'en')
    /* The document says the language of the DICTIONARY, which is the right answer for the
       header and the navigation around this page (`app/useRouteChrome.ts`). The article says
       the language of the RECORD. The two agree here and the next case is the one where they
       must not. */
    expect(document.documentElement).toHaveAttribute('lang', 'en')
  })
})

describe('a written page that has no translation yet', () => {
  /* Today there is no such page - V43 translated all four whole - so this state is made here
     rather than found, which is what the axis asks for. It is the state every page was in
     before V43 and the state the fifth written page will arrive in. */
  const NOT_TRANSLATED = {
    sr: [POLICY_IN_SERBIAN, TERMS_IN_SERBIAN],
    /* WHAT THE ROUTE REALLY ANSWERS: the Serbian words, and `language` saying so, per page.
       The policy beside it IS translated, so this same answer holds both states at once and a
       screen that read the language off the list rather than off the page would draw one of
       them wrong. */
    en: [POLICY_IN_ENGLISH, { ...TERMS_IN_SERBIAN, language: 'sr' }],
  }

  it('gives the reader the Serbian text, with no sentence about it', async () => {
    aServerAnswering(NOT_TRANSLATED)

    renderAt('/en/uslovi-koriscenja')

    const heading = await screen.findByRole('heading', { level: 1, name: 'Uslovi korišćenja' })

    /* THE OWNER'S ACCEPTED COST, HELD AS A CASE SO NOBODY ADDS THE SENTENCE BACK AS A
       KINDNESS. Written as the WHOLE of what the page says rather than as a search for words
       an apology might use: a pattern over prose has to be right in advance about a sentence
       nobody has written, and this portal has measured that shape failing six rounds running
       (`pages/writtenVerification.test.ts` says so at length). The record's own words, in
       order, and not one character more - so a notice added anywhere inside this article
       fails here whatever it says and whatever role it carries. */
    expect(heading.closest('article')?.textContent).toBe(
      'Uslovi korišćenja1. Ko smoLigu vodi Sportsko udruženje BTL.2. ČlanarinaČlanarina se plaća za sezonu.',
    )

    /* And nothing was raised beside it either. `alert` is what this portal puts a failure in
       (`components/Resource.tsx`), so a fallback reported as a failure would show up here. */
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says the words are Serbian while the page around them stays English', async () => {
    aServerAnswering(NOT_TRANSLATED)

    renderAt('/en/uslovi-koriscenja')

    const heading = await screen.findByRole('heading', { level: 1, name: 'Uslovi korišćenja' })

    /* THE TWO MUST DISAGREE HERE, and that is the whole of WCAG 2.2 AA 3.1.2: the chrome is
       English and these words are not, so a screen reader has to be told where one stops. An
       article marked `en` over this text is what `i18n/config.ts` calls unintelligible. */
    expect(heading.closest('article')).toHaveAttribute('lang', 'sr')
    expect(document.documentElement).toHaveAttribute('lang', 'en')
  })

  it('does not decide for its neighbour, which came back translated in the same answer', async () => {
    aServerAnswering(NOT_TRANSLATED)

    renderAt('/en/politika-privatnosti')

    const heading = await screen.findByRole('heading', { level: 1, name: 'Privacy policy' })

    expect(heading.closest('article')).toHaveAttribute('lang', 'en')
    expect(screen.getByText('The association holds your data.')).toBeVisible()
  })
})

describe('switching the language of a page that is already on screen', () => {
  it('asks again and redraws, rather than keeping what the other language fetched', async () => {
    const asked = aServerAnswering(BOTH_LANGUAGES)

    const { router } = renderAt('/sr/uslovi-koriscenja')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Uslovi korišćenja' }),
    ).toBeVisible()

    await act(async () => {
      await router.navigate('/en/uslovi-koriscenja')
    })

    /* THE CASE THE MEASUREMENT BEFORE THIS BRANCH FAILED. `LocaleLayout` stays mounted across
       a language switch - the route matched is the same one, only its `:locale` moved - so
       nothing remounts and nothing unmounts. Keyed by name, this screen kept the Serbian text
       it already had and made no second request. */
    expect(await screen.findByRole('heading', { level: 1, name: 'Terms of use' })).toBeVisible()
    expect(askedForPages(asked)).toEqual(['/api/pages?lang=sr', '/api/pages?lang=en'])
  })

  it('and back again, from what this visit already holds rather than from a third request', async () => {
    const asked = aServerAnswering(BOTH_LANGUAGES)

    const { router } = renderAt('/sr/uslovi-koriscenja')
    await screen.findByRole('heading', { level: 1, name: 'Uslovi korišćenja' })

    await act(async () => {
      await router.navigate('/en/uslovi-koriscenja')
    })
    await screen.findByRole('heading', { level: 1, name: 'Terms of use' })

    await act(async () => {
      await router.navigate('/sr/uslovi-koriscenja')
    })

    /* Two entries, not one that keeps being overwritten: the Serbian answer is still held
       under its own address, so going back is a render and not a request. „One request per
       resource per visit" (`data/client.ts`) becomes one request per resource per language,
       which is what two addresses mean. */
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Uslovi korišćenja' }),
    ).toBeVisible()
    expect(askedForPages(asked)).toEqual(['/api/pages?lang=sr', '/api/pages?lang=en'])
  })

  it('opens the English page a second time with the English words already there', async () => {
    const asked = aServerAnswering(BOTH_LANGUAGES)

    renderAt('/en/uslovi-koriscenja')
    await screen.findByRole('heading', { level: 1, name: 'Terms of use' })

    /* Taken down and opened again rather than navigated away from, which is the shape
       `app/newScreen.test.tsx` measures this with and the reason it gives: what must be true
       is that the screen is its full height in the very FIRST render, because the router puts
       a scroll position back the instant it commits and a loading box has nowhere to put one.
       That read happens while the component renders, so it goes through the value this visit
       already holds - which is held under the address, language and all. */
    cleanup()

    renderAt('/en/uslovi-koriscenja')

    /* `getBy` and no `await`, which IS the assertion: waiting is what must not be needed. */
    expect(screen.queryByText('Loading')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Terms of use' })).toBeVisible()

    /* ONCE FOR THE WHOLE VISIT, and the second mount asks nothing at all - measured rather
       than expected: the first expectation written here was two, and it was wrong. The effect
       does call `loadResource` on the second mount, deliberately (there is a case for that in
       `data/useResource.test.tsx`), and what it gets back is the promise this visit is already
       holding under this address. So „one request per resource per visit" survives the
       language going into the address; it becomes one per language. */
    expect(askedForPages(asked)).toEqual(['/api/pages?lang=en'])
  })

  it('reports a language the server cannot answer, instead of showing the one it can', async () => {
    /* THE MUTATION THIS CASE IS: one shared entry. With the Serbian answer stored under the
       resource's name, the English request either was never made or was handed the Serbian
       rows, and either way this screen looked like it had worked. A 404 on one language has
       to reach the reader as a failure of THAT language. */
    const asked = aServerAnswering({ sr: [POLICY_IN_SERBIAN, TERMS_IN_SERBIAN] })

    const { router } = renderAt('/sr/uslovi-koriscenja')
    await screen.findByRole('heading', { level: 1, name: 'Uslovi korišćenja' })

    await act(async () => {
      await router.navigate('/en/uslovi-koriscenja')
    })

    expect(await screen.findByRole('alert')).toBeVisible()
    expect(screen.queryByRole('heading', { level: 1, name: 'Uslovi korišćenja' })).not.toBeInTheDocument()
    expect(askedForPages(asked)).toEqual(['/api/pages?lang=sr', '/api/pages?lang=en'])
  })
})

describe('the other three screens that read a written record', () => {
  /* Four screens read `usePages` and each draws a record a different way, so each is its own
     reader of the language: the terms above, the rulebook with its contents, the president's
     address inside the front page, and the administration's list. */

  const RULEBOOK_IN_ENGLISH: StaticPage = {
    slug: 'pravilnik',
    title: 'General Rulebook',
    language: 'en',
    sections: [
      { heading: '1. Opening provisions', body: 'This rulebook governs the league.' },
      { heading: '2. Membership', body: 'A member is whoever has been activated.' },
    ],
  }

  const PRESIDENT_IN_ENGLISH: StaticPage = {
    slug: 'rec-predsednika',
    title: "President's word",
    language: 'en',
    sections: [{ heading: "President's word", body: 'Welcome to the league.' }],
  }

  const PRESIDENT_IN_SERBIAN: StaticPage = {
    slug: 'rec-predsednika',
    title: 'Reč predsednika',
    language: 'sr',
    sections: [{ heading: 'Reč predsednika', body: 'Dobro došli u ligu.' }],
  }

  it('draws the rulebook, its contents and its text, in the language of the address', async () => {
    const asked = aServerAnswering({
      sr: [TERMS_IN_SERBIAN],
      en: [RULEBOOK_IN_ENGLISH, TERMS_IN_ENGLISH],
    })

    renderAt('/en/pravilnik')

    const heading = await screen.findByRole('heading', { level: 1, name: 'General Rulebook' })

    expect(heading.closest('article')).toHaveAttribute('lang', 'en')
    expect(screen.getByText('This rulebook governs the league.')).toBeVisible()
    expect(screen.getByText('A member is whoever has been activated.')).toBeVisible()
    expect(askedForPages(asked)).toEqual(['/api/pages?lang=en'])
  })

  it("draws the president's word on the front page in the language of the address", async () => {
    aServerAnswering({
      sr: [PRESIDENT_IN_SERBIAN, TERMS_IN_SERBIAN],
      en: [PRESIDENT_IN_ENGLISH, TERMS_IN_ENGLISH],
    })

    renderAt('/en')

    /* His own word is the one of the four that carries NO governing-version sentence and is
       not a legal text at all (PDL, 28.09.2026: „`rec-predsednika` nije medju njima"), so it
       is here to say the language travels with every written record and not only with the
       three that bind. */
    expect(await screen.findByText('Welcome to the league.')).toBeVisible()
    expect(screen.queryByText('Dobro došli u ligu.')).not.toBeInTheDocument()

    const block = screen.getByText('Welcome to the league.').closest('article')

    expect(block).toHaveAttribute('lang', 'en')
  })

  it("lists the pages in the administration in the reader's language too", async () => {
    aServerAnswering({
      sr: [POLICY_IN_SERBIAN, TERMS_IN_SERBIAN],
      en: [POLICY_IN_ENGLISH, TERMS_IN_ENGLISH],
    })

    renderAt('/en/administracija/strane', 'superadmin')

    const table = await screen.findByRole('table')

    expect(within(table).getByText('Terms of use')).toBeVisible()
    expect(within(table).queryByText('Uslovi korišćenja')).not.toBeInTheDocument()
  })
})
