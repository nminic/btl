import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { sources } from './sources'

/**
 * WHICH FILES DRAW A COMPONENT, FOUND THROUGH THE IMPORT AND NOT THROUGH THE NAME THE TAG IS WRITTEN WITH
 * (PENDING „Podovi u deletionSheet.test.tsx i deletionInFlight.test.tsx tvrde da hvataju i uvoz pod drugim
 * imenom, a porede tekst taga").
 *
 * <p>The floors under the two tables of deletions asked the parser for a tag and compared its TEXT with
 * `DeleteSheet` or `RowActions`, in `src/pages` alone. That is the question „is the name written?", and the
 * name is the one thing a file may change: `import { RowActions as Asks }` and `import * as Editor` with
 * `<Editor.RowActions>` drew the same sheet and passed every floor, and so did a file outside `src/pages`.
 * The portal's one answer to this (`components/actionSymbols.test.ts`) is to ask the IMPORT: a binding is
 * the component if it comes from the module that defines it, whatever it is called on the way in. That is
 * the question here, for the whole of `src`.
 *
 * <p><b>What it still cannot see, and says so:</b> a file that re-exports the component under another
 * name (`export { DeleteSheet as Anything } from ...`) is a second door the import cannot follow, so it is
 * reported on its own list ({@link Drawing.reExports}) for the floor to refuse, instead of being walked.
 * A component handed down as a prop and drawn by the receiver is the receiver's tag, which is a binding
 * that is not an import, and is outside this question.
 */

const SRC = join(process.cwd(), 'src')

const AS_THE_BUNDLER_DOES: ts.CompilerOptions = {
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
}

/** A module by its place under `src`, spelt the one way on either platform. */
function named(path: string): string {
  return relative(SRC, path).split(sep).join('/')
}

export type Drawing = {
  /** Whether the file draws the component, by any local name or through a namespace. */
  draws: boolean
  /** Whether the file re-exports the component, which the import cannot be followed through. */
  reExports: boolean
}

/**
 * Whether one file draws the component `exported` of the module `wanted` (a place under `src`, such as
 * `pages/admin/DeleteSheet.tsx`), and whether it re-exports it.
 */
export function drawing(path: string, code: string, wanted: string, exported: string): Drawing {
  const file = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const local = new Set<string>()
  const spaces = new Set<string>()
  let reExports = false

  for (const statement of file.statements) {
    const from =
      ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)
        ? statement.moduleSpecifier
        : undefined

    if (from === undefined || !ts.isStringLiteral(from)) {
      continue
    }

    const { resolvedModule } = ts.resolveModuleName(from.text, path, AS_THE_BUNDLER_DOES, ts.sys)

    if (resolvedModule === undefined || named(resolvedModule.resolvedFileName) !== wanted) {
      continue
    }

    if (ts.isExportDeclaration(statement)) {
      const names = statement.exportClause

      reExports =
        reExports ||
        names === undefined ||
        !ts.isNamedExports(names) ||
        names.elements.some((one) => (one.propertyName ?? one.name).text === exported)

      continue
    }

    const bindings = statement.importClause?.namedBindings

    if (bindings === undefined) {
      continue
    }

    if (ts.isNamespaceImport(bindings)) {
      spaces.add(bindings.name.text)

      continue
    }

    for (const one of bindings.elements) {
      if ((one.propertyName ?? one.name).text === exported) {
        local.add(one.name.text)
      }
    }
  }

  let draws = false

  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName

      draws =
        draws ||
        (ts.isIdentifier(tag) && local.has(tag.text)) ||
        (ts.isPropertyAccessExpression(tag) &&
          ts.isIdentifier(tag.expression) &&
          spaces.has(tag.expression.text) &&
          tag.name.text === exported)
    }

    ts.forEachChild(node, visit)
  }

  visit(file)

  return { draws, reExports }
}

/**
 * Every production file of `src` that draws the component, by its place under `src`, and every one that
 * re-exports it. The file that defines it (and the ones named in `outside`) are left out, as the floors
 * always left out the one that holds it.
 */
export function whoDraws(
  wanted: string,
  exported: string,
  outside: string[] = [],
): { draws: string[]; reExports: string[] } {
  const draws: string[] = []
  const reExports: string[] = []

  for (const { path, code } of sources()) {
    const place = named(path)

    if (place === wanted || outside.includes(place)) {
      continue
    }

    const one = drawing(path, code, wanted, exported)

    if (one.draws) {
      draws.push(place)
    }

    if (one.reExports) {
      reExports.push(place)
    }
  }

  return { draws: draws.sort(), reExports: reExports.sort() }
}
