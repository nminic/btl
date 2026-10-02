import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { sources, WHOLE_PORTAL } from '../test/sources'

/**
 * A READ THAT FAILED IS NEVER TURNED INTO AN EMPTY LIST WITHOUT SOMETHING SAYING SO (owner,
 * 02.10.2026, PENDING stavka 368: „Spisak koji ne moze da se ucita KAZE to, umesto da izgleda
 * prazan, uz dugme „Pokusaj ponovo". Vazi za sve ekrane sa spiskom.").
 *
 * <p><b>Found by the compiler and kept by the compiler.</b> The two screens that drew a failed
 * read as an empty list were found by walking the syntax tree of every production file and asking
 * ONE question of each place that stands in for a list: `dataOr(state, [])`, a condition that
 * reads `.status === 'ready'` and answers `[]` otherwise, and an `async` function that calls
 * `fetch` and `return []`s. This is that walk, asked of the whole portal on every run, so the
 * third screen is a failure here on the day it is written and not a finding on the day somebody
 * looks.
 *
 * <p><b>The question is about the SHAPE OF ONE CALL AND THE FUNCTION IT STANDS IN, and nothing
 * further.</b> An earlier draft of this idea asked „is the failure of this value said somewhere on
 * the screen", which has to follow a value through the code and has no bottom (the same fault the
 * guards over `profileAddress` and `valueInSentence` paid for six rounds each). What is asked here
 * is „does the SAME FUNCTION that substitutes an empty list also look at whether the read failed":
 * `failed(...)` over the state, a comparison with `'error'`, the state handed to `<Resource>`
 * (which draws the failure itself) or to a `combine…`, which hands it on. Answered by looking at
 * one function.
 *
 * <p><b>What it cannot see, written down.</b> A state read in one function and checked in another
 * counts as unchecked here, so the check has to stand beside the substitution; and a state that
 * is a call (`dataOr(useInbox(mine), [])`) has no name to be checked by, so it is always a
 * finding. Both are the conservative direction.
 */

type Shape = 'dataOr' | 'condition' | 'fetch'

type Finding = { file: string; shape: Shape; call: string }

const emptyList = (node: ts.Node | undefined): boolean =>
  node !== undefined && ts.isArrayLiteralExpression(node) && node.elements.length === 0

const words = (node: ts.Node) => node.getText().replace(/\s+/g, ' ')

function enclosingFunction(node: ts.Node): ts.Node {
  let current: ts.Node = node

  while (current.parent !== undefined) {
    current = current.parent

    if (
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current) ||
      ts.isMethodDeclaration(current)
    ) {
      return current
    }
  }

  return current
}

/** Every node under `scope`, `scope` included. */
function walk(scope: ts.Node, visit: (node: ts.Node) => void): void {
  visit(scope)
  ts.forEachChild(scope, (child) => {
    walk(child, visit)
  })
}

const mentions = (node: ts.Node, name: string): boolean => {
  let found = false

  walk(node, (one) => {
    if (ts.isIdentifier(one) && one.text === name) {
      found = true
    }
  })

  return found
}

/**
 * Whether the failure of the state called `name` is looked at anywhere in `scope`: handed to
 * `failed`, compared with `'error'`, handed to `<Resource state=…>` or to a `combine…`.
 */
function looksAtTheFailure(scope: ts.Node, name: string): boolean {
  let looked = false

  walk(scope, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === 'failed' || node.expression.text.startsWith('combine')) &&
      node.arguments.some((one) => mentions(one, name))
    ) {
      looked = true
    }

    if (
      ts.isBinaryExpression(node) &&
      [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(
        node.operatorToken.kind,
      )
    ) {
      for (const [side, other] of [
        [node.left, node.right],
        [node.right, node.left],
      ] as const) {
        if (
          ts.isPropertyAccessExpression(side) &&
          side.name.text === 'status' &&
          mentions(side.expression, name) &&
          ts.isStringLiteralLike(other) &&
          other.text === 'error'
        ) {
          looked = true
        }
      }
    }

    if (
      ts.isJsxAttribute(node) &&
      node.name.getText() === 'state' &&
      node.initializer !== undefined &&
      mentions(node.initializer, name)
    ) {
      const element = node.parent.parent

      if (
        (ts.isJsxOpeningElement(element) || ts.isJsxSelfClosingElement(element)) &&
        element.tagName.getText() === 'Resource'
      ) {
        looked = true
      }
    }
  })

  return looked
}

