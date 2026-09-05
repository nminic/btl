import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'

/**
 * What a screen shows after it has sent something, and what lies under it when the reader
 * presses the browser's own way back.
 *
 * **Why this exists at all.** Owner, 05.09.2026: „Back na pregledaču uvek treba da radi
 * tako da kad bi vratilo na formu koja je bila popunjena pa poslata, da se preskoči i vrati
 * još na smisleni nivo nazad. Primera radi Nazad sa potvrde poslatog rezultata treba da
 * vodi na formu Moji rezultati, a ne na formu za slanje rezultata." The four screens that
 * confirm a sending drew that confirmation in place, so the address under it was the form
 * itself, filled in and already sent. Pressing back offered a member the chance to send it
 * a second time.
 *
 * **How the level gets underneath.** The entry the form stands on is replaced by the level,
 * and the confirmation is then pushed on top of it. Two steps rather than one, because
 * there is no way to insert an entry beneath the one you are standing on: the browser only
 * ever replaces where you are or moves you somewhere new.
 *
 * **Why what was sent travels in the address rather than in the screen.** The second step
 * is a navigation, so the screen is drawn again from nothing and any answer it was holding
 * in itself would be gone with it. The router carries a piece of state with a location,
 * which is exactly as long-lived as the entry it belongs to, so the confirmation lives and
 * dies with the entry a reader can go back from.
 */
/** Whether this entry is the confirmation of something sent, and what was sent. */
export function useSent(): unknown {
  const { state } = useLocation()

  /* **One question, not three.** What the router hands back is whatever was put there,
     and this portal does not assert types over values it did not make (ADL A14), so it is
     read with `Reflect.get`. Asked as „is it an object, and does it have this in it", two
     of those three questions have no living answer of their own: nothing on this portal
     puts anything but this in a location's state. `Object` makes a wrapper of whatever is
     not one, and a wrapper has no `sent` in it either, so the same answer comes back
     without a branch nobody can reach. */
  return state === null ? undefined : Reflect.get(Object(state), 'sent')
}

/**
 * Says that something has been sent, putting `level` under the confirmation.
 *
 * `level` is the address a reader should land on when they press back, named per screen in
 * `btl-produkt/PDL.md`: the list of one's own results for a result, the event for a
 * comment, the list of teams for a proposal, the team itself for a change to one.
 */
export function useSend(): (level: string, sent: unknown) => void {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()

  return useCallback(
    (level: string, sent: unknown) => {
      void navigate(level, { replace: true })
      void navigate(`${pathname}${search}`, { state: { sent } })
    },
    [navigate, pathname, search],
  )
}
