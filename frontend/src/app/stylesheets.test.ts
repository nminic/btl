import { readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { sources, WHOLE_PORTAL } from '../test/sources'

/* THE LIST OF STYLESHEETS (`app/stylesheets.ts`) AGAINST WHAT THE CODE REALLY IMPORTS.

   The list decides the order of the cascade, so a stylesheet it does not name would be put wherever the
   cut of the code puts it, which is the fault the list exists against; and one it names that nothing
   imports any more is a rule the portal still ships for nobody. Both directions, read off the parser
   (`ts.preProcessFile`, the precedent `components/oneFace.test.ts` copies), so no spelling of an import
   can hide from it. What this cannot hold is the ORDER of a new entry, which is a decision and is said so
   in the head of the list; the order the list has is the one measured against the last build that was
   one piece (PR „Poboljšanje performansi”). */

const SRC = join(process.cwd(), 'src')
const THE_LIST = join(SRC, 'app', 'stylesheets.ts')

/** A stylesheet one file imports, as a path under `src` or as the package path the bundler resolves. */
function stylesheetsImportedBy(path: string, code: string): string[] {
  return ts
    .preProcessFile(code, true, true)
    .importedFiles.map((ref) => ref.fileName)
    .filter((name) => name.endsWith('.css'))
    .map((name) => (name.startsWith('.') ? relative(SRC, resolve(dirname(path), name)).split(sep).join('/') : name))
}

/**
 * THE MODULES THE PORTAL LOADS ONLY WITH ITS DEVELOPMENT CONTROLS, which a production build drops whole
 * (`dev/tools.ts` says why they are loaded and not imported: „an import is a stylesheet as well”). Read off
 * that file's own imports rather than named here, so a third control is left out on the day it is added.
 * Their stylesheets stay out of the list on purpose: named there, they would be in every production sheet.
 */
function loadedOnlyWithTheDevelopmentControls(): Set<string> {
  const tools = join(SRC, 'dev', 'tools.ts')

  return new Set(
    ts
      .preProcessFile(readFileSync(tools, 'utf-8'), true, true)
      .importedFiles.map((ref) => ref.fileName)
      .filter((name) => name.startsWith('.'))
      .map((name) => resolve(dirname(tools), `${name}.tsx`)),
  )
}

describe('the list of stylesheets', () => {
  const everyFile = sources()
  const listed = stylesheetsImportedBy(THE_LIST, readFileSync(THE_LIST, 'utf-8'))
  const devOnly = loadedOnlyWithTheDevelopmentControls()
  const imported = new Set(
    everyFile
      .filter((one) => one.path !== THE_LIST && !devOnly.has(one.path))
      .flatMap((one) => stylesheetsImportedBy(one.path, one.code)),
  )

  it('was read off the whole portal and off a list that is there', () => {
    expect(everyFile.length).toBeGreaterThan(WHOLE_PORTAL)
    expect(imported.size, 'the sweep found almost no stylesheet, so the comparison below says nothing').toBeGreaterThan(40)
    expect(listed).toContain('index.css')
    expect(devOnly.size, 'no module is loaded only with the development controls, so nothing is left out').toBeGreaterThan(0)
    expect(everyFile.filter((one) => devOnly.has(one.path)).length, 'a development control is not a file').toBe(devOnly.size)
  })

  it('names every stylesheet the code imports, once', () => {
    expect([...imported].filter((one) => !listed.includes(one)), 'imported and not placed in the list').toEqual([])
    expect(listed.length).toBe(new Set(listed).size)
  })

  it('names no stylesheet that nothing imports', () => {
    expect(
      listed.filter((one) => one !== 'index.css' && !imported.has(one)),
      'listed and imported by no module',
    ).toEqual([])
  })

  it('is what the portal loads first, so its order is the order of the cascade', () => {
    const main = ts.preProcessFile(readFileSync(join(SRC, 'main.tsx'), 'utf-8'), true, true).importedFiles

    const names = main.map((ref) => ref.fileName)

    expect(names).toContain('./app/stylesheets')
    expect(names.indexOf('./app/stylesheets'), 'the portal is loaded before its stylesheets').toBeLessThan(
      names.indexOf('./app/App.tsx'),
    )
    expect(names.filter((name) => name.endsWith('.css')), 'a stylesheet main.tsx imports beside the list').toEqual([])
  })
})
