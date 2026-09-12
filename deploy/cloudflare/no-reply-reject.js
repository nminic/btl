/* Cloudflare Email Worker for no-reply@balkanskatrkackaliga.net
 *
 * The portal only sends from that address (ADL A48, 12.09.2026), and the hyphen is
 * part of it: that spelling is the one verified with the relay, and an address the
 * relay has not verified gets rewritten, so nothing ever actually arrives from the
 * unhyphenated form. Whatever guards `noreply@` guards nobody.
 *
 * Nobody is meant to write to the address either, and whoever tries anyway has to
 * get a clear answer rather than silence.
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
 * no-reply@, action "Send to a Worker", this Worker. Nothing in this repository
 * points that rule at an address, so renaming this file moves nothing: the route is
 * edited by hand in the panel, and a rule left on the old spelling is a rule on an
 * address the portal does not use.
 *
 * And this Worker is the only answer somebody replying gets. An earlier note here
 * called a Reply-To: info@ header the first line of defence; the portal does not
 * send one. `Postman.send` puts a sender, a recipient, a subject and a body on the
 * message and nothing else, and no Reply-To is set anywhere in the repository.
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