/** What `code` does that stands an empty list in for a failed read, and nothing looks at. */
function findingsIn(file: string, code: string): Finding[] {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: Finding[] = []

  walk(source, (node) => {
    /* 1. dataOr(<state>, []) */
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'dataOr' &&
      emptyList(node.arguments[1])
    ) {
      const state = node.arguments[0]
      const checked =
        state !== undefined &&
        ts.isIdentifier(state) &&
        looksAtTheFailure(enclosingFunction(node), state.text)

      if (!checked) {
        found.push({ file, shape: 'dataOr', call: words(node) })
      }
    }

    /* 2. <state>.status === 'ready' ? … : []   and its mirror, !== 'ready' ? [] : … */
    if (ts.isConditionalExpression(node) && ts.isBinaryExpression(node.condition)) {
      const { left, right, operatorToken } = node.condition
      const ready = operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
      const unready = operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken
      const access = ts.isPropertyAccessExpression(left) ? left : undefined

      if (
        access !== undefined &&
        access.name.text === 'status' &&
        ts.isStringLiteralLike(right) &&
        right.text === 'ready' &&
        ((ready && emptyList(node.whenFalse)) || (unready && emptyList(node.whenTrue)))
      ) {
        const state = access.expression
        const checked =
          ts.isIdentifier(state) && looksAtTheFailure(enclosingFunction(node), state.text)

        if (!checked) {
          found.push({ file, shape: 'condition', call: words(node) })
        }
      }
    }

    /* 3. an async function that calls fetch and answers [] on some path of its own */
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node)) &&
      ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Async
    ) {
      let fetches = false
      let answersEmpty = false

      walk(node, (inside) => {
        if (
          ts.isCallExpression(inside) &&
          ts.isIdentifier(inside.expression) &&
          inside.expression.text === 'fetch'
        ) {
          fetches = true
        }

        if (
          ts.isReturnStatement(inside) &&
          emptyList(inside.expression) &&
          enclosingFunction(inside) === node
        ) {
          answersEmpty = true
        }
      })

      if (fetches && answersEmpty) {
        found.push({ file, shape: 'fetch', call: node.getText().split('\n')[0] ?? '' })
      }
    }
  })

  return found
}

/**
 * THE PLACES THAT STAND AN EMPTY LIST IN FOR A FAILED READ AND ARE NOT FIXED, each with why it is
 * not a list a reader is asked to trust. A boundary and not a hole: the case below fails on the
 * day one of them stops being found, so an entry cannot outlive the code it excuses.
 */
const BOUNDARIES: { file: string; shape: Shape; call: string; why: string }[] = [
  {
    file: 'app/Shell.tsx',
    shape: 'dataOr',
    call: 'dataOr(items, [])',
    why: 'A COUNT in the header, not a list: the number of things waiting for a moderator. A header that waited for the file would hold up every screen behind it, and the section that names each queue says when the file failed (`pages/admin/SectionNav.tsx`, `verification.shortCount`).',
  },
  {
    file: 'roles/RoleSwitch.tsx',
    shape: 'dataOr',
    call: 'dataOr(useModerators(), [])',
    why: 'THE DEVELOPMENT SWITCH of roles, drawn only where the development controls are on (`dev/tools.ts`) and never in production: a list of moderators to be somebody else with, for whoever is building the portal.',
  },
]

const SRC = join(process.cwd(), 'src')

const named = (path: string) => relative(SRC, path).split(sep).join('/')

