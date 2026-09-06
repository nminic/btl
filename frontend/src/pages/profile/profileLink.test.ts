import { sep } from 'node:path'
import ts from 'typescript'
import { sources, WHOLE_PORTAL } from '../../test/sources'

/**
 * Only four modules may reach the maker of a profile's address, and only one may write one out.
 *
 * **Why this is a floor and not a preference.** Whether a name may be a link is the same question
 * the profile page asks to decide whether to draw itself at all (`profile/visible.ts`), and it now
 * has two reasons: a member whose fee has run out, and a member hiding from a reader who is not
 * signed in (P23, 06.09.2026). Nine screens draw a competitor and eight of them may link one. Ask
 * that question at each of them and it is eight places to forget it, which is what happened to the
 * first reason: `components/CompetitorName.tsx` was written on 05.09.2026 precisely because „the
 * rule was being kept on two screens out of eight and there was nothing to say which".
 *
 * So the address itself is built in one module, and everything else asks for a link and is handed
 * one or nothing (`profile/useProfileLink.ts`, `profile/ProfileLink.tsx`).
 *
 * **What this floor no longer has to hold, since 07.09.2026.** „Every screen comes through the
 * hook" used to rest here, and it could not: `profileLinkFor` was exported beside the rule, so a
 * screen could import that instead and build the address without ever reading what this visit had
 * said about the member. A review measured exactly that, on a screen rewritten to call it: every
 * gate green, 2645 cases, 100 per cent, and a member who had just hidden themselves drawn as a
 * link. The answer was to stop exporting it rather than to write a longer floor. What cannot be
 * imported needs no guarding.
 *
 * **Asked of the parsed imports rather than of the text**, from the same review. The sweep before
 * this one matched `from '…profileAddress'` with a regular expression, so the same import written
 * with double quotes walked straight past it, and nothing in the gate refuses double quotes:
 * `.oxlintrc.json` has no rule about them and there is no formatter in the gate. The parser reads
 * a module specifier whatever it is quoted with. Precedent in the portal:
 * `pages/league/componentWords.test.ts` reads its source the same way, for the same reason.
 *
 * What is named is the four modules that may reach it, each with the reason it may:
 *
 * - `profile/useProfileLink.ts` is the one place that turns „may this reader reach this profile"
 *   into an address, and it hands the address out without handing out the turning.
 * - `profile/ProfileHead.tsx` builds the tabs **inside** an open profile, which is not a link from
 *   elsewhere: a reader who is on the page has already been let in, and the tabs are the same
 *   address with a part hung off it.
 * - `pages/CompetitorProfile.tsx` and `pages/CompetitorAwards.tsx` are those two pages. They read
 *   the member number out of the address they were opened at and send the reader to the canonical
 *   spelling of it, which they do **after** the rule has said the profile may be seen at all; a
 *   redirect that ran first would answer „is there such a member" for a reader who is not allowed
 *   to ask.
 *
 * Cases are outside this altogether, because `sources()` is the production tree and nothing else:
 * a case that spells an address out is saying what it expects to find on a screen, which is the
 * opposite of a screen deciding one for itself.
 */
const MAY = [
  `profile${sep}useProfileLink.ts`,
  `profile${sep}ProfileHead.tsx`,
  `pages${sep}CompetitorProfile.tsx`,
  `pages${sep}CompetitorAwards.tsx`,
]

/** The maker of the address, however a file spells the way to it. */
const MAKER = /(^|\/)profileAddress$/

/**
 * An address written out rather than asked for: a piece of text holding `takmicar/` with something
 * other than a route parameter after it.
 *
 * Read off the parsed literals and not off the source, so that a comment spelling an address out
 * for a reader is not one written, and so that the pieces of a template are seen one by one: what
 * `profilePath` produces is `/${locale}`, then `/takmicar/`, then the address, and the middle
 * piece is what this finds. An address glued together with `+` is caught for the same reason.
 *
 * The exception is the address as a **pattern**, `takmicar/:memberNumber`, which is how the table
 * of routes says where these two screens live (`app/routes.ts`, `app/routeObjects.tsx`). A pattern
 * has no value in it and leads nobody anywhere; the colon is what tells the two apart, and that is
 * why this is a shape rather than a list of files.
 */
const WRITES = /takmicar\/(?!:)/

/** Every module a file imports from, whatever it is quoted with. */
function importsOf(path: string, code: string): string[] {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: string[] = []

  const walk = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push(node.moduleSpecifier.text)
    }

    ts.forEachChild(node, walk)
  }

  walk(source)

  return found
}

/** Every piece of text a file holds, comments aside, which the parser tells apart for us. */
function textIn(path: string, code: string): string[] {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: string[] = []

  const walk = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      found.push(node.text)
    }

    ts.forEachChild(node, walk)
  }

  walk(source)

  return found
}

const shortened = (path: string) => path.split(sep).slice(-2).join(sep)
const itself = (path: string) => path.endsWith(`pages${sep}profileAddress.ts`)

describe('the address of a profile', () => {
  it('is reached from four modules, and every screen asks for a link instead', () => {
    const swept = sources()

    /* The floor of the floor: an answer of „nobody" is right and is also what a walk over
       nothing gives. */
    expect(swept.length, 'the portal is still here').toBeGreaterThan(WHOLE_PORTAL)

    const reaching = swept
      .filter(({ path, code }) => importsOf(path, code).some((one) => MAKER.test(one)))
      .map(({ path }) => path)
      .filter((path) => !itself(path))
      .map(shortened)
      .sort()

    expect(reaching).toEqual([...MAY].sort())
  })

  it('is written out in one module and nowhere else', () => {
    const writing = sources()
      .filter(({ path, code }) => textIn(path, code).some((one) => WRITES.test(one)))
      .map(({ path }) => path)
      .filter((path) => !itself(path))
      .map(shortened)

    expect(writing).toEqual([])
  })
})
