import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Competitor } from '../data/types'
import { CARD_MARK } from '../pages/profile/cardMark'
import { profilePath } from '../pages/profileAddress'
import held from './serverConfig.snapshot.json'

/** A member whose address `profilePath` writes, for the location that has to match it. */
const someone: Competitor = {
  memberNumber: '000127',
  firstName: 'Nikola',
  lastName: 'Minić',
  gender: 'M',
  city: 'Beograd',
  country: 'RS',
  category: { season: 2027, ageBand: '40-54', beginner: false },
  categories: [{ season: 2027, ageBand: '40-54', beginner: false }],
  firstSeason: 2027,
  membershipBasis: 'payment',
  teamId: null,
  teamSince: null,
  profileHidden: false,
  birthdayShown: 'none',
  photo: null,
  smallPhoto: null,
  crop: null,
  bio: '',
}

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
   * AND CHANGING A PASSWORD IS LIMITED TOO, BY A ZONE OF ITS OWN.
   *
   * `PUT /api/me/password` hashes with BCrypt inside a transaction that holds a row lock, so ten
   * parallel requests from ONE signed-in member hold the whole connection pool (a review of
   * 470). The snapshot above would stop the day this limit is removed, but only to ask for a
   * deliberate act; this case is what the act has to still satisfy: an exact-match location
   * for the route, carrying a `limit_req` of a zone that is declared. Comments are removed
   * first, so a commented-out line satisfies nothing.
   */
  it('limits changing a password with a zone that exists', () => {
    const conf = readFileSync(join(process.cwd(), 'nginx.conf'), 'utf8')
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n')
    const block = /location\s+=\s+\/api\/me\/password\s*\{([^}]*)\}/.exec(conf)

    expect(block, 'no exact-match location for /api/me/password').not.toBeNull()

    const used = /limit_req\s+zone=(\w+)\s/.exec(String(block?.[1]))

    expect(used, 'the location for /api/me/password carries no limit_req').not.toBeNull()
    expect(
      new RegExp(`limit_req_zone\\s+\\$btl_client\\s+zone=${String(used?.[1])}:\\d+m\\s+rate=\\d+r/m;`)
        .test(conf),
      `the zone ${String(used?.[1])} is not declared`,
    ).toBe(true)
  })

  /**
   * AND THE CARD A PROFILE IS SHARED WITH IS LIMITED TOO, BY A ZONE OF ITS OWN.
   *
   * `GET /api/cards/competitor/...` is open to anybody and draws a picture of 1200 by 630 out of
   * the list of members, so a loop over names of the right shape is a loop of work for the
   * processor (`CompetitorCards`). The snapshot above stops the day the limit goes; this is what
   * the deliberate act has to still satisfy: a PREFIX location for the folder every card is under
   * (every card has its own address, so an exact match would limit none of them), carrying a
   * `limit_req` of a zone that is declared. Comments are removed first, as above.
   */
  it('limits the shared cards with a zone that exists', () => {
    const conf = readFileSync(join(process.cwd(), 'nginx.conf'), 'utf8')
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n')
    const block = /location\s+\/api\/cards\/\s*\{([^}]*)\}/.exec(conf)

    expect(block, 'no prefix location for /api/cards/').not.toBeNull()

    const used = /limit_req\s+zone=(\w+)\s/.exec(String(block?.[1]))

    expect(used, 'the location for /api/cards/ carries no limit_req').not.toBeNull()
    expect(used?.[1], 'the cards share a zone with something else').toBe('cards')
    expect(
      new RegExp(`limit_req_zone\\s+\\$btl_client\\s+zone=${String(used?.[1])}:\\d+m\\s+rate=\\d+r/m;`)
        .test(conf),
      `the zone ${String(used?.[1])} is not declared`,
    ).toBe(true)
    expect(String(block?.[1]), 'the cards never reach the backend').toContain('nginx-to-backend.conf')
  })

  /**
   * AND THE PROFILE OF A MEMBER IS SENT WITH WHAT A NETWORK SHOWS FOR IT, OR WITH THE FRONT PAGE'S.
   *
   * Owner, PDL P11, 15.11.2026: a profile pasted into Viber, WhatsApp or Facebook shows the member's
   * card and the title „{ime i prezime} u Balkanskoj trkačkoj ligi”. Those networks run no script,
   * so the page nginx sends is all they read, and three things have to hold for it to say that:
   *
   * 1. the location that matches the address of a profile turns SSI on, and matches exactly the
   *    addresses `profilePath` writes and the ones the profile still opens (the number alone, a
   *    slash on the end), and not the tabs under it;
   * 2. `index.html` asks for the block by the variables that location captures, and names as its
   *    stub the block the front page's own tags are written in;
   * 3. the folder asked is `internal`, and every error on the way to it, the backend's and nginx's,
   *    is turned into an answer with no body, because SSI uses the stub only for an EMPTY answer:
   *    measured on nginx 1.29 on 15.11.2026, a 404 or a 500 with a body, and nginx's own 502 page
   *    with the backend down, went into the head of the page as they were.
   *
   * The pattern is asked as a pattern, by JavaScript, which reads `(?<name>...)` as PCRE does.
   * Comments are removed first, as above.
   */
  it('fills the profile from the backend and puts the front page back when it says nothing', () => {
    const conf = readFileSync(join(process.cwd(), 'nginx.conf'), 'utf8')
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n')
    const page = readFileSync(join(process.cwd(), 'index.html'), 'utf8')

    const profile = /location\s+~\s+"([^"]*takmicar[^"]*)"\s*\{([^}]*)\}/.exec(conf)

    expect(profile, 'no location matches the address of a profile').not.toBeNull()
    expect(String(profile?.[2]), 'the profile location does not turn SSI on').toMatch(/^\s*ssi on;/m)
    expect(String(profile?.[2]), 'the profile location does not send index.html').toMatch(
      /try_files \/index\.html =404;/,
    )

    const matches = new RegExp(String(profile?.[1]))
    const read = (address: string) => {
      const groups = matches.exec(address)?.groups

      return groups === undefined ? null : Object.values(groups).join(' ')
    }

    expect(read(profilePath(someone, 'sr'))).toBe('sr 000127')
    expect(read('/en/takmicar/000127-nikola-minic')).toBe('en 000127')
    expect(read('/sr/takmicar/000127')).toBe('sr 000127')
    expect(read('/sr/takmicar/000127-nikola-minic/')).toBe('sr 000127')
    for (const elsewhere of ['/sr/takmicar/000127-nikola-minic/priznanja', '/sr/takmicar/000127/podaci',
      '/sr/takmicar/00012', '/sr/takmicar/0001278', '/de/takmicar/000127', '/sr/takmicari',
      '/sr/kalendar/000127']) {
      expect(read(elsewhere), `${elsewhere} is not the address of a profile`).toBeNull()
    }

    /* AND THE MARK OF HIS CARD IN THE ADDRESS OF HIS OWN PROFILE CHANGES NOTHING HERE (owner, PDL P11,
       16.11.2026, point 15: `?k=268f`, `pages/profile/cardMark.ts`). nginx matches a location against
       the path of a request and never its query, so the marked address is this location as the clean
       one is; measured on nginx 1.29 on 16.11.2026, with a backend that echoed what it was asked: the
       address with `?k=268f&sezona=2027&duzina=half` asked for `/api/previews/competitor/000127-sr`
       with no query, to the character the clean address did. What could still carry the query into
       the page is a variable, so none of the three texts that build it may name one: the location,
       the include in index.html and the folder it asks. */
    const marked = new URL(`${profilePath(someone, 'sr')}?${CARD_MARK}=268f&sezona=2027`, 'https://balkanskatrkackaliga.net')

    expect(read(marked.pathname)).toBe('sr 000127')
    expect(marked.searchParams.get(CARD_MARK)).toBe('268f')

    const theQuery = /\$(?:args|arg_\w+|query_string|request_uri|is_args)\b/
    const previewsBlock = /location\s+\/api\/previews\/\s*\{([^}]*)\}/.exec(conf)
    const asking = /<!--# include virtual="[^"]*"[^>]*-->/.exec(page)

    expect(previewsBlock, 'no location for the previews').not.toBeNull()
    expect(asking, 'index.html asks for no preview').not.toBeNull()
    for (const [what, text] of [
      ['the location of a profile', String(profile?.[0])],
      ['the include in index.html', String(asking?.[0])],
      ['the folder of the previews', String(previewsBlock?.[1])],
    ]) {
      expect(text, `${what} reads the query of the address`).not.toMatch(theQuery)
    }

    const names = [...String(profile?.[1]).matchAll(/\(\?<(\w+)>/g)].map((one) => String(one[1]))
    const include = /<!--# if expr="\$btl_preview_locale = en" -->\s*<!--# include virtual="\$btl_preview_path" stub="([\w-]+)" -->\s*<!--# else -->\s*<!--# include virtual="\$btl_preview_path" stub="([\w-]+)" -->\s*<!--# endif -->/
      .exec(page)

    expect(include, 'index.html asks for no preview').not.toBeNull()
    expect(names.sort()).toEqual(['btl_preview_locale', 'btl_preview_number'])
    expect(String(profile?.[2]), 'the profile location asks for the folder of the backend').toContain(
      'set $btl_preview_path /api/previews/competitor/$btl_preview_number-$btl_preview_locale;',
    )

    /* THE FRONT PAGE'S BLOCK IN BOTH LANGUAGES (owner, 21.11.2026): the Serbian one is the stub of
       everything but `en`, the English one of `en`, and both carry every tag a network reads. */
    const blocks = new Map<string, string>()

    for (const [which, language, locale, other] of [
      [String(include?.[2]), 'sr', 'sr_RS', 'en_US'],
      [String(include?.[1]), 'en', 'en_US', 'sr_RS'],
    ] as const) {
      const block = new RegExp(
        `<!--# block name="${which}" -->([\\s\\S]*?)<!--# endblock -->`,
      ).exec(page)

      expect(block, `the stub of ${language} names a block index.html does not define`).not.toBeNull()
      expect(String(block?.[1]), 'the stub is not the front page\'s own block').toContain(
        '<meta property="og:image" content="https://balkanskatrkackaliga.net/icon-512.png" />',
      )
      expect(String(block?.[1])).toMatch(/<title>[^<]+<\/title>/)
      expect(String(block?.[1]), `og:locale of ${language}`).toContain(
        `<meta property="og:locale" content="${locale}" />`,
      )
      expect(String(block?.[1]), `og:locale:alternate of ${language}`).toContain(
        `<meta property="og:locale:alternate" content="${other}" />`,
      )
      blocks.set(language, String(block?.[1]))
    }

    expect(blocks.get('sr'), 'both languages read the same block').not.toBe(blocks.get('en'))
    expect(page.indexOf('<!--# if expr'), 'the include stands before the blocks it names')
      .toBeGreaterThan(page.lastIndexOf('<!--# endblock -->'))

    const english = /location\s+~\s+"(\^\/en[^"]*)"\s*\{([^}]*)\}/.exec(conf)

    expect(english, 'no location for the English addresses').not.toBeNull()
    expect(String(english?.[2])).toMatch(/^\s*ssi on;/m)
    expect(String(english?.[2])).toMatch(/set \$btl_preview_locale en;/)
    expect(String(english?.[2])).toMatch(/set \$btl_preview_path \/previews\/none;/)
    expect(conf.indexOf(String(english?.[0])), 'a profile under /en is matched by its own location first')
      .toBeGreaterThan(conf.indexOf(String(profile?.[0])))
    const fallback = /location\s+=\s+\/index\.html\s*\{([^}]*)\}/.exec(conf)

    expect(fallback, 'the fallback has SSI off, so the English block would be read as live tags')
      .not.toBeNull()
    expect(String(fallback?.[1])).toMatch(/^\s*ssi on;/m)
    expect(String(fallback?.[1])).toMatch(/set \$btl_preview_path \/previews\/none;/)
    expect(String(fallback?.[1]), 'the fallback is told it is English').not.toMatch(/btl_preview_locale/)
    for (const address of ['/en', '/en/', '/en/kalendar', '/en/top-liste/x']) {
      expect(new RegExp(String(english?.[1])).test(address), address).toBe(true)
    }
    for (const address of ['/', '/sr', '/sr/kalendar', '/enx', '/entry', '/api/en']) {
      expect(new RegExp(String(english?.[1])).test(address), address).toBe(false)
    }

    const previews = /location\s+\/api\/previews\/\s*\{([^}]*)\}/.exec(conf)

    expect(previews, 'no location for the previews').not.toBeNull()
    expect(String(previews?.[1]), 'the previews can be asked for from outside').toMatch(/^\s*internal;/m)
    expect(String(previews?.[1])).toContain('nginx-to-backend.conf')
    expect(String(previews?.[1])).toMatch(/proxy_intercept_errors on;/)

    const errors = /error_page\s+([\d\s]+)=\s*@([\w-]+);/.exec(String(previews?.[1]))

    expect(errors, 'no error of the previews is turned into anything').not.toBeNull()
    const codes = String(errors?.[1]).trim().split(/\s+/)

    for (const code of ['301', '302', '400', '401', '403', '404', '500', '502', '503', '504']) {
      expect(codes, `a ${code} would be written into the head of the page`).toContain(code)
    }

    const named = new RegExp(`location\\s+@${String(errors?.[2])}\\s*\\{([^}]*)\\}`).exec(conf)

    expect(String(named?.[1]).trim(), 'an error is not turned into an answer with no body')
      .toBe('return 204;')
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
