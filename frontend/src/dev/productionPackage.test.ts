import { readFileSync } from 'node:fs'
import { basename, dirname, extname, join, relative, sep } from 'node:path'
import ts from 'typescript'
import { build, type Rollup } from 'vite'
import en from '../i18n/en.json'
import sr from '../i18n/sr.json'
import type { Dictionary } from '../i18n/translate'
import { sources } from '../test/sources'
import { SLOW } from '../test/slow'
import { DEV_WORDS } from './words'

/**
 * WHAT THE PRODUCTION PACKAGE CARRIES OF THE LIST IN ADL A15, ASKED OF THE BUNDLER ITSELF.
 *
 * <p>The owner, 01.08.2026 (ADL A15): „Gašenje nije isto što i brisanje, i ovde se traži
 * brisanje: ugašena kontrola je i dalje kod koji putuje u paketu skripti", and the check that
 * goes with it: „u paketu koji ide na produkciju ne postoji nijedan od naziva sa spiska ...
 * Najlakše kao jedan `grep` nad `dist/`, jer je to jedino merilo koje ne zavisi od toga šta
 * mislimo da smo obrisali." The list is the role switch, the switch of the day and the words
 * `TREBA POPUNITI`. Measured 09.10.2026 on `9791aae4`, before the change this file came with:
 * the production package carried both switches, switched off.
 *
 * <p><b>Built here, in the suite, rather than grepped in a step of its own</b>, so that the
 * check is held by the gate everybody already runs and needs no second file to be kept in
 * step with it: the portal's own `vite.config.ts`, the production mode, and nothing written
 * to disk. Twice: as production builds it, and as QA does, with `VITE_DEV_TOOLS=1`. The
 * second is what makes the first worth anything - everything this file says is absent from
 * production it first finds present in QA, so a name that went out of date, or a build that
 * did not take the environment it was given, fails here instead of passing over nothing.
 *
 * <p><b>The switches are asked for by MODULE, not by a word they happen to contain.</b> Which
 * modules they are is read off the loader in `dev/tools.ts` by the parser and the resolver,
 * the way `components/oneFace.test.ts` reads who imports whom, and the bundler is asked which
 * modules it put in each package. A word can be minified, renamed or shared; a module is in a
 * package or it is not. A switch's stylesheet is asked for the same way, because a stylesheet
 * is the part that stays when its script is dropped (measured, `dev/tools.ts`).
 *
 * <p><b>And by NAME as well, because a module that is gone does not take with it the places
 * that still say its name.</b> Measured 09.10.2026, on this change as first reviewed: no
 * module of either switch was in the production package, and `DateSwitch` and `RoleSwitch`
 * still stood in it once each, as the two properties the shell read off the loader's answer in
 * a branch the bundler could not prove dead (`app/Shell.tsx`; a bundler does not shorten a
 * property name). Those are the words the `grep` of A15 looks for, and a check of modules
 * cannot see them. A name is counted wherever it stands, as `grep` counts it, so a longer word
 * that contains it is counted too. Each name is the file its switch is written in, taken from
 * the same loader as the modules, so there is no list here to fall out of date, and each is
 * first found in the QA package, for the reason given above.
 *
 * <p><b>And by WORDS, since 28869.</b> The switches' code was out of the production package
 * and their sentences were not: `role.*`, `clock.*` and `server.named` stood in the two
 * dictionaries every screen imports whole, so the package said „Današnji datum" and „Vrati na
 * stvarni datum" for a control it does not draw. They are a module of their own now
 * (`dev/words.ts`), reached by the switches and by nothing else. Asked three ways, each of them
 * first found in QA: the modules, the names the switches ask for (`role.label`, as `grep`
 * counts them) and the sentences, the last of them only for those the portal's own
 * dictionaries do not say anywhere else, because „Moderator" in the package proves nothing
 * about a switch when „Moderatori" is a sentence of the portal.
 *
 * <p><b>What it does not see, written down rather than left to be found:</b> a development
 * control that is not loaded through `loadTheDevControls`, and anything under `public/`,
 * which the build copies as it is and does not bundle. And it does not ask for the four names
 * A15 gives the choices of the role switch (Posetilac, Takmičar, Moderator, Superadmin):
 * those words are the portal's own everywhere else, so their presence says nothing.
 */

const FRONTEND = process.cwd()
const SRC = join(FRONTEND, 'src')

/** A module by its place under `src`, spelt one way on either platform. */
function named(path: string): string {
  return relative(SRC, path).split(sep).join('/')
}

/** The project's own resolution, as `components/oneFace.test.ts` sets it out. */
const AS_THE_BUNDLER_DOES: ts.CompilerOptions = {
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
}

function source(module: string): string {
  return readFileSync(join(SRC, module), 'utf-8')
}

/** How many times a word stands in a package: a count says what failed in one line, where the
 *  package itself, printed by a failing match, is the better part of a megabyte. */
function timesIn(text: string, word: string): number {
  return text.split(word).length - 1
}

