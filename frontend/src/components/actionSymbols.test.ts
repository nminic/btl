import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SYMBOL, type ActionSymbol } from '../app/actionSymbol'
import { sources, WHOLE_PORTAL } from '../test/sources'

/**
 * WHICH BUTTONS CARRY A SYMBOL AND WHICH KEEP THEIR WORD, held over the whole
 * portal (owner, 20.10.2026: „nego da budu simboli nalik krstiću, olovci, dva
 * dokumenta i sl."; the map of symbols and the buttons that keep their word were
 * chosen by the owner the same day from the ones offered to him, PDL „Mapa
 * simbola" and „Obim, redosled i opis").
 *
 * Two questions, both read off the source with the compiler's own parser:
 *
 * 1. **Every `ActionButton` and `ActionLink` carries the symbol its word is owed.**
 *    The word is a key of the dictionary, and `SYMBOL_OF` below says which symbol
 *    that key carries. That table is the only list written by hand here; the same
 *    key therefore carries the same symbol on every screen, and a key nobody has
 *    given a symbol fails until somebody does.
 * 2. **Every bare button whose text is a word of the dictionary keeps its word on
 *    purpose.** Its key is on `STAYS_A_WORD`, with the reason. A key owed a symbol
 *    fails there and names the symbol, and a key on neither list fails until it is
 *    decided about, so a new button is decided about the day it is written and not
 *    found by a review.
 *
 * **`STAYS_A_WORD` is held in both directions.** A key on it that no bare button
 * carries any more fails as well, so it says what the portal draws and nothing it
 * used to.
 *
 * **What it reads, and what it does not.** A bare button is a `<button>`, or a
 * `<Link>` or `<a>` whose `className` names the class `button`, written out or as a
 * choice between written values. A class handed over by a helper is not read: the
 * two links of a visitor in the header (`app/Shell.tsx`, `waitingFor(...)`) are
 * outside this floor, and they are links to other screens and keep their word. Its text
 * is read where it is a call of `t` with a written key, or a choice between two
 * written keys (`t(open ? 'a' : 'b')`, or `open ? t('a') : t('b')`). A text that
 * arrives any other way (a variable, a prop, a word built in a helper) is not read,
 * and such a button is outside this floor: `DeleteRecord` in
 * `pages/admin/EntityEditor.tsx`, which draws `face ?? t('admin.form.delete')`, is
 * the one that matters, and it is converted by hand with the shared paths.
 *
 * The component is found through the import and not by its name, so a screen that
 * imports it under another name is read all the same.
 */

const SRC = join(process.cwd(), 'src')

/** A module by its place under `src`, spelt the one way on either platform. */
function named(path: string): string {
  return relative(SRC, path).split(sep).join('/')
}

const AS_THE_BUNDLER_DOES: ts.CompilerOptions = {
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
}

const sr: unknown = JSON.parse(readFileSync(join(SRC, 'i18n/sr.json'), 'utf-8'))

/** The Serbian word under a key of the dictionary, or nothing. */
function wordOf(key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (inside, part) =>
        typeof inside === 'object' && inside !== null ? Reflect.get(inside, part) : undefined,
      sr,
    )
}

/**
 * THE KEY OF EVERY WORD THAT IS DRAWN AS A SYMBOL, with the symbol and the word
 * the owner's map names it by (PDL 20.10.2026, „Mapa simbola"). The word is held
 * against the dictionary, so a key written against the wrong word fails here.
 */
