import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * THE POLICY IN `nginx.conf` AND THE PAGE IT GOVERNS, HELD TOGETHER.
 *
 * <p>`index.html` carries no inline script since 24.11.2026: the one it had set the theme before the
 * first paint, and it left with the light theme (PDL „Portal ima samo tamnu temu; svetla se
 * izbacuje"), and its digest left `script-src` with it. A script put back into the page would be refused
 * by every browser while every test of the screens stayed green, because no test runs a policy. This is
 * the only thing that reads both files.
 *
 * <p><b>The digest of a script is taken with the lines ending in LF</b>, which is how the image is built
 * (on Linux, out of git) and not how a Windows checkout holds the file. Measured 21.11.2026: the script
 * production served was 760 bytes and the one on this disk 772, twelve carriage returns apart, and only
 * the first digest is the one a browser compares.
 *
 * <p><b>Both directions</b>: every inline script has its digest in `script-src`, and every digest in
 * `script-src` belongs to a script that is still there, so a script taken out does not leave a
 * permission behind it. Today both sets are empty, and the floor below says so, so that a pattern which
 * stopped matching is not read as „no inline script".
 */
const conf = readFileSync(join(process.cwd(), 'nginx.conf'), 'utf8')
  .split(/\r?\n/)
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n')

const page = readFileSync(join(process.cwd(), 'index.html'), 'utf8').replace(/\r\n/g, '\n')

function thePolicy(): string {
  const declared = /map \$host \$btl_content_security_policy \{\s*default "([^"]+)";\s*\}/.exec(conf)

  expect(declared, 'nginx.conf declares no $btl_content_security_policy').not.toBeNull()

  return String(declared?.[1])
}

function directive(name: string): string[] {
  const found = thePolicy()
    .split(';')
    .map((one) => one.trim().split(/\s+/))
    .find((words) => words[0] === name)

  expect(found, `the policy has no ${name}`).toBeDefined()

  return (found ?? []).slice(1)
}

/** Every `<script>` without a `src`, as the browser reads its text. */
function inlineScripts(): string[] {
  return [...page.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((one) => one[1] ?? '')
}

describe('the content security policy', () => {
  it('allows the inline scripts of index.html by their digest, and nothing else inline', () => {
    const scripts = inlineScripts()

    /* A floor, so that a pattern which stopped matching cannot pass as „no inline script": the page
       has exactly one script, the module, and the pattern has to see it as one that is not inline. */
    expect([...page.matchAll(/<script\b/g)], 'index.html carries one script, the module').toHaveLength(1)
    expect(page, 'the one script is the module of the portal').toMatch(/<script type="module" src="\/src\/main\.tsx"><\/script>/)
    expect(scripts, 'index.html carries a script inline').toEqual([])

    const digests = scripts.map(
      (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`,
    )
    const allowed = directive('script-src').filter((source) => source.startsWith("'sha256-"))

    expect(allowed.sort()).toEqual(digests.sort())
  })

  it('carries no inline allowance and no eval, anywhere in it', () => {
    expect(thePolicy()).not.toMatch(/unsafe-inline|unsafe-eval|unsafe-hashes|strict-dynamic/)
  })

  it('denies by default and names only the portal itself, and data: for pictures', () => {
    expect(directive('default-src')).toEqual(["'none'"])
    expect(directive('script-src').filter((one) => !one.startsWith("'sha256-"))).toEqual(["'self'"])
    expect(directive('style-src')).toEqual(["'self'"])
    expect(directive('img-src')).toEqual(["'self'", 'data:'])
    expect(directive('connect-src')).toEqual(["'self'"])
    expect(directive('frame-ancestors')).toEqual(["'none'"])
    expect(directive('object-src')).toEqual(["'none'"])
    expect(directive('base-uri')).toEqual(["'none'"])
  })
})
