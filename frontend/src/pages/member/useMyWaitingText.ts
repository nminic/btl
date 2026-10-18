import type { ResourceState } from '../../data/useResource'
import { whatTheServerSaysOfMyWaitingText } from '../../session/theServer'
import { useHeldRead } from './useHeldRead'

/**
 * THE WORDS A MEMBER HAS SENT AND A MODERATOR HAS NOT DECIDED, as the server says them when the screen
 * is drawn, or the empty string where nothing of his waits.
 *
 * <p>PDL P11, owner, 18.10.2026: „Dok tekst o sebi čeka odobrenje, član ga vidi u Podešavanjima sa
 * oznakom da čeka i može da ga ispravi pre odluke". Read on every visit and never cached, so that what
 * he sent comes back after a refresh.
 *
 * @param asked the number of the member, which is whose words these are
 */
export function useMyWaitingText(asked: string): ResourceState<string> {
  return useHeldRead(whatTheServerSaysOfMyWaitingText, asked, 'His own waiting words could not be read')
}