const SYMBOL_OF = new Map<string, { symbol: ActionSymbol; word: string }>([
  ['admin.cancelMembership', { symbol: SYMBOL.undo, word: 'Storniraj' }],
  /* Changing the rules and the prizes of a competition (pages/league/EditableText.tsx). */
  ['admin.change', { symbol: SYMBOL.pencil, word: 'Izmeni' }],
  ['admin.dropRace', { symbol: SYMBOL.cross, word: 'Izbaci' }],
  /* The row of a race in the form of an event (PDL 20.10.2026, derived from the map). */
  ['admin.form.delete', { symbol: SYMBOL.cross, word: 'Obriši' }],
  ['admin.form.open', { symbol: SYMBOL.pencil, word: 'Otvori' }],
  ['admin.grantExemption', { symbol: SYMBOL.shieldCheck, word: 'Odobri oslobođenje' }],
  ['admin.recordPayment', { symbol: SYMBOL.plus, word: 'Upiši uplatu' }],
  ['event.copy', { symbol: SYMBOL.copy, word: 'Kopiranje' }],
  ['event.delete', { symbol: SYMBOL.cross, word: 'Brisanje' }],
  ['event.edit', { symbol: SYMBOL.pencil, word: 'Izmena' }],
  /* The pencil on every result of the event page (PDL P9, 18.10.2026), named by whose run it is. */
  ['leagueResults.edit', { symbol: SYMBOL.pencil, word: 'Izmeni' }],
  /* Taking a row out of the entry of results, as a race is taken out of the form of an event. */
  ['leagueResults.remove', { symbol: SYMBOL.cross, word: 'Ukloni' }],
  /* Beside a member's own rating on the page of its event (owner, 20.10.2026). */
  ['event.editOwnRating', { symbol: SYMBOL.pencil, word: 'Izmeni svoju ocenu' }],
  ['form.clearPhoto', { symbol: SYMBOL.cross, word: 'Obriši' }],
  ['myResults.change', { symbol: SYMBOL.pencil, word: 'Izmeni' }],
  ['myResults.sendAgain', { symbol: SYMBOL.again, word: 'Ispravi i pošalji ponovo' }],
  /* An invitation into a racing pair, as one into a team (PDL 20.10.2026, derived). */
  ['pair.accept', { symbol: SYMBOL.check, word: 'Prihvati' }],
  ['pair.refuse', { symbol: SYMBOL.cross, word: 'Odbij' }],
  ['review.amend', { symbol: SYMBOL.pencil, word: 'Ispravi' }],
  ['review.approve', { symbol: SYMBOL.check, word: 'Odobri' }],
  /* In a queue of things to check, it goes back to the member with a reason. */
  ['review.sendBack', { symbol: SYMBOL.back, word: 'Odbij' }],
  ['teams.edit', { symbol: SYMBOL.pencil, word: 'Izmeni' }],
  ['teams.inviteAccept', { symbol: SYMBOL.check, word: 'Prihvati' }],
  ['teams.inviteRefuse', { symbol: SYMBOL.cross, word: 'Odbij' }],
  ['teams.inviteWithdraw', { symbol: SYMBOL.back, word: 'Povuci poziv' }],
  ['teams.joinRefused', { symbol: SYMBOL.cross, word: 'Odbij' }],
  ['teams.joinTaken', { symbol: SYMBOL.check, word: 'Primi u tim' }],
  ['verification.activate', { symbol: SYMBOL.check, word: 'Aktiviraj' }],
  ['verification.delete', { symbol: SYMBOL.cross, word: 'Obriši' }],
  ['verification.openCard', { symbol: SYMBOL.down, word: 'Prikaži' }],
  ['verification.foldCard', { symbol: SYMBOL.up, word: 'Sakrij' }],
])

/* Why a button keeps its word, said once each. */
const LISTED =
  'named among the buttons that keep their word (PDL 20.10.2026, „Mapa simbola")'
const FORM =
  'a button of a form or of a box that asks for something, which keeps its word (PDL 20.10.2026, „Obim, redosled i opis")'
const ANSWER = 'an answer to a confirmation, which keeps its word (PDL 20.10.2026, „Obim, redosled i opis")'
const NOT_AN_ACTION =
  'not an action on one thing but a way about the portal: a tab, a pager, a heading that opens a box, a link to another screen. Derived 20.10.2026 from the decision being about actions on one thing (PDL „Obim, redosled i opis")'