describe('a read that failed', () => {
  it('reads the whole portal', () => {
    /* The floor under the cases below: a sweep narrowed by accident answers with nothing, and
       „no failed read is drawn as an empty list" is then true of a portal nobody looked at. */
    expect(sources().length).toBeGreaterThan(WHOLE_PORTAL)
  })

  it('is never drawn as an empty list unless something in the same function looks at the failure', () => {
    const found = sources().flatMap(({ path, code }) => findingsIn(named(path), code))
    const unexcused = found.filter(
      (one) =>
        !BOUNDARIES.some(
          (boundary) =>
            boundary.file === one.file && boundary.shape === one.shape && boundary.call === one.call,
        ),
    )

    expect(
      unexcused.map((one) => `${one.file}: ${one.call}`),
      'a failed read looks like an empty list here, and nothing in the same function says otherwise',
    ).toEqual([])
  })

  it('still finds every boundary it names, and fails on the day it does not', () => {
    const found = sources().flatMap(({ path, code }) => findingsIn(named(path), code))
    const gone = BOUNDARIES.filter(
      (boundary) =>
        !found.some(
          (one) =>
            one.file === boundary.file && one.shape === boundary.shape && one.call === boundary.call,
        ),
    )

    expect(
      gone.map((one) => `${one.file}: ${one.call}`),
      'a boundary that no longer stands in the code: delete it from BOUNDARIES',
    ).toEqual([])
  })
})

/**
 * THE DETECTOR, ASKED OF CODE THAT IS WRITTEN FOR THE QUESTION. A guard that cannot be told from
 * its own absence is not a guard (ADL A2): without these, a walk that found nothing anywhere would
 * pass the portal-wide case above for the wrong reason.
 */
describe('the walk that finds them', () => {
  const found = (code: string) => findingsIn('x.tsx', code).map((one) => one.shape)

  it('finds a list stood in for a state that nothing looks at', () => {
    expect(found('function A() { const s = useX(); return dataOr(s, []) }')).toEqual(['dataOr'])
  })

  it('finds a state that is a call, because it has no name to be looked at by', () => {
    expect(found('function A() { return dataOr(useX(), []) }')).toEqual(['dataOr'])
  })

  it.each([
    ['handed to failed', 'function A() { const s = useX(); return failed(s) ? 1 : dataOr(s, []) }'],
    ['compared with error', "function A() { const s = useX(); return s.status === 'error' ? 1 : dataOr(s, []) }"],
    ['handed to Resource', 'function A() { const s = useX(); dataOr(s, []); return <Resource state={s}>{() => 1}</Resource> }'],
    ['handed to a combine', 'function A() { const s = useX(); dataOr(s, []); return combinePair(s, t) }'],
  ])('lets a list stand in where the state is %s in the same function', (_how, code) => {
    expect(found(code)).toEqual([])
  })

  it('does not take the check of ANOTHER state, or of another function, for this one', () => {
    expect(found('function A() { const s = useX(); const t = useY(); return failed(t) ? 1 : dataOr(s, []) }')).toEqual([
      'dataOr',
    ])
    expect(
      found('function A() { return failed(s) } function B() { const s = useX(); return dataOr(s, []) }'),
    ).toEqual(['dataOr'])
  })

  it('finds a condition that answers an empty list for a state that is not ready', () => {
    expect(found("function A() { const s = useX(); return s.status === 'ready' ? s.data : [] }")).toEqual([
      'condition',
    ])
    expect(found("function A() { const s = useX(); return s.status !== 'ready' ? [] : s.data }")).toEqual([
      'condition',
    ])
  })

  it('does not take a condition that answers something else, or tests something else, for one', () => {
    expect(found("function A() { const s = useX(); return s.status === 'ready' ? s.data : null }")).toEqual([])
    expect(found("function A() { const s = useX(); return s.status === 'pending' ? s.data : [] }")).toEqual([])
  })

  it('does not take a fallback that is not a list for one', () => {
    expect(found('function A() { const s = useX(); return dataOr(s, null) }')).toEqual([])
  })

  it('finds an async function that calls fetch and answers an empty list', () => {
    expect(found('async function read() { try { await fetch(p) } catch { return [] } return [1] }')).toEqual([
      'fetch',
    ])
    expect(found('const read = async () => { await fetch(p); return [] }')).toEqual(['fetch'])
  })

  it('does not take an async function that answers an empty list without asking a server for one', () => {
    expect(found('async function read() { return [] }')).toEqual([])
    expect(found('function read() { fetch(p); return [] }')).toEqual([])
  })
})
