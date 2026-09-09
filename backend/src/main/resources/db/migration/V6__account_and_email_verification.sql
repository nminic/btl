/* The account somebody signs in with, and the link that confirms its address.
 *
 * ADL A36 O9: accounts and roles go into the first schema and authentication
 * into the second. Confirming the address is the condition of being able to
 * sign in at all (PDL P22, quoted below), so it belongs to the account; the
 * password, the session and the sign in itself do not, and nothing here knows
 * about any of them.
 *
 *
 * TWO THINGS CALLED ACTIVATION, AND THEY ARE NOT THE SAME THING
 * ------------------------------------------------------------
 * PDL, section on registration, says this in its own words and asks in those
 * same words that the data model never mix them:
 *
 *   1. Activating the ACCOUNT. The member confirms the address of electronic
 *      mail and can then sign in. The member does it himself, by clicking the
 *      link in the message. That is email_confirmed_at below.
 *
 *   2. Activating the MEMBERSHIP. A payment recorded, or honorary membership,
 *      whereupon the member gets a member number and becomes a full member. The
 *      owner or a moderator does it. That is NOT in this file and there is no
 *      column here it could hide in.
 *
 * And, answered on 11.08.2026 and quoted because it is the whole reason the two
 * have to stay apart: "Clanstvo sme da se aktivira i pre nego sto je adresa
 * potvrdjena." So neither state follows from the other, in either direction,
 * and no rule anywhere may be conditioned on one to decide the other. What
 * holds that here is not a comment: no constraint and no index in this schema
 * mentions email_confirmed_at, and AccountAndVerificationTest reads the
 * catalogue to say so.
 *
 * The third state that is also not here: "Pre placanja clan sme da otvori
 * nalog, ali nigde nije vidljiv i ne moze nista da radi u sistemu" (PDL). That
 * is a rule about what the portal shows, not a column.
 *
 *
 * AN ACCOUNT IS NOT A MEMBER
 * --------------------------
 * A competitor is eighteen fields and a member number handed out at the moment
 * a payment is recorded; an account is four columns and exists before any of
 * that. They are two tables. This one does not carry a name, a date of birth,
 * a shirt size or a member number, and the exact column list is held by a test
 * against information_schema rather than by this sentence.
 *
 * How many accounts a member may have, or a member an account, is NOT decided
 * anywhere that could be found, so this file does not decide it either: there
 * is no column joining the two in either direction and no unique key claiming a
 * cardinality. The migration that adds the member decides it, with the owner.
 *
 *
 * WHAT IS DELIBERATELY ABSENT, EACH ONE A DECISION
 * ------------------------------------------------
 *   - No password, no hash of one, no session. ADL A36 O9 puts them in the
 *     second migration, and A8 says what they will be when they come (BCrypt or
 *     Argon2, httpOnly cookies).
 *
 *   - No lock, no count of failed attempts, no password strength.
 *     PRED-BAZU-ANALIZA O9, in as many words: "Nije zapisano nista o jacini
 *     lozinke, trajanju sesije, roku tokena za reset i zakljucavanju naloga."
 *     A column invented against an undecided rule is a guess in the one place
 *     that cannot hold one. Read the sentence and not the word: the token O9
 *     leaves open is the one that RESETS A PASSWORD, and it is still open. How
 *     long the link that confirms an ADDRESS lasts is not among the four and is
 *     not open; the owner decided it on 08.09.2026 and it is written into
 *     expires_at below.
 *
 *   - No moment of creation on the account. Nothing written down reads one, and
 *     every other column here answers a sentence somebody wrote.
 *
 *   - No mark that a link has been spent, and no limit on how many are live at
 *     once. ADL-posta requires a button that sends the confirmation again, so a
 *     second link must be issuable and account_id therefore carries no unique
 *     key. Whether issuing the second one retires the first is not written
 *     anywhere, and a unique key would decide it silently.
 *
 *   - No collation. O21 puts sr_latn on columns holding names. An address of
 *     electronic mail is not a name and is not sorted for a reader; it is
 *     matched, and matched case insensitively, which is what the unique index
 *     below does. A tailored collation on it would be a decision about reading
 *     order that nothing reads.
 */


