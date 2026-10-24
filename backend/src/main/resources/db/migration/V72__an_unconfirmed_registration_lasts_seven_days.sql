/* An unconfirmed registration lasts seven days, and then it is deleted.
 *
 * The owner's decision of 23.10.2026 (PDL „Poruka posle potvrde adrese i rok nedovršene
 * registracije"): „Link za potvrdu adrese važi 7 dana (ranije 24 sata ...), a prijava koja za to
 * vreme nije potvrđena briše se sama, bez poruke, i adresa je slobodna za novu registraciju." The
 * same for a member the administration entered who sets no password in seven days, unless he
 * already has a payment or a number. The deleting is the server's (`UnconfirmedAccountsAreSwept`);
 * this file holds the two things only the schema can.
 *
 *
 * THE LINK
 * --------
 * `email_verification_token.expires_at` defaults to seven days from the moment the row is written,
 * where V6 wrote twenty four hours. HowLongALinkLastsMatchesTheSchemaTest asks this default and
 * requires the message to promise what it gives.
 *
 * WRITTEN AS 168 HOURS AND NOT AS 7 DAYS, for the reason V6's twenty four hours were hours
 * (AccountAndVerificationTest): a day is a calendar day, twenty three or twenty five hours on the
 * night the clocks change, so a week of days is not one length. The portal promises a length.
 *
 * A DEFAULT AND NOT A CONSTRAINT, so the rows already standing are not touched by it: a link mailed
 * yesterday under the words „Link važi 24 sata" keeps the twenty four hours its letter promised.
 *
 * The invitation of a member lives in `password_reset_token` and that column's default is NOT
 * moved: it is the hour of a forgotten password, which is the owner's number of 11.09.2026. The
 * invitation's seven days are written onto its own row when it is minted (AnInvitationOfAMember).
 *
 *
 * THE ACCOUNTS ALREADY STANDING
 * -----------------------------
 * The owner, 24.10.2026: „zatečenima 7 dana od dana podizanja". An account standing unconfirmed when
 * this runs was mailed a link of twenty four hours or one hour, and words that told him to ask for a
 * new one, never that he would be deleted. Every one of its links has long run out, so by the rule
 * alone the first sweep would delete it the hour the server came up. So each of them is kept for
 * seven days from the moment this file runs, and that moment is written onto the row:
 * `account.kept_unconfirmed_until`. An account written after this file never carries it, because
 * every such account was told about the seven days in its own letter.
 *
 * The column is empty for every confirmed account, and nothing in the portal writes it again; it is
 * a fact about the day of this deployment and nothing else. Nullable, with no default, so a new
 * account has nothing to wait for but its links.
 *
 * UnconfirmedAccountsCarriedOverTest takes the column away, writes accounts as a database already
 * holds them, runs THIS FILE over them, and requires the unconfirmed ones and only those to come out
 * kept for seven days.
 *
 * This file does not change once it is applied (ADL A2); a correction is the next migration.
 */

alter table email_verification_token
    alter column expires_at set default now() + interval '168 hours';

alter table account
    add column kept_unconfirmed_until timestamptz;

comment on column account.kept_unconfirmed_until is 'Until when an account that stood unconfirmed on the day V72 ran is kept, whatever its links say: seven days from that day (owner, 24.10.2026). Empty for every other account, and never written again.';

update account
   set kept_unconfirmed_until = now() + interval '168 hours'
 where email_confirmed_at is null;
