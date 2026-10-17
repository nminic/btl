import { useCallback, useEffect, useState } from 'react'
import type { ResourceState } from '../../data/useResource'
import { whatTheServerSaysOfMyMailLanguage } from '../../session/theServer'
import type { MailLanguage } from './mailLanguage'

type Heard = { asked: string; language: MailLanguage | null }

/**
 * The language the server says the signed in account's mail is written in, with the way to ask
 * again when it could not be read.
 *
 * <p>`GET /api/me` answers it for every kind of account there is - a member whose fee stands, one
 * whose fee has lapsed, somebody who has not paid and an account that races for nobody - because the
 * language of the mail is a setting of the account and not a right of a competitor (PDL, the answers
 * of 17.10.2026). It is read off the answer whole and not through the session, which keeps none of
 * it: the session is what the portal knows about WHO is signed in, and this is something the reader
 * can change.
 *
 * <p><b>Held by whoever it was asked for</b>, and this is the arrangement `useMyData` makes for the
 * same reason. `asked` names the reader (his member number, or his account where he has none); an
 * answer that arrived for somebody else is not an answer to this, so a second person signing in
 * beside the first on a shared laptop is shown the loader and then his own language, never the first
 * man's.
 *
 * <p>`readAgain` is the portal's usual: the request goes out again, `reading` says it has, and the
 * read that failed is not shown as a language.
 */
export function useMyMailLanguage(asked: string): ResourceState<MailLanguage> {
  const [heard, setHeard] = useState<Heard | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [reading, setReading] = useState(false)

  useEffect(() => {
    let stillHere = true

    void whatTheServerSaysOfMyMailLanguage().then((said) => {
      /* An answer that arrives after the reader has gone, or after he has been replaced by
         somebody else, is not drawn. */
      if (!stillHere) {
        return
      }

      setHeard({ asked, language: said })
      setReading(false)
    })

    return () => {
      stillHere = false
    }
  }, [asked, attempt])

  const readAgain = useCallback(() => {
    setReading(true)
    setAttempt((one) => one + 1)
  }, [])

  if (heard === null || heard.asked !== asked) {
    return { status: 'loading' }
  }

  if (heard.language === null) {
    return {
      status: 'error',
      error: new Error('The language of his mail could not be read'),
      readAgain,
      reading,
    }
  }

  return { status: 'ready', data: heard.language }
}