/** THE BUTTONS THAT KEEP THEIR WORD, each with its reason. */
const STAYS_A_WORD = new Map([
  ['account.passwordSubmit', FORM],
  ['account.save', FORM],
  ['admin.addRace', FORM],
  ['admin.changeToExemption', LISTED],
  ['admin.form.back', NOT_AN_ACTION],
  ['admin.form.keep', ANSWER],
  ['admin.form.new.races', LISTED],
  ['admin.leagueRaces', NOT_AN_ACTION],
  ['bio.send', FORM],
  ['calendar.today', NOT_AN_ACTION],
  ['data.retry', LISTED],
  ['editor.add', FORM],
  ['editor.cancel', FORM],
  ['editor.removeLink', FORM],
  /* The owner's answer of 20.10.2026, on being asked: it stays a word. */
  ['event.addComment', 'the link to the rating of an event keeps its word (owner, 20.10.2026, on being asked)'],
  ['event.commentCancel', FORM],
  ['event.commentSend', FORM],
  ['event.enterResult', LISTED],
  ['event.goingOn', LISTED],
  ['event.writeSend', FORM],
  ['forgottenPassword.sending', FORM],
  ['forgottenPassword.submit', FORM],
  ['form.close', FORM],
  ['home.calcReset', LISTED],
  ['leagueResults.addRow', LISTED],
  ['leagueResults.save', FORM],
  ['leagues.counting', NOT_AN_ACTION],
  ['membership.leaveTeam', LISTED],
  ['membership.leaveTeamKeep', ANSWER],
  ['membership.leaveTeamSure', ANSWER],
  ['myProfile.signOut', LISTED],
  ['myResults.add', LISTED],
  ['nav.login', NOT_AN_ACTION],
  ['newPassword.sending', FORM],
  ['newPassword.submit', FORM],
  ['nav.membership', NOT_AN_ACTION],
  ['newResult.another', NOT_AN_ACTION],
  ['newResult.toMine', NOT_AN_ACTION],
  ['pager.next', NOT_AN_ACTION],
  ['pager.previous', NOT_AN_ACTION],
  ['pair.breakUp', LISTED],
  ['pair.invite', LISTED],
  ['picture.send', FORM],
  ['profile.clearFilters', LISTED],
  ['rankings.allCategories', NOT_AN_ACTION],
  ['rankings.men', NOT_AN_ACTION],
  ['rankings.women', NOT_AN_ACTION],
  ['registration.resend', FORM],
  ['review.amendCancel', FORM],
  ['review.amendSave', FORM],
  ['review.cancel', FORM],
  ['review.confirmSendBack', FORM],
  ['review.placeRace', LISTED],
  ['review.placeSave', FORM],
  ['rulebook.openSections', NOT_AN_ACTION],
  /* The way out of a locked site: a link to the front page in a new tab, and the button is NAMED in the
     decision, so the word is the owner's and not a candidate for a symbol. */
  [
    'server.lockedOpen',
    'a link to the front page in a new tab, whose button the owner named „Otvori u novoj kartici" (ADL 22.10.2026, „portal to kaže i nudi novu karticu"): a way about the portal and not an action on one thing',
  ],
  ['shell.closeMenu', NOT_AN_ACTION],
  ['shell.home', NOT_AN_ACTION],
  ['shell.openMenu', NOT_AN_ACTION],
  ['signIn.sending', FORM],
  ['signIn.submit', FORM],
  ['teams.invite', LISTED],
  ['teams.join', LISTED],
  ['teams.joinWithdraw', LISTED],
  ['teams.propose', NOT_AN_ACTION],
  ['verification.approveAll', LISTED],
])

/**
 * THE TWO COMPONENTS WHOSE WORD IS HANDED DOWN TO THEM, with the one symbol each draws.
 *
 * Their word is a prop and not a key, so it cannot be read here; what can be held is
 * that the symbol is the one the owner's map gives the thing they do, and that nothing
 * else on the portal draws a symbol over a word this floor cannot read.
 *
 * - `DeleteRecord` (pages/admin/EntityEditor.tsx), the first button of every deletion:
 *   „Obriši", or the words a screen hands over („Obriši svoju ocenu").
 * - `CopyField` (components/CopyField.tsx): the name of the value it copies.
 */
const HANDED_DOWN = new Map([
  ['pages/admin/EntityEditor.tsx', SYMBOL.cross],
  ['components/CopyField.tsx', SYMBOL.copy],
])

/** Where something was found, as a person reading the failure would look for it. */
type Place = { path: string; line: number }

