import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import held from './serverConfig.snapshot.json'

/**
 * WHAT THE SERVER IN FRONT OF THE PORTAL IS TOLD, HELD AS IT STANDS.
 *
 * **Why a snapshot, which is the third answer to this question.** On 13.09.2026
 * `/api/sign-in` became reachable from the internet for the first time and was given a
 * rate limit, because signing in costs a full bcrypt even when no such account exists.
 * The limit had no reader at all. It was then given one that asked questions of the
 * file - is the expensive path limited, are these the only doors, is the real address
 * read - and the next review took that apart three ways in one round, every one the
 * same mistake: a directive commented out satisfies a search for its text; a `location`
 * written `^~` is a door the pattern never sees; a trusted range of `203.0.113.7/32` is
 * the right SHAPE and the wrong network. A guard that reads a configuration as text has
 * to be right about every way the text can be written, and it never is.
 *
 * **And why THREE files rather than the two it started with.** The round after that
 * measured the hole in the first draft of this very snapshot: it held the two
 * configuration files, while what nginx actually reads is decided by the Dockerfile.
 * `include conf.d/*.conf` is sorted, so one added line -
 * `COPY nginx-open.conf /etc/nginx/conf.d/00-open.conf` - makes an unlimited server the
 * default for port 80 and the held files are never used for traffic. Measured on a real
 * nginx: twelve requests answered 200 twelve times instead of six and then 429, with
 * nothing in the log and the whole frontend gate green.
 *
 * **What this therefore claims, exactly:** that nobody changes what nginx is told
 * WITHOUT MEANING TO. Comment a line out, widen a trusted range, add a door, drop the
 * limit, copy a second configuration in beside it - each is a changed file, and a
 * changed file stops the gate and asks for a deliberate act.
 *
 * **And what it does not claim, written down rather than left to be found:**
 *
 * 1. It does not know whether a change is RIGHT. Whoever updates the held text is the
 *    person who has to answer that, and the paragraphs above are what they should read
 *    first.
 * 2. It cannot know whether the trusted ranges match the network Docker hands out,
 *    because that is decided at run time and exists nowhere in the source.
 * 3. It does not reach `deploy/compose.prod.yml`, and one sentence in `nginx.conf`
 *    depends on it: trusting `X-Forwarded-For` from private ranges is safe only while
 *    the Docker network is the only way in. That is not left hanging - the case at the
 *    bottom of this file asserts it - but the snapshot is not what asserts it.
 */
describe('what the server in front of the portal is told', () => {
  const files = ['nginx.conf', 'nginx-to-backend.conf', 'Dockerfile'] as const

  it('says exactly what it said, to the character', () => {
    const now = Object.fromEntries(
      files.map((name) => [name, readFileSync(join(process.cwd(), name), 'utf8').split(/\r?\n/)]),
    )

    expect(now).toEqual(held)
  })

  /**
   * AND NOTHING IN PRODUCTION PUBLISHES A PORT.
   *
   * The sentence this holds up is in `nginx.conf`: the address of a connection is always
   * the edge proxy, so the visitor's address is taken off `X-Forwarded-For` and trusted
   * from the private ranges Docker hands out. That is safe for exactly as long as the
   * Docker network is the only way in.
   *
   * Publish a port on the frontend and it stops being true in the worst way: a visitor
   * arriving directly is a private-range peer, so their forwarded header is believed,
   * and the rate limit is bypassed by sending one. Measured by a review on 13.09.2026 -
   * twenty requests with a rotated forwarded address, twenty times 200.
   *
   * Read off the file rather than listed, so a service added tomorrow is covered.
   */
  it('publishes no port in production, which is what makes the forwarded address safe', () => {
    const compose = readFileSync(join(process.cwd(), '..', 'deploy', 'compose.prod.yml'), 'utf8')
    const withoutComments = compose.replace(/^\s*#.*$/gm, '')

    expect(withoutComments, 'the production stack is empty, so this measures nothing').toContain(
      'services:',
    )
    expect(withoutComments, 'a production service publishes a port; the forwarded address is'
      + ' trusted from private ranges and a direct visitor is one').not.toMatch(/^\s*ports:/m)
  })

  /**
   * AND `.env.example` SHIPS NO VALUE THAT IS NOT ALREADY A PUBLIC DEFAULT.
   *
   * A security review measured what one placeholder costs: the file said
   * `PROD_POSTGRES_PASSWORD=change-me`, the runbook says `cp ../.env.example .env`, and
   * the `:?` guard meant to refuse an unset password therefore never fired. A production
   * database would have started with a password published on GitHub, and `initdb` sets a
   * role's password only on an empty volume, so editing the file later does not change
   * it - it only breaks the connection.
   *
   * **The first floor written for that was a list of five suffixes**, and the next round
   * walked past it with `PROD_BREVO_APIKEY=xkeysib-...`, where the suffix does not match.
   * So the question changed: rather than guessing which names are secrets, every value
   * in the example must be one the compose files ALREADY publish as a default. A real
   * default (`btl`, `587`, the relay host) is in both places; a secret is in neither,
   * and must therefore be empty.
   */
  it('ships no value that the compose files do not already publish', () => {
    const example = readFileSync(join(process.cwd(), '..', '.env.example'), 'utf8')
    const composes = ['deploy/compose.prod.yml', 'deploy/compose.qa.yml', 'docker-compose.yml']
      .map((one) => readFileSync(join(process.cwd(), '..', one), 'utf8'))
      .join('\n')

    const defaults = new Map(
      [...composes.matchAll(/\$\{([A-Z0-9_]+):-([^}]*)\}/g)].map((one) => [one[1], one[2]]),
    )

    expect(defaults.size, 'no compose file offers a default, so this measures nothing')
      .toBeGreaterThan(0)

    const assignments = [...example.matchAll(/^([A-Z0-9_]+)=(.*)$/gm)]

    expect(assignments, 'the example file assigns nothing, so this measures nothing').not
      .toHaveLength(0)

    for (const [, name, value] of assignments) {
      if (String(value) === '') {
        continue
      }

      expect(
        defaults.get(String(name)),
        `${String(name)} ships a value no compose file offers as a default, so it is a secret`
          + ' or a guess; leave it empty and let the stack refuse to start',
      ).toBe(String(value))
    }
  })
})