/* One row per account.
 *
 * `email` is unique WITHOUT EXCEPTION - the owner, 08.09.2026: one address is
 * one account. The uniqueness is over lower(email) and not over email, and that
 * is the difference between the sentence being true and looking true: the
 * default collation is deterministic, so a plain unique key would let
 * Petar@primer.rs and petar@primer.rs both in and the same person would hold
 * two accounts. The shape check is the other half of the same decision rather
 * than an attempt at validating an address: it demands exactly one @ with
 * something either side, and it demands that everything either side be a
 * character a reader can see.
 *
 * AN ADDRESS IS VISIBLE ASCII, AND THAT IS A MEASURED BOUNDARY RATHER THAN AN
 * OVERSIGHT. Both sides are a range of code points - ! (0x21) through ~ (0x7E),
 * with @ (0x40) taken out - and every other character on earth is refused.
 *
 * A RANGE and not an exclusion, and that distinction is the whole of it. The
 * first draft of this line excluded whitespace, [^[:space:]@], and an exclusion
 * has no floor: under the en_US.utf8 ctype the postgres:18 image is built with,
 * [:space:] is the ASCII whitespace and nothing more, so U+00A0, U+2007, U+202F,
 * U+200B, U+FEFF and U+00AD all walked through. lower() folds none of them, so
 * the unique index below did not fire either, and petar@primer.rs with a zero
 * width space in the middle went in beside petar@primer.rs as a second account
 * of the same person. Measured against this image, six characters through the
 * check and four rows in the table that read to a moderator as one address.
 * A range cannot come up short the way that list of six did: it says what is
 * allowed, so the seventh invisible character needs no line here.
 *
 * WHAT THE RANGE COSTS, said here so that it is a decision and not a surprise:
 * no internationalised address. A local part in Cyrillic, a domain written in
 * its own script, an accented letter - all refused outright, and the refusal is
 * loud rather than silent. Nothing in PDL or ADL promises one, and the same
 * range is what refuses a homoglyph, a Cyrillic a that draws the same picture as
 * a Latin one and is the second account by another road. The day the league owes
 * somebody an address in his own alphabet, that is a migration and a decision,
 * not a regular expression quietly widened.
 *
 * Where else it stops, worth naming - a quoted local part with a space or a
 * second @ in it is legal by the RFC and refused here, and no registration form
 * on this portal would send one.
 *
 * `role_id` is what the account is (ADL A8, PDL P21). Not null and no default:
 * there is no such thing as an account whose role has to be guessed. NO ACTION
 * on delete, like every other reference in this schema: a role with accounts on
 * it is a role that cannot quietly disappear.
 *
 * `email_confirmed_at` is the whole of "the address is confirmed". Null until
 * the member clicks the link, and holding the instant rather than a boolean
 * beside it because two columns would be two homes for one fact; O2 says a
 * technical instant is a timestamptz in UTC. No default, so an account is born
 * unconfirmed and being born is not being confirmed. */
create table account (
    id                 bigserial not null,
    email              text      not null,
    role_id            bigint    not null,
    email_confirmed_at timestamptz,

    constraint account_pk primary key (id),
    constraint account_role_fk foreign key (role_id) references role (id),

    /* ! through ~ without @, on both sides. See the note above for why this is a
       range of what is allowed and not an exclusion of what is not. */
    constraint account_email_shape check (email ~ '^[\x21-\x3f\x41-\x7e]+@[\x21-\x3f\x41-\x7e]+$')
);

/* One address is one account, whatever case it is typed in. An index and not a
   unique constraint, because PostgreSQL will not take an expression on a unique
   constraint, and the expression is the point. */
create unique index account_email_unique on account (lower(email));

create index account_role_idx on account (role_id);


/* The link out of the message, and it is stored as a digest and never as
 * itself.
 *
 * Same rule ADL A8 states for passwords and for the referral code, for the same
 * reason and with a sharper edge here: whoever reads this table must not be
 * able to activate somebody else's account. A column holding the token as it
 * appears in the link is a column of ready made keys - a backup, a dump handed
 * to a developer, a query in a log - and every one of them opens every account
 * that has an unspent link. The digest cannot be walked back, so a reader of
 * this table holds nothing.
 *
 * The shape check pins it to sixty four lowercase hexadecimal characters, which
 * is a SHA-256 written one way. That refuses what a link token actually looks
 * like: base64url with its dashes and underscores, a UUID with its dashes,
 * anything shorter, anything in capitals. Where it stops, said here rather than
 * left for a reviewer: it cannot tell a digest from sixty four random hex
 * characters, because that is a question about where the value came from and no
 * constraint can follow a value through the code. The half that can be asked
 * here is asked here; the other half belongs with the code that writes the row,
 * which is the second migration (ADL A36 O9).
 *
 * Unique, because two accounts whose links hash the same would be one link
 * opening either, and because a collision is a sign the value did not come from
 * a CSPRNG (ADL A8).
 *
 * `expires_at` is NOT NULL, so no link exists without an end, and the schema
 * says when that end is: TWENTY FOUR HOURS. [ODLUKA 08.09.2026, vlasnik], ADL
 * A38, and his reasoning with it - long enough that somebody who opens his mail
 * the next morning still gets in, short enough that a link out of an old message
 * is not live for months. When it runs out the member asks for another with one
 * click, which is the same sentence that keeps account_id above from carrying a
 * unique key.
 *
 * A DEFAULT rather than an interval the backend is trusted to remember, and the
 * two are not the same promise. A default is the end a row gets when whatever
 * wrote it said nothing, so twenty four hours holds through a fixture, a repair
 * typed by hand at three in the morning, and the first version of a service that
 * has not learned the rule yet. What it is not is a ceiling: the backend may
 * still write an instant of its own and the default does not touch that row, so
 * the day the rule moves it moves in one place and this migration does not have
 * to.
 *
 * ON DELETE CASCADE, and it is the one place in this schema where a cascade is
 * the safe direction rather than the convenient one. A member may ask to be
 * deleted (PDL P23); an account deleted while a live link still pointed at it
 * would leave an address in a message that still activates something. O1 warns
 * against a hard cascade reaching a frozen season snapshot; a confirmation link
 * is the exact opposite of a snapshot, worthless the moment its account is
 * gone. */
create table email_verification_token (
    id         bigserial   not null,
    account_id bigint      not null,
    token_hash text        not null,
    expires_at timestamptz not null default now() + interval '24 hours',

    constraint email_verification_token_pk primary key (id),
    constraint email_verification_token_account_fk
        foreign key (account_id) references account (id) on delete cascade,
    constraint email_verification_token_hash_unique unique (token_hash),

    constraint email_verification_token_hash_shape check (token_hash ~ '^[0-9a-f]{64}$')
);

create index email_verification_token_account_idx on email_verification_token (account_id);