/** A bare button, the keys its text can be, and any character it draws as a symbol. */
export type BareButton = Place & { keys: string[]; glyphs: string[] }

/**
 * An `ActionButton` or `ActionLink`, and what it carries: one pair per branch of a
 * choice, and `unread` where the word or the symbol arrives in a way this does not
 * read.
 */
export type Action = Place & {
  pairs: { key: string; symbol: string }[]
  unread: boolean
  /** The symbols drawn, read on their own, so a word handed down can still be held to one. */
  symbols: string[] | undefined
  /** The classes it is dressed in, where they are written out. */
  look: string[] | undefined
}

/** The shape of a choice between written values, and the values in its order. */
type Leaves = { shape: string; values: string[] } | undefined

/** The keys a call of `t` asks for, in the order of the choice it makes. */
function keysOf(node: ts.Expression, source: ts.SourceFile): Leaves {
  if (ts.isParenthesizedExpression(node)) {
    return keysOf(node.expression, source)
  }

  if (ts.isConditionalExpression(node)) {
    return choice(node, source, keysOf)
  }

  if (ts.isCallExpression(node) && node.expression.getText(source) === 't') {
    const asked = node.arguments[0]

    return asked === undefined ? undefined : written(asked, source)
  }

  return undefined
}

/** A written key, or a choice between written keys. */
function written(node: ts.Expression, source: ts.SourceFile): Leaves {
  if (ts.isParenthesizedExpression(node)) {
    return written(node.expression, source)
  }

  if (ts.isConditionalExpression(node)) {
    return choice(node, source, written)
  }

  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    ? { shape: '·', values: [node.text] }
    : undefined
}

/** Both branches of a choice, read the same way, and the condition they hang on. */
function choice(
  node: ts.ConditionalExpression,
  source: ts.SourceFile,
  read: (branch: ts.Expression, source: ts.SourceFile) => Leaves,
): Leaves {
  const yes = read(node.whenTrue, source)
  const no = read(node.whenFalse, source)

  return yes === undefined || no === undefined
    ? undefined
    : {
        shape: `(${node.condition.getText(source)} ? ${yes.shape} : ${no.shape})`,
        values: [...yes.values, ...no.values],
      }
}

/** The symbols a `symbol` attribute names through the imported `SYMBOL`. */
function symbolsOf(node: ts.Expression, source: ts.SourceFile, names: Set<string>): Leaves {
  if (ts.isParenthesizedExpression(node)) {
    return symbolsOf(node.expression, source, names)
  }

  if (ts.isConditionalExpression(node)) {
    return choice(node, source, (branch, from) => symbolsOf(branch, from, names))
  }

  return ts.isPropertyAccessExpression(node) && names.has(node.expression.getText(source))
    ? { shape: '·', values: [node.name.text] }
    : undefined
}

/** The local names a file gives to what it imports from one module. */
function importedFrom(path: string, source: ts.SourceFile, wanted: string, exported: string[]): Set<string> {
  const local = new Set<string>()

  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue
    }

    const { resolvedModule } = ts.resolveModuleName(
      statement.moduleSpecifier.text,
      path,
      AS_THE_BUNDLER_DOES,
      ts.sys,
    )
    const bindings = statement.importClause?.namedBindings

    if (
      resolvedModule === undefined ||
      named(resolvedModule.resolvedFileName) !== wanted ||
      bindings === undefined ||
      !ts.isNamedImports(bindings)
    ) {
      continue
    }

    for (const one of bindings.elements) {
      if (exported.includes((one.propertyName ?? one.name).text)) {
        local.add(one.name.text)
      }
    }
  }

  return local
}

/** The expression an attribute is given, where it is given one. */
function valueOf(attributes: ts.JsxAttributes, name: string): ts.Expression | undefined {
  for (const one of attributes.properties) {
    if (ts.isJsxAttribute(one) && one.name.getText() === name && one.initializer !== undefined) {
      return ts.isJsxExpression(one.initializer) ? one.initializer.expression : one.initializer
    }
  }

  return undefined
}

