/* Cloudflare Email Worker for noreply@balkanskatrkackaliga.net
 *
 * The portal only sends from that address. Nobody is meant to write to it, and
 * whoever tries anyway has to get a clear answer rather than silence.
 *
 * So the message is rejected at the SMTP level instead of being forwarded or
 * quietly dropped. The reason below goes into the bounce notice the sender's own
 * server writes, so the answer arrives automatically without us sending
 * anything.
 *
 * Why this is not an autoresponder: the reply would go to the address in the
 * header, which on junk mail is almost never the real one. That is called
 * backscatter, it ruins the reputation of the domain the portal sends payment
 * confirmations from, and it doubles the outgoing traffic for no gain at all.
 *
 * Wired up in the Cloudflare panel: Email > Routing > Routes, a rule for
 * noreply@, action "Send to a Worker", this Worker.
 *
 * The first line of defence is not this Worker but the Reply-To: info@ header on
 * every message the portal sends. This only catches those who get here anyway.
 */

/* The text a human reads, so it stays in both languages exactly as written. */
const REASON =
  'Ova adresa ne prima postu. Pisite na info@balkanskatrkackaliga.net. ' +
  'This address does not accept incoming mail. Please write to info@balkanskatrkackaliga.net'

export default {
  email(message) {
    message.setReject(REASON)
  },
}
