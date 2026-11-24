import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { afterEach, describe, expect, it } from 'vitest'
import { forgetTheChosenTheme, THE_OLD_THEME_KEY } from './forgetTheTheme'

/**
 * THE STORED CHOICE OF THE LIGHT THEME, TAKEN OUT OF THE BROWSER (PDL „Portal ima samo tamnu temu; svetla se
 * izbacuje", 24.11.2026). Two states of the store, and the third where it cannot be reached at all.
 */
afterEach(() => {
  localStorage.clear()
})

describe('the choice of a theme that no longer exists', () => {
  it('is taken out of a browser that kept it, and nothing else is', () => {
    localStorage.setItem(THE_OLD_THEME_KEY, 'light')
    /* Beside it, a mark of another kind, which has to stay: a function that cleared the whole store would
       pass a case that only looked at the theme. */
    localStorage.setItem('btl-notice', 'closed')

    forgetTheChosenTheme(window)

    expect(localStorage.getItem(THE_OLD_THEME_KEY)).toBeNull()
    expect(localStorage.getItem('btl-notice')).toBe('closed')
  })

  it('is the very name the portal kept it under', () => {
    /* The name the settings wrote until 24.11.2026 (`app/themeContext.ts`, `THEME_STORAGE_KEY`), and the
       one the privacy policy names. Spelt differently, the removal takes out a key nobody ever wrote. */
    expect(THE_OLD_THEME_KEY).toBe('btl-theme')
  })

  it('leaves a browser that kept nothing as it was', () => {
    localStorage.setItem('btl-notice', 'closed')

    forgetTheChosenTheme(window)

    expect(localStorage.length).toBe(1)
  })

  it('does not stop the portal starting where the store cannot be reached', () => {
    const blocked = {
      get localStorage(): Storage {
        throw new DOMException('The operation is insecure.', 'SecurityError')
      },
    }

    expect(() => forgetTheChosenTheme(blocked)).not.toThrow()
  })

  it('is asked on every start, by the file that starts the portal', () => {
    /* `main.tsx` is outside the measure of coverage (it mounts React), so nothing would notice the call
       taken out of it. Asked of the parser: a statement at the top of the file that calls this function on
       the window, and the import it comes from. */
    const file = ts.createSourceFile(
      'main.tsx',
      readFileSync(join(process.cwd(), 'src/main.tsx'), 'utf-8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    )
    const calls = file.statements
      .filter(ts.isExpressionStatement)
      .map((one) => one.expression)
      .filter(ts.isCallExpression)
      .map((call) => `${call.expression.getText(file)}(${call.arguments.map((one) => one.getText(file)).join(', ')})`)
    const imports = file.statements
      .filter(ts.isImportDeclaration)
      .map((one) => one.moduleSpecifier.getText(file))

    expect(calls).toContain('forgetTheChosenTheme(window)')
    expect(imports).toContain("'./app/forgetTheTheme'")
  })
})