/** Every bare button and every action of one file. */
export function buttonsIn(path: string, code: string): { bare: BareButton[]; actions: Action[] } {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const components = importedFrom(path, source, 'components/ActionButton.tsx', ['ActionButton', 'ActionLink'])
  const symbols = importedFrom(path, source, 'app/actionSymbol.ts', ['SYMBOL'])
  const bare: BareButton[] = []
  const actions: Action[] = []
  const placeOf = (node: ts.Node): Place => ({
    path,
    line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
  })

  const walk = (node: ts.Node): void => {
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : undefined

    if (opening !== undefined && components.has(opening.tagName.getText(source))) {
      const word = valueOf(opening.attributes, 'word')
      const symbol = valueOf(opening.attributes, 'symbol')
      const keys = word === undefined ? undefined : keysOf(word, source)
      const drawn = symbol === undefined ? undefined : symbolsOf(symbol, source, symbols)
      const read = keys !== undefined && drawn !== undefined && keys.shape === drawn.shape

      actions.push({
        ...placeOf(node),
        unread: !read,
        symbols: drawn?.values,
        look: (() => {
          const dressed = valueOf(opening.attributes, 'className')

          return dressed === undefined ? undefined : written(dressed, source)?.values
        })(),
        pairs: read ? keys.values.map((key, at) => ({ key, symbol: drawn.values[at] ?? '' })) : [],
      })
    }

    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(source)
      const look = valueOf(node.openingElement.attributes, 'className')
      const classes = look === undefined ? undefined : written(look, source)
      const styled =
        classes !== undefined && classes.values.some((one) => one.split(/\s+/).includes('button'))

      if (tag === 'button' || ((tag === 'Link' || tag === 'a') && styled)) {
        /* A text with no letter and no digit in it is a symbol drawn as a character: „✎" and „×"
           stood on the result row of the event page until 20.10.2026. Only where the character is the
           whole of the text: „+ Dodaj člana" is a word with a sign in front of it and keeps it. */
        const glyphs = node.children.every((child) => ts.isJsxText(child))
          ? node.children
              .map((child) => child.getText(source).trim())
              .filter((text) => text !== '' && !/[\p{L}\p{N}]/u.test(text))
          : []

        if (glyphs.length > 0) {
          bare.push({ ...placeOf(node), keys: [], glyphs })
        }

        for (const child of node.children) {
          const keys =
            ts.isJsxExpression(child) && child.expression !== undefined
              ? keysOf(child.expression, source)
              : undefined

          if (keys !== undefined) {
            bare.push({ ...placeOf(node), keys: keys.values, glyphs: [] })
          }
        }
      }
    }

    ts.forEachChild(node, walk)
  }

  walk(source)

  return { bare, actions }
}

const where = (one: Place) => `${named(one.path)}:${String(one.line)}`

