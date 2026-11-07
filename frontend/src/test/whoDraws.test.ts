import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SLOW } from './slow'
import { drawing, whoDraws } from './whoDraws'

/**
 * THE FINDER OF WHO DRAWS A COMPONENT, ASKED ABOUT EVERY WAY A FILE CAN SPELL IT.
 *
 * <p>The code strings are given a path that is real (`src/pages/admin/`), because the finder resolves an
 * import the way the bundler does and a module that is not on the disk is not resolved. The component asked
 * about is `DeleteSheet`, from `pages/admin/DeleteSheet.tsx`.
 */

const HERE = join(process.cwd(), 'src', 'pages', 'admin', 'Somebody.tsx')
const SHEET = 'pages/admin/DeleteSheet.tsx'

const ask = (code: string) => drawing(HERE, code, SHEET, 'DeleteSheet')

describe('a file that draws the component', () => {
  it('is found by the plain tag', () => {
    expect(ask("import { DeleteSheet } from './DeleteSheet'\nexport const A = () => <DeleteSheet />")).toEqual({
      draws: true,
      reExports: false,
    })
  })

  it('is found by a tag written over two lines, with children', () => {
    expect(
      ask(
        "import { DeleteSheet } from './DeleteSheet'\nexport const A = () => (\n<DeleteSheet\n name='x'\n>y</DeleteSheet>)",
      ).draws,
    ).toBe(true)
  })

  it('is found under another name', () => {
    expect(ask("import { DeleteSheet as Asks } from './DeleteSheet'\nexport const A = () => <Asks />").draws).toBe(true)
  })

  it('is found through a namespace', () => {
    expect(ask("import * as Sheet from './DeleteSheet'\nexport const A = () => <Sheet.DeleteSheet />").draws).toBe(true)
  })

  it('is found by the path written with an extension and by a longer way round', () => {
    expect(ask("import { DeleteSheet } from './DeleteSheet.tsx'\nexport const A = () => <DeleteSheet />").draws).toBe(true)
    expect(ask("import { DeleteSheet } from '../admin/DeleteSheet'\nexport const A = () => <DeleteSheet />").draws).toBe(true)
  })
})

describe('a file that does not draw it', () => {
  it('is not found for a tag of the same name from another module', () => {
    expect(ask("import { DeleteSheet } from './Prompt'\nexport const A = () => <DeleteSheet />").draws).toBe(false)
  })

  it('is not found for another component of its own module', () => {
    expect(ask("import { Other } from './DeleteSheet'\nexport const A = () => <Other />").draws).toBe(false)
  })

  it('is not found for another name of the same namespace', () => {
    expect(ask("import * as Sheet from './DeleteSheet'\nexport const A = () => <Sheet.Other />").draws).toBe(false)
  })

  it('is not found where it is only imported, or only written in prose', () => {
    expect(ask("import { DeleteSheet } from './DeleteSheet'\n// <DeleteSheet />\nexport const A = () => <p />").draws).toBe(false)
  })

  it('is not found for a default import, a side-effect import, or a module that does not resolve', () => {
    expect(ask("import Sheet from './DeleteSheet'\nexport const A = () => <Sheet />").draws).toBe(false)
    expect(ask("import './DeleteSheet'\nexport const A = () => <p />").draws).toBe(false)
    expect(ask("import { DeleteSheet } from './nowhere'\nexport const A = () => <DeleteSheet />").draws).toBe(false)
  })

  it('ignores a statement that is not an import or an export from a module', () => {
    expect(ask('export const A = () => <p />\nexport { A as B }').draws).toBe(false)
  })
})

describe('a file that re-exports it', () => {
  it('is named, under any name', () => {
    expect(ask("export { DeleteSheet as Anything } from './DeleteSheet'").reExports).toBe(true)
    expect(ask("export { DeleteSheet } from './DeleteSheet'").reExports).toBe(true)
    expect(ask("export * from './DeleteSheet'").reExports).toBe(true)
    expect(ask("export * as Everything from './DeleteSheet'").reExports).toBe(true)
  })

  it('is not named for another component of the module, or for another module', () => {
    expect(ask("export { Other } from './DeleteSheet'").reExports).toBe(false)
    expect(ask("export { DeleteSheet } from './Prompt'").reExports).toBe(false)
  })
})

describe('the whole of the portal', () => {
  it('has the sheet drawn by the screens and re-exported by none', () => {
    const found = whoDraws(SHEET, 'DeleteSheet', ['pages/admin/EntityEditor.tsx'])

    expect(found.draws.length).toBeGreaterThan(3)
    expect(found.draws).toContain('pages/TeamDetail.tsx')
    expect(found.reExports).toEqual([])
  }, SLOW)

  it('leaves out the module that defines it and the ones it is told to', () => {
    const everyone = whoDraws(SHEET, 'DeleteSheet')

    expect(everyone.draws).toContain('pages/admin/EntityEditor.tsx')
    expect(everyone.draws).not.toContain(SHEET)
    expect(whoDraws(SHEET, 'DeleteSheet', ['pages/admin/EntityEditor.tsx']).draws).not.toContain(
      'pages/admin/EntityEditor.tsx',
    )
  }, SLOW)
})