/** Every module a file imports, statically or with `import()`, resolved to its place. */
function importsOf(module: string): string[] {
  const at = join(SRC, module)

  return ts.preProcessFile(source(module), true, true).importedFiles.flatMap((ref) => {
    /* A stylesheet has no declaration for the resolver to find, nor has a book of words (the
       project does not resolve JSON), and both are resolved the one way a relative path is. */
    if (ref.fileName.endsWith('.css') || ref.fileName.endsWith('.json')) {
      return [named(join(dirname(at), ref.fileName))]
    }

    const { resolvedModule } = ts.resolveModuleName(ref.fileName, at, AS_THE_BUNDLER_DOES, ts.sys)

    return resolvedModule === undefined ? [] : [named(resolvedModule.resolvedFileName)]
  })
}

type Package = { modules: Set<string>; text: string }

/** One build of the portal, held in memory: which modules went in, and every word of it. */
async function packageBuilt(asQa: boolean): Promise<Package> {
  const before = { mode: process.env.NODE_ENV, flag: process.env.VITE_DEV_TOOLS }

  /* As the image builds it: `vite build` sets production itself where nothing else is set,
     and the suite runs under `test`, which Vite would otherwise take for a development
     build and keep the controls on. */
  process.env.NODE_ENV = 'production'

  if (asQa) {
    process.env.VITE_DEV_TOOLS = '1'
  } else {
    delete process.env.VITE_DEV_TOOLS
  }

  try {
    const built = await build({
      root: FRONTEND,
      configFile: join(FRONTEND, 'vite.config.ts'),
      mode: 'production',
      logLevel: 'silent',
      build: { write: false },
    })
    /* Looked at rather than asserted (ADL A14): a build asked to watch would hand back a
       watcher with no output, and that has to read as „nothing was built", which every case
       below then fails on, not as an output claimed to be there. */
    const outputs: Rollup.RollupOutput[] = Array.isArray(built)
      ? built
      : 'output' in built
        ? [built]
        : []
    const files = outputs.flatMap((one) => one.output)

    return {
      modules: new Set(
        files.flatMap((file) => (file.type === 'chunk' ? file.moduleIds.map(named) : [])),
      ),
      text: files
        .map((file) => {
          if (file.type === 'chunk') {
            return file.code
          }

          /* A picture is bytes, and bytes say no word. */
          return typeof file.source === 'string' ? file.source : ''
        })
        .join('\n'),
    }
  } finally {
    process.env.NODE_ENV = before.mode

    if (before.flag === undefined) {
      delete process.env.VITE_DEV_TOOLS
    } else {
      process.env.VITE_DEV_TOOLS = before.flag
    }
  }
}

/** Whatever the two switches are built out of: their modules and their own stylesheets. */
const CONTROLS = importsOf('dev/tools.ts')
const THEIR_PARTS = CONTROLS.flatMap((control) => [
  control,
  ...importsOf(control).filter((one) => one.endsWith('.css')),
])

/**
 * The words of the switches: the module they read them through, which each of them imports, and
 * the two books that module imports. Read off the imports like the parts above, so a third book
 * or a second reader is in the question the day it is written.
 */
const THEIR_WORDS = [
  ...new Set(
    CONTROLS.flatMap((control) => importsOf(control)).filter((one) => one.startsWith('dev/words')),
  ),
].flatMap((reader) => [reader, ...importsOf(reader).filter((one) => one.endsWith('.json'))])

/** The names the switches ask their books for, written out in full as `t('role.label')`. */
const THE_NAMES_THEY_ASK_FOR = [
  ...new Set(
    CONTROLS.flatMap((control) =>
      [...source(control).matchAll(/\bt\('([a-z]+(?:\.[a-zA-Z]+)+)'\)/g)].map((one) => one[1] ?? ''),
    ),
  ),
].sort()

function sentencesOf(book: Dictionary): string[] {
  return Object.values(book).flatMap((one) => (typeof one === 'string' ? [one] : sentencesOf(one)))
}

/** The files whose own text is the controls': the two switches and the module of their words. */
const CONTROL_FILES = [...CONTROLS, ...THEIR_WORDS.filter((one) => one.endsWith('.ts'))]

/**
 * The sentences of the switches that nothing else of the portal says: not as a sentence and not
 * inside one, in either of its two dictionaries. `Moderator` is the portal's own word in
 * `Moderatori`, so its presence in a package says nothing about a switch, and counting it would
 * fail production for the portal's own text.
 */
const THE_PORTALS_OWN_WORDS = [
  JSON.stringify([sr, en]),
  /* And its code, the switches' own files and their words excepted: a short word that is a
     sentence of a switch is also the start of a name of the portal's (`Role` in `RoleProvider`),
     and a package that carries that name carries the word. */
  ...sources()
    .filter((one) => !CONTROL_FILES.some((file) => named(one.path) === file))
    .map((one) => one.code),
].join('\n')
const THEIR_OWN_SENTENCES = [
  ...new Set([...sentencesOf(DEV_WORDS.sr), ...sentencesOf(DEV_WORDS.en)]),
].filter((one) => !THE_PORTALS_OWN_WORDS.includes(one))