describe('the buttons that act on one thing', () => {
  const portal = sources().filter((one) => one.path.endsWith('.tsx'))
  const found = portal.map((one) => buttonsIn(one.path, one.code))
  const bare = found.flatMap((one) => one.bare)
  const actions = found.flatMap((one) => one.actions)

  it('are looked for over the whole portal, and found', () => {
    /* A sweep that read nothing passes every question below. */
    expect(portal.length).toBeGreaterThan(WHOLE_PORTAL)
    expect(bare.length, 'the bare buttons that carry a word of the dictionary').toBeGreaterThan(60)
    expect(actions.length, 'the buttons drawn as a symbol').toBeGreaterThan(30)
  })

  it('name each word by the word the owner’s map gives it', () => {
    const wrong = [...SYMBOL_OF].filter(([key, { word }]) => wordOf(key) !== word).map(([key]) => key)

    expect(wrong).toEqual([])
  })

  it('give every symbol of the set at least one word', () => {
    const given = new Set([...SYMBOL_OF.values()].map((one) => one.symbol))

    expect([...given].sort()).toEqual(Object.values(SYMBOL).sort())
  })

  it('carry the symbol their word is owed, the same one on every screen', () => {
    const astray = actions.flatMap((one) =>
      one.unread
        ? HANDED_DOWN.get(named(one.path)) === (one.symbols ?? []).join(' ')
          ? []
          : [`${where(one)}: the word or the symbol is not read`]
        : one.pairs
            .filter(({ key, symbol }) => SYMBOL_OF.get(key)?.symbol !== symbol)
            .map(({ key, symbol }) => `${where(one)}: ${key} drawn as ${symbol}, owed ${String(SYMBOL_OF.get(key)?.symbol)}`),
    )

    expect(astray).toEqual([])
  })

  it('keep „Odobri" in the filled look it had', () => {
    /* PDL 20.10.2026 (derived, and the owner's answer the same day): „Odobri" in a queue
       keeps today's filled look, so the one action a row leads with still stands out. */
    const approving = actions.filter((one) => one.pairs.some(({ key }) => key === 'review.approve'))

    expect(approving.length, 'the queues no longer draw „Odobri"').toBeGreaterThan(0)
    expect(
      approving.filter((one) => !(one.look ?? []).some((classes) => classes.split(/\s+/).includes('button--primary'))).map(where),
    ).toEqual([])
  })

  it('take a word handed down only where it is named, and every one named is there', () => {
    const handing = new Map(
      actions.filter((one) => one.unread).map((one) => [named(one.path), (one.symbols ?? []).join(' ')]),
    )

    expect(handing).toEqual(HANDED_DOWN)
  })

  it('leave no word drawn as a word that has not been decided about', () => {
    const undecided = bare.flatMap((one) =>
      one.keys
        .filter((key) => !STAYS_A_WORD.has(key))
        .map((key) =>
          SYMBOL_OF.has(key)
            ? `${where(one)}: ${key} is owed ${String(SYMBOL_OF.get(key)?.symbol)}, draw it with ActionButton`
            : `${where(one)}: ${key} is neither in SYMBOL_OF nor in STAYS_A_WORD`,
        ),
    )

    expect(undecided).toEqual([])
  })

  it('draw no symbol as a character of text', () => {
    /* A character is not a drawn symbol: it carries no box with its word, and a screen reader
       may read it out by its own name, „multiplication sign". The symbols are drawn
       (`app/icons.tsx`). */
    expect(bare.filter((one) => one.glyphs.length > 0).map((one) => `${where(one)}: ${one.glyphs.join(' ')}`)).toEqual([])
  })

  it('keep the words that stay to what the portal draws today', () => {
    const drawn = new Set(bare.flatMap((one) => one.keys))

    expect([...STAYS_A_WORD.keys()].filter((key) => !drawn.has(key)), 'no bare button carries it').toEqual([])
    /* And a key is on one side only. */
    expect([...STAYS_A_WORD.keys()].filter((key) => SYMBOL_OF.has(key))).toEqual([])
  })
})

