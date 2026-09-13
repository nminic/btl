import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import held from './serverConfig.snapshot.json'

/**
 * WHAT THE SERVER IN FRONT OF THE PORTAL IS TOLD, HELD AS IT STANDS.
 *
 * **Why a snapshot and not a set of questions, which is the third answer to this.**
 * On 13.09.2026 `/api/sign-in` became reachable from the internet for the first time
 * and was given a rate limit, because signing in costs a full bcrypt even when no such
 * account exists. The limit had no reader at all, which a review found. It was then
 * given one that asked questions of the file: is the expensive path limited, are these
 * the only doors to the backend, is the real address read. The next review took that
 * guard apart three ways in one round, and every one of them was the same mistake:
 *
 *   - a directive commented out satisfies a search for its text;
 *   - a `location` written with `^~` or `~` is a door the pattern never sees;
 *   - a trusted range of `203.0.113.7/32` is the right SHAPE and the wrong network.
 *
 * A guard that reads a configuration file as text has to be right about every way the
 * file can be written, and it never is. This repository has already paid for that
 * lesson twice, and the recorded answer is the one taken here: when a guard has to
 * enumerate forms, hold the whole text against a golden one instead of adding another
 * branch.
 *
 * **What this therefore claims, exactly:** that nobody changes what nginx is told
 * WITHOUT MEANING TO. Comment a line out, widen a trusted range, add a second way to
 * the backend, drop the limit - each is a changed file, and a changed file stops the
 * gate and asks for a deliberate act.
 *
 * **And what it does not claim, written down rather than left to be found:** it does
 * not know whether a change is RIGHT. Whoever updates the held text is the person who
 * has to answer that, and the sentence above is what they should read first. In
 * particular no guard in this repository can know whether the trusted ranges match the
 * network Docker actually hands out, because that is decided at run time and exists
 * nowhere in the source.
 */
describe('what the server in front of the portal is told', () => {
  const files = ['nginx.conf', 'nginx-to-backend.conf'] as const

  it('says exactly what it said, to the character', () => {
    const now = Object.fromEntries(
      files.map((name) => [name, readFileSync(join(process.cwd(), name), 'utf8').split(/\r?\n/)]),
    )

    expect(now).toEqual(held)
  })

  /**
   * AND NO SECRET IN `.env.example` CARRIES A VALUE THAT WOULD WORK.
   *
   * A security review measured on 13.09.2026 what one placeholder costs: the file said
   * `PROD_POSTGRES_PASSWORD=change-me`, the runbook says `cp ../.env.example .env`, and
   * the `:?` guard that is supposed to refuse an unset password therefore never fired.
   * A production database would have started with a password published on GitHub, and
   * `initdb` sets a role's password only on an empty volume, so editing the file later
   * does not change it - it only breaks the connection.
   *
   * That was emptied, and an hour later a second review pointed out the obvious: the
   * fix was a value with no case, and the whole file had no reader at all.
   *
   * **Derived, so there is no list to fall behind.** Every assignment in the file whose
   * name ends in the words a secret is called by has to end at the equals sign. A new
   * one added tomorrow is covered without anybody remembering to add it.
   */
  it('ships no secret with a value that would work', () => {
    const example = readFileSync(join(process.cwd(), '..', '.env.example'), 'utf8')
    const assignments = [...example.matchAll(/^([A-Z0-9_]+)=(.*)$/gm)]

    expect(assignments, 'the example file assigns nothing, so this measures nothing').not
      .toHaveLength(0)

    const secrets = assignments.filter(([, name]) => /_(PASSWORD|USERNAME|KEY|TOKEN|SECRET)$/
      .test(String(name)))

    expect(secrets, 'the file names no secret at all, so this measures nothing').not.toHaveLength(0)

    for (const [, name, value] of secrets) {
      expect(String(value), `${String(name)} ships a value; a placeholder walks through the`
        + ' guard that is meant to refuse an unset one').toBe('')
    }
  })

  /**
   * AND THE IMAGE CARRIES EVERY FILE THE CONFIGURATION INCLUDES.
   *
   * The one claim a snapshot of these two files cannot make, because it is about a
   * third. An include that never reached the image is an nginx that refuses to start,
   * which is loud - but loud on the production host, after a deploy, and this costs one
   * line here instead.
   */
  it('is built into an image that carries every file it includes', () => {
    const conf = readFileSync(join(process.cwd(), 'nginx.conf'), 'utf8')
    const dockerfile = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf8')
    const included = [...conf.matchAll(/include\s+\/etc\/nginx\/([^\s;]+);/g)].map((one) => one[1])

    expect(included, 'nginx.conf includes nothing, so this measures nothing').not.toHaveLength(0)
    for (const file of included) {
      expect(dockerfile, `the image never copies ${file}`).toContain(`/etc/nginx/${file}`)
    }
  })
})
