import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * WHAT NGINX IS TOLD ABOUT SIGNING IN, read out of the file that tells it.
 *
 * **Why this file exists at all.** On 13.09.2026 a security review measured that
 * `/api/sign-in` becomes reachable from the internet for the first time: QA had sat
 * behind basic auth, production has no such door. Signing in costs a full BCrypt even
 * when no such account exists - deliberately, so a faster answer cannot tell an
 * attacker which addresses are real - and it does that inside a transaction holding a
 * row lock, with ten connections in the pool. A few dozen requests a second do not
 * slow signing in down, they stop the portal.
 *
 * A rate limit was added for that. It was then pointed out that it had **no reader**:
 * delete the directive and both CI jobs stay green, because nothing in this repository
 * opens `nginx.conf` except a check that it carries no invisible characters. That is
 * the same shape as the hole found the same morning in `PostmanTest`, which named one
 * compose file and therefore measured neither the other one nor the next.
 *
 * **What is asserted here is a property, not a list.** Nothing below names a number of
 * requests or a burst: those are a judgement that may change. What may not change is
 * that the expensive path is limited at all, and that the limit is keyed on the
 * VISITOR rather than on the proxy.
 */
describe('what nginx is told about signing in', () => {
  /* Rooted the way every other guard over these files is: vitest runs with `frontend`
     as the working directory, and `controlBytes.test.ts` reads the same two files so. */
  const conf = readFileSync(join(process.cwd(), 'nginx.conf'), 'utf8')

  /** One `location` block, taken from its brace to the one that closes it. */
  function block(path: string): string {
    const head = conf.indexOf(`location = ${path} {`)
    expect(head, `nginx.conf has no exact location for ${path}`).toBeGreaterThan(-1)

    let depth = 0
    for (let at = conf.indexOf('{', head); at < conf.length; at += 1) {
      if (conf[at] === '{') depth += 1
      if (conf[at] === '}') {
        depth -= 1
        if (depth === 0) return conf.slice(head, at + 1)
      }
    }

    throw new Error(`the location for ${path} is never closed`)
  }

  it('limits the one request that costs a full bcrypt', () => {
    expect(block('/api/sign-in')).toMatch(/\blimit_req\s+zone=/)
  })

  /**
   * AND EVERY WAY TO THE BACKEND GOES THROUGH A LOCATION THIS FILE KNOWS ABOUT.
   *
   * Found rather than listed: a third location proxying to the backend without a limit
   * would be a second door to the same expensive path, and naming the two that exist
   * today would not notice it. The snippet is the thing every such location has to
   * include, so counting its includes counts the doors.
   */
  it('has no way to the backend this file does not know about', () => {
    const doors = [...conf.matchAll(/location\s*(=?)\s*(\S+)\s*\{[^}]*nginx-to-backend\.conf/g)].map(
      (one) => `${one[1] ?? ''}${one[2] ?? ''}`,
    )

    expect(doors, 'nothing proxies to the backend, so this measures nothing').not.toHaveLength(0)
    expect(new Set(doors)).toEqual(new Set(['=/api/sign-in', '/api/']))
  })

  /**
   * AND THE LIMIT IS KEYED ON THE VISITOR, NOT ON THE PROXY.
   *
   * This is the half that would turn the fix into a worse fault, and it is asserted as
   * an implication rather than as a line: nothing publishes a port for this container,
   * so the address of the connection is always the edge proxy. A limit keyed on
   * `$binary_remote_addr` therefore only means the visitor if this file is also told to
   * take the address off `X-Forwarded-For`. Without that, every visitor in the world
   * shares one bucket and the seventh of them is refused.
   */
  it('reads the real address whenever it limits by address', () => {
    const byAddress = conf.includes('limit_req_zone $binary_remote_addr')

    expect(byAddress, 'no limit is keyed on an address, so this measures nothing').toBe(true)
    expect(conf).toMatch(/^\s*real_ip_header\s+X-Forwarded-For;/m)
    expect(conf, 'the forwarded address is trusted from anywhere at all').toMatch(
      /^\s*set_real_ip_from\s+\d+\.\d+\.\d+\.\d+\/\d+;/m,
    )
  })

  /**
   * AND WHAT THE FILE INCLUDES IS WHAT THE IMAGE CARRIES.
   *
   * An include that never reached the image is an nginx that refuses to start, which is
   * loud rather than silent - but it is loud on the production host, after a deploy,
   * and this costs one line here instead.
   */
  it('is built into an image that carries every file it includes', () => {
    const dockerfile = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf8')
    const included = [...conf.matchAll(/include\s+\/etc\/nginx\/([^\s;]+);/g)].map((one) => one[1])

    expect(included, 'nginx.conf includes nothing, so this measures nothing').not.toHaveLength(0)
    for (const file of included) {
      expect(dockerfile, `the image never copies ${file}`).toContain(`/etc/nginx/${file}`)
    }
  })
})