describe('reading a button out of the source', () => {
  const screenAt = join(SRC, 'pages', 'Example.tsx')

  it('finds the component under whatever name it is imported, and the symbol through SYMBOL', () => {
    const { actions } = buttonsIn(
      screenAt,
      [
        "import { ActionButton as Act, ActionLink } from '../components/ActionButton'",
        "import { SYMBOL as S } from '../app/actionSymbol.ts'",
        'export const a = <Act symbol={S.pencil} word={t("teams.edit")} />',
        'export const b = <ActionLink symbol={S.check} word={t(`review.approve`)} to="/" />',
      ].join('\n'),
    )

    expect(actions.map((one) => ({ line: one.line, pairs: one.pairs, unread: one.unread }))).toEqual([
      { line: 3, pairs: [{ key: 'teams.edit', symbol: 'pencil' }], unread: false },
      { line: 4, pairs: [{ key: 'review.approve', symbol: 'check' }], unread: false },
    ])
  })

  it('pairs a choice of word with the same choice of symbol, and only the same one', () => {
    const { actions } = buttonsIn(
      screenAt,
      [
        "import { ActionButton } from '../components/ActionButton'",
        "import { SYMBOL } from '../app/actionSymbol'",
        "const a = <ActionButton symbol={open ? SYMBOL.up : SYMBOL.down} word={t(open ? 'verification.foldCard' : 'verification.openCard')} />",
        "const b = <ActionButton symbol={(open ? SYMBOL.up : SYMBOL.down)} word={open ? t('verification.foldCard') : t('verification.openCard')} />",
        "const c = <ActionButton symbol={shut ? SYMBOL.up : SYMBOL.down} word={t(open ? 'verification.foldCard' : 'verification.openCard')} />",
      ].join('\n'),
    )

    const read = [
      { key: 'verification.foldCard', symbol: 'up' },
      { key: 'verification.openCard', symbol: 'down' },
    ]

    expect(actions.map((one) => one.pairs)).toEqual([read, read, []])
    expect(actions.map((one) => one.unread)).toEqual([false, false, true])
  })

  it('says it cannot read a word or a symbol it was not written to read', () => {
    const { actions } = buttonsIn(
      screenAt,
      [
        "import { ActionButton } from '../components/ActionButton'",
        "import { SYMBOL } from '../app/actionSymbol'",
        'const a = <ActionButton symbol={SYMBOL.cross} word={label} />',
        "const b = <ActionButton symbol={mine.cross} word={t('event.delete')} />",
        "const c = <ActionButton symbol={SYMBOL.cross} word={t(key)} />",
        "const d = <ActionButton symbol={SYMBOL.cross} word={t()} />",
        'const e = <ActionButton word={t("event.delete")} />',
        "const f = <ActionButton symbol={SYMBOL.cross} />",
        "const g = <ActionButton symbol={SYMBOL.cross} word={t(open ? 'a' : key)} />",
        "const h = <ActionButton symbol={open ? SYMBOL.up : other} word={t(open ? 'a' : 'b')} />",
      ].join('\n'),
    )

    expect(actions.map((one) => one.unread)).toEqual(Array(8).fill(true))
  })

  it('does not take a component of the same name from somewhere else for this one', () => {
    const { actions } = buttonsIn(
      screenAt,
      [
        "import { ActionButton } from './elsewhere'",
        "import Default from '../components/ActionButton'",
        "import * as All from '../components/ActionButton'",
        "import '../components/ActionButton.css'",
        "import { Link as ActionLink } from 'react-router'",
        "const a = <ActionButton symbol={SYMBOL.cross} word={t('event.delete')} />",
      ].join('\n'),
    )

    expect(actions).toEqual([])
  })

  it('reads the text of a bare button, of a link styled as one, and not of a plain link', () => {
    const { bare } = buttonsIn(
      screenAt,
      [
        "const a = <button type=\"button\">{t('event.edit')}</button>",
        "const b = <Link className=\"button button--secondary\" to=\"/\">{t('teams.edit')}</Link>",
        "const c = <a className=\"button\" href=\"/\">{(t('event.copy'))}</a>",
        "const d = <Link className=\"nav\" to=\"/\">{t('shell.home')}</Link>",
        "const e = <Link className={look} to=\"/\">{t('shell.join')}</Link>",
        "const e2 = <Link className={waiting ? 'button shell__guest--waiting' : 'button'} to=\"/\">{t('shell.signIn')}</Link>",
        "const f = <button>{t(shown ? 'verification.foldCard' : 'verification.openCard')}</button>",
        "const g = <button>{label}{t(key)}{t()}</button>",
        '<button>{}</button>',
        '<button aria-label="x">×</button>',
        '<Link className="button" to="/">✎</Link>',
        '<button>2</button>',
        "<button>+ {t('leagueResults.addRow')}</button>",
        '<Link className="nav" to="/">›</Link>',
      ].join('\n'),
    )

    expect(bare.map((one) => ({ line: one.line, keys: one.keys, glyphs: one.glyphs }))).toEqual([
      { line: 1, keys: ['event.edit'], glyphs: [] },
      { line: 2, keys: ['teams.edit'], glyphs: [] },
      { line: 3, keys: ['event.copy'], glyphs: [] },
      { line: 6, keys: ['shell.signIn'], glyphs: [] },
      { line: 7, keys: ['verification.foldCard', 'verification.openCard'], glyphs: [] },
      { line: 10, keys: [], glyphs: ['×'] },
      { line: 11, keys: [], glyphs: ['✎'] },
      { line: 13, keys: ['leagueResults.addRow'], glyphs: [] },
    ])
  })
})
