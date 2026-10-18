import type { ResourceState } from '../../data/useResource'
import { whatTheServerSaysOfMyPictures, type MyPictures } from '../../session/theServer'
import { useHeldRead } from './useHeldRead'

/**
 * THE PICTURES A MEMBER HAS, as the server says them when the screen is drawn: the one that waits
 * for a moderator and the one that stands on his profile, each with its circle.
 *
 * <p>PDL P11, the entry of 27.09.2026 „Na ekranu za slanje slike vidi se slika koja čeka, sa krugom
 * i oznakom da čeka odobrenje". Read on every visit and never cached, so that what he sent comes
 * back after a refresh, which is the thing that did not happen until 18.10.2026.
 *
 * @param asked the number of the member, which is whose pictures these are
 */
export function useMyPictures(asked: string): ResourceState<MyPictures> {
  return useHeldRead(whatTheServerSaysOfMyPictures, asked, 'His own pictures could not be read')
}