/**
 * What each switch is called: the name of the file it is written in, which is also the name the
 * loader hands it out under and the shell reads it by (`dev/tools.ts`).
 */
const THEIR_NAMES = CONTROLS.map((control) => basename(control, extname(control)))

/**
 * The name of the slot a moved day is kept in (`clock/ClockProvider.tsx`). It is not part
 * of either switch but of the clock every screen reads, which is in production by design, so
 * it is asked for as a word: the code that reads and writes it is what must not be there.
 */
const THE_SLOT = 'btl.simulated-day'

/**
 * THE ONE PLACE THE WORDS „TREBA POPUNITI" MAY STAND IN A PRODUCTION PACKAGE, and why.
 *
 * <p>`components/Markdown.tsx` asks whether a piece of code in a written page begins with
 * them, so that a blank the owner has still to fill in keeps looking like a note on a public
 * page rather than turning into quiet prose (Markdown.css, owner 03.08.2026). That is the
 * renderer looking FOR the words, not the words standing in a page, and it is the reverse of
 * what A15 is about. Every other place they might stand is counted.
 */
const THE_RENDERER_LOOKING_FOR_THEM = /startsWith\((["'`])\[TREBA POPUNITI\1\)/

describe('the production package (ADL A15)', () => {
  let production: Package
  let qa: Package

  beforeAll(async () => {
    production = await packageBuilt(false)
    qa = await packageBuilt(true)
  }, SLOW)

  it('is asked about something: the loader names at least one switch, and a stylesheet comes with them', () => {
    expect(CONTROLS.length).toBeGreaterThan(0)
    expect(THEIR_PARTS.filter((one) => one.endsWith('.css')).length).toBeGreaterThan(0)
  })

  it('carries no part of either switch, every one of which QA carries', () => {
    expect(THEIR_PARTS.filter((part) => !qa.modules.has(part))).toEqual([])
    expect(THEIR_PARTS.filter((part) => production.modules.has(part))).toEqual([])
  })

  it('carries the name of neither switch, which QA carries of both', () => {
    const standingIn = (one: Package) =>
      THEIR_NAMES.map((name) => ({ name, times: timesIn(one.text, name) }))

    /* The floor first, as above: a name QA does not carry has gone out of date, and a count of
       none in production would then be a count over nothing. */
    expect(standingIn(qa).filter((one) => one.times === 0)).toEqual([])
    expect(standingIn(production).filter((one) => one.times > 0)).toEqual([])
  })

  it('carries no book of words of either switch, every one of which QA carries', () => {
    /* The floor first: a reader and at least two books, or this is a question over nothing. */
    expect(THEIR_WORDS.length).toBeGreaterThanOrEqual(3)
    expect(THEIR_WORDS.filter((part) => !qa.modules.has(part))).toEqual([])
    expect(THEIR_WORDS.filter((part) => production.modules.has(part))).toEqual([])
  })

  it('carries none of the names the switches ask their words for, which QA carries of all', () => {
    expect(THE_NAMES_THEY_ASK_FOR).toEqual(
      expect.arrayContaining(['clock.label', 'clock.reset', 'role.label', 'role.moderator', 'server.named']),
    )

    const standingIn = (one: Package) =>
      THE_NAMES_THEY_ASK_FOR.map((name) => ({ name, times: timesIn(one.text, name) }))

    expect(standingIn(qa).filter((one) => one.times === 0)).toEqual([])
    expect(standingIn(production).filter((one) => one.times > 0)).toEqual([])
  })

  it('carries none of the sentences only the switches say, which QA carries of all', () => {
    /* A floor of the four that were measured to stand in the production package on 09.10.2026
       (one of them in each language), so a filter that came to keep nothing cannot pass. */
    expect(THEIR_OWN_SENTENCES).toEqual(
      expect.arrayContaining([
        'Današnji datum',
        'Vrati na stvarni datum',
        "Today's date",
        'Back to the real date',
      ]),
    )

    const standingIn = (one: Package) =>
      THEIR_OWN_SENTENCES.map((text) => ({ text, times: timesIn(one.text, text) }))

    expect(standingIn(qa).filter((one) => one.times === 0)).toEqual([])
    expect(standingIn(production).filter((one) => one.times > 0)).toEqual([])
  })

  it('carries no code that reads or writes the slot a moved day is kept in', () => {
    expect(timesIn(qa.text, THE_SLOT)).toBeGreaterThan(0)
    expect(timesIn(production.text, THE_SLOT)).toBe(0)
  })

  it('says TREBA POPUNITI nowhere but where the renderer looks for it', () => {
    /* The exception has to stand where it says it stands, or it excuses nothing. */
    expect(source('components/Markdown.tsx')).toMatch(THE_RENDERER_LOOKING_FOR_THEM)
    expect(THE_RENDERER_LOOKING_FOR_THEM.test(production.text)).toBe(true)

    const elsewhere = production.text.replace(
      new RegExp(THE_RENDERER_LOOKING_FOR_THEM.source, 'g'),
      '',
    )

    expect(timesIn(elsewhere, 'TREBA POPUNITI')).toBe(0)
  })
})
