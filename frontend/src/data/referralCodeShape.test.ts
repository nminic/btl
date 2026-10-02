import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REFERRAL_CODE } from './pricing'

/**
 * WHAT A REFERRAL CODE LOOKS LIKE IS THE SCHEMA'S, AND THE PORTAL'S COPY OF IT IS HELD TO THE SCHEMA HERE.
 *
 * <p><b>Why there is a copy at all, and why it has to be held.</b> `competitor_referral_code_shape`
 * (V7) is the rule: sixteen lowercase hexadecimal characters, checked at the moment a code is stored.
 * The portal asks the same question at two doors and off ONE constant, `REFERRAL_CODE` in
 * `data/pricing.ts`: the registration page asks it of a code that arrives in an address
 * (`pages/Registration.tsx`), and the session asks it of the code the server answers
 * (`session/theServer.ts`, `codeIn`). A copy that nothing ties to the rule survives the day the rule
 * moves, and what it does then is quiet: a member whose code the schema now holds in a new shape is
 * drawn a link with nothing after the sign, and a link that arrives in the new shape is not credited
 * to whoever sent it.
 *
 * <p><b>Measured on 02.10.2026, before this file existed.</b> Eight of nine ways of loosening the
 * constant (capitals allowed, any lowercase letter, twelve to sixteen characters, sixteen or more, no
 * end, no start, neither, any word character) left every address `Registration.test.tsx` sends reading
 * as it did. That was computed over those addresses and not run as a mutation; the rows of
 * `session/theServer.test.ts` that ask the reader about each kind of wrong shape close it from the
 * portal's side, and this file closes it from the schema's.
 *
 * <p><b>The server decides and this side copies</b>, which is the arrangement
 * `forms/passwordLength.test.ts` keeps for the length of a password and `forms/wholeNumbers.test.ts`
 * keeps for a column (it reads this very migration): the schema's text is read out of the migrations,
 * the Java class's out of `ReferralCode.java`, and the constant is held to both, in text. So the three
 * fall apart whichever of them moves.
 *
 * <p><b>EVERY migration is read, and not the one that defines the constraint.</b> A later migration may
 * redefine it (`drop constraint`, then `add constraint`), and a file that read only V7 would go on
 * holding the portal to a rule that is no longer the schema's. So the constraint must be named in
 * exactly one place across the whole folder, and a second mention, whatever it says, fails here until
 * somebody reads it and decides what this file compares.
 *
 * <p><b>A comparison of TEXT is a comparison of RULES only for a pattern both engines read alike</b>,
 * which is why the pattern is asked to be a character class, a count and the two anchors and nothing
 * else: PostgreSQL and JavaScript agree about those. The day the schema writes a lookahead or an
 * alternation the third case fails, and what it asks for is a person who writes the comparison again,
 * not an expression that happens to be equal as text.
 *
 * <p><b>No flag</b>, asked of the constant itself: a `g` or a `y` makes `test` remember where it
 * stopped, so the same code would be believed once and refused the next time, which no single case
 * about one code can see.
 */

const MAIN = join(process.cwd(), '..', 'backend', 'src', 'main')
const MIGRATIONS = join(MAIN, 'resources', 'db', 'migration')
const THE_CODE_CLASS = join(MAIN, 'java', 'com', 'btl', 'portal', 'domain', 'member', 'ReferralCode.java')

/** The one name the rule goes by in the schema. */
const CONSTRAINT = 'competitor_referral_code_shape'

/** What a definition of it looks like, and what stands between the quotation marks is the pattern. */
const DEFINITION = new RegExp(
  `constraint\\s+${CONSTRAINT}\\s+check\\s*\\(\\s*referral_code\\s*~\\s*'([^']*)'\\s*\\)`,
  'g',
)

/** Every migration of the folder, whole, so that a mention in any of them is seen. */
const MIGRATION_FILES = readdirSync(MIGRATIONS).filter((name) => /^V\d+__.*\.sql$/.test(name))
const SCHEMA = MIGRATION_FILES.map((name) => ({
  name,
  text: readFileSync(join(MIGRATIONS, name), 'utf-8'),
}))

/** Every place the name stands, ONE ENTRY PER OCCURRENCE and not one per file: a second mention in the
 *  very file that defines the constraint is as much a reason to read it as one in a later migration
 *  (measured: counted per file, a mention added to V7 beside its own definition went unseen). */
const MENTIONS = SCHEMA.flatMap(({ name, text }) =>
  Array.from({ length: text.split(CONSTRAINT).length - 1 }, () => name),
)
const DEFINED = SCHEMA.flatMap(({ name, text }) =>
  [...text.matchAll(DEFINITION)].map((one) => ({ name, pattern: one[1] ?? '' })),
)

describe('what a referral code looks like, in the schema and in the portal', () => {
  it('reads every migration, so that a mention in any of them is seen', () => {
    /* The floor under „the constraint is named in one place": a sweep narrowed to a file or two answers
       that with nothing, and it is then true of a folder nobody looked through. */
    expect(MIGRATION_FILES.length).toBeGreaterThan(1)
  })

  it('is named in exactly one place across all of them, and that place defines it', () => {
    expect(MENTIONS, 'the places that name the constraint, one per occurrence').toHaveLength(1)
    expect(DEFINED, 'the places that define it').toHaveLength(1)
    expect(DEFINED[0]?.name, 'the file that defines it is the file that names it').toBe(MENTIONS[0])
  })

  it('is a character class, a count and the two anchors, which both engines read alike', () => {
    expect(DEFINED[0]?.pattern ?? '').toMatch(/^\^\[[^\]\\]+\]\{\d+\}\$$/)
  })

  it('is the very text the portal asks, and the portal asks it with no flag', () => {
    expect(REFERRAL_CODE.source).toBe(DEFINED[0]?.pattern)
    expect(REFERRAL_CODE.flags).toBe('')
  })

  it('is the very text the Java class compiles', () => {
    const compiled = [
      ...readFileSync(THE_CODE_CLASS, 'utf-8').matchAll(/Pattern\.compile\("([^"]*)"\)/g),
    ]

    expect(compiled, 'the patterns ReferralCode.java compiles').toHaveLength(1)
    expect(compiled[0]?.[1]).toBe(REFERRAL_CODE.source)
  })
})
