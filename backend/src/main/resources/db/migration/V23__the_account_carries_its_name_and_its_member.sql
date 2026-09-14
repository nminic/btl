/* THE ACCOUNT CARRIES ITS OWN NAME, AND IT NAMES AT MOST ONE MEMBER.
 *
 * Two decisions of the owner, 14.09.2026, both taken on offered outcomes with the cost of each
 * written beside it. They are quoted rather than summarised because every line below is one half
 * of one of them:
 *
 *   1. „Ime i prezime nosi sam nalog, i moderator ne mora da bude clan." (PDL.md:4459). The name
 *      of whoever owns an account is a fact ABOUT THE ACCOUNT. The competitor's name stays on
 *      `competitor` and does not move: those are not two homes of one fact, they are two facts
 *      about two things - who owns this login, and who is a member of the league - and for a
 *      moderator who does not race only the first one exists.
 *
 *   2. „Jedan nalog je tacno jedan clan." (PDL.md:2987). The link is WRITTEN DOWN as a column and
 *      is not worked out by comparing addresses of electronic mail. His reason, and it is the
 *      whole reason this is a column: an address may change while the man stays the same man, so
 *      an address used as the key of identity cuts somebody off from his own results on the first
 *      day anybody edits his mail.
 *
 * ADL A40 gathers what follows for the schema. The owner answered two more questions on the same
 * day and NEITHER of them is in this file, which is a boundary rather than an omission:
 *
 *   - MORE THAN ONE SUPERADMIN ACCOUNT IS ALLOWED, and the portal must refuse to delete the last
 *     one. `role_only_one_holds_every_right` (V5) already guarantees that one ROLE holds
 *     `rights_mode = all`, and it never said anything about how many accounts hold that role, so
 *     nothing here has to change for the first half. The second half - refusing to delete the
 *     last such account - counts the rows that would be left, which no constraint can do. It goes
 *     with the increment that writes actions over accounts, and A40 says so there so that nobody
 *     has to discover it twice.
 *
 *   - A MEMBER NUMBER STAYS RESERVED FOR ITS MAN AFTER A REVERSAL. That is a rule about handing
 *     out the next free number, which is the increment that books payments.
 *
 *
 * WHAT TWO MERGED MIGRATIONS SAY ABOUT THIS, AND WHY THEY STILL SAY IT.
 *
 * V6 wrote „How many accounts a member may have, or a member an account, is NOT decided anywhere
 * that could be found, so this file does not decide it either... The migration that adds the
 * member decides it, with the owner." V7 repeated it from the other side: „How many accounts a
 * member may have is still not decided anywhere, so there is no column joining the two in either
 * direction here either, exactly as V6 leaves it."
 *
 * THIS IS THAT MIGRATION. Neither of those two files is touched, because a migration is immutable
 * from the day it merges (ADL A2) and rewriting a comment moves the checksum exactly as rewriting
 * a statement does - Flyway compares the file, not the SQL in it. So the sentence that has been
 * overturned is left standing where it was written, and the answer to it lives here, where V6's
 * own last line sends the reader. What DOES get deleted in this commit is the same sentence
 * wherever it stands in code that may be edited: `MeApi`, `WhoIsAsking` and `ModeratorApi` each
 * carried it in a javadoc, and a sentence asserting an overturned decision is an instruction to
 * the next reader to put it back.
 *
 *
 * WHAT IS DELIBERATELY ABSENT HERE TOO.
 *
 *   - No column on `competitor` pointing back at an account. One direction is the whole of a link
 *     and the second one would be a second place for the same fact, free to disagree with the
 *     first. Which of the two carries it is decided by which of them may exist without the other:
 *     an account may have no member (the moderator who does not race), a member may not have been
 *     given an account yet, and so the pointer goes on the side that is created first and lives
 *     longest.
 *
 *   - No rule anywhere saying a competitor MUST have an account. „Najvise jedan clan po nalogu, ne
 *     obavezno jedan" (A40) is said about the account, and the owner opens profiles of earlier
 *     years by hand for people who never registered (V18 names the same set).
 */


/*
 * THE NAME OF WHOEVER OWNS THE ACCOUNT.
 *
 * THE SHAPE IS V7's, COPIED WITH ITS GUARDS AND NOT ONLY WITH ITS TYPE. `competitor.first_name`
 * and `competitor.last_name` are `text not null collate sr_latn` with `btrim(...) <> ''` beside
 * them, and all three parts of that are here for the reasons V7 gives:
 *
 *   - `collate sr_latn` is ADL A36 O21: names sort by the Serbian Latin alphabet, and this is a
 *     column holding a name. It is the same decision and not a similar one - a list of moderators
 *     sorted by surname puts C before C-with-caron under this collation and interleaves them under
 *     any other, and the two sets of names would sort differently from each other if only one of
 *     the two tables carried the tailoring.
 *
 *   - NOT NULL, because there is no moment in the life of an account at which its owner has no
 *     name. Registration collects both (`registracija.form.json`), the superadmin types them when
 *     he creates a moderator (PDL P21), and the owner types them for the honorary members and the
 *     profiles of earlier years he fills in himself.
 *
 *   - And `btrim(...) <> ''`, because NOT NULL alone accepts a space. A name of one blank passes
 *     every rule a column can carry, draws as nothing on the moderator screen, and produces the
 *     initials „ ." for the role switcher, which is the one place the decision above says the name
 *     is needed for.
 *
 * NOT NULL IN ONE STEP AND NOT IN THREE, which is V8's move on `competitor` and rests on the same
 * measurement. V8: „Measured before writing this: `competitor` holds zero rows on QA and no other
 * database of this schema exists... That is also why the columns below arrive NOT NULL in one step
 * instead of three." The same count was made over this repository before this file was written:
 * NOTHING WRITES `account` AT ALL. No migration inserts one - V5 loads the roles and the rights
 * and stops there - and no line under `backend/src/main` does either; `SignInApi` reads accounts
 * and writes only `account_session`. There is no registration path yet, which is precisely the
 * thing the decision above was blocking (PDL.md:2987: „bez odgovora na pitanje ciji je ovo profil
 * ne postoji nijedan ekran na kom clan nesto unosi").
 *
 * AND WHAT HAPPENS IF THAT IS EVER WRONG, said here rather than left to a deploy. `ALTER TABLE`
 * refuses outright - `column "first_name" of relation "account" contains null values` - the
 * migration stops, the server does not start, and a person decides what name those rows carry.
 * That is the right failure. The alternative is a DEFAULT, and a default here is a string that is
 * not anybody's name sitting in the column the moderator screen draws and the initials are built
 * from, with nothing anywhere to mark it as a placeholder.
 *
 * WHY V18's ANSWER FOR `password_hash` DOES NOT DECIDE THIS ONE. V18 added a column to this same
 * table and chose nullable, writing „a column whose rule only works on an empty table is a rule
 * that expires". That is true of a column with a LIVE absence: an account the owner opens for
 * somebody who never registered genuinely has no password until that person sets one through the
 * reset link, so NOT NULL would have gone on being wrong every day after the migration too, and
 * `StoredPassword.matches` is written around that null. A name has no such state. The only thing
 * NOT NULL costs here is the migration against a table that already has rows, and that is the
 * failure named above rather than a rule that expires.
 *
 * AND THE COMPETITOR'S NAME IS NOT TOUCHED, NOT MOVED AND NOT MADE TO AGREE WITH THIS ONE. It is
 * the second half of decision 1 and it is the half that is easy to lose: the same person may be
 * `Aleksandra` on his account and `Aleksandra Milovanovic-Stefanovic` in the register of members
 * that the law on sport prescribes (PDL P32), and neither of those is wrong. A constraint tying
 * the two together would be this migration deciding, quietly, that they are one fact after the
 * owner said in as many words that they are two.
 */
alter table account
    add column first_name text not null collate sr_latn,
    add column last_name  text not null collate sr_latn;

alter table account
    add constraint account_first_name_not_blank check (btrim(first_name) <> ''),
    add constraint account_last_name_not_blank check (btrim(last_name) <> '');


/*
 * AND THE MEMBER THIS ACCOUNT BELONGS TO, IF THERE IS ONE.
 *
 * NULL IS EXPECTED AND CORRECT, AND IT IS THE ORDINARY STATE RATHER THAN THE EXOTIC ONE. „Jedan
 * nalog je tacno jedan clan" is „AT MOST one member per account, not necessarily one" (A40), and
 * the owner said what the other case is in the decision of the same day: the moderator who does
 * not race has no record in `competitor` at all and must not be made to have one. Five of the six
 * roles the portal knows can hold an account that never runs a race. So there is no NOT NULL here
 * and there must not be one: it would refuse exactly the person this increment was written for.
 *
 * UNIQUE, AND THAT IS THE OTHER DIRECTION OF THE SAME SENTENCE: no member hangs off two accounts.
 * A unique key over a nullable column is what says both halves at once, because PostgreSQL treats
 * nulls as distinct by default: any number of accounts may name nobody, and the moment two name
 * the same member the second one is refused. NULLS DISTINCT is the default and is not written out,
 * for the same reason nothing else in this schema writes out a default behaviour - the one that
 * would need saying is NULLS NOT DISTINCT, and it would mean at most one account in the whole
 * portal could be without a member.
 *
 * A COLUMN AND NOT A JOIN ON THE ADDRESS, which is the owner's own reason and the sharpest
 * sentence in the decision: „Adresa sme da se promeni a covek ostaje isti covek; ako je adresa
 * kljuc identiteta, promena adrese preseca coveka od njegovih rezultata." A key is a row's
 * identity and an address is a way of reaching somebody.
 *
 *
 * WHAT HAPPENS WHEN THE MEMBER IS DELETED: THE DATABASE REFUSES. ON DELETE RESTRICT, and it is
 * the owner's own answer rather than a reading of the precedents around it.
 *
 * THE DECISION, 14.09.2026, IN HIS WORDS: „Baza odbija brisanje clana dok se njegov nalog ne
 * resi." It went to him rather than being settled here because ALL THREE ANSWERS RAN GREEN
 * THROUGH THE WHOLE SUITE, which is the mark of a question about MEANING rather than of a fault
 * to be measured (ADL A32): where two opposite statements both pass, somebody decides, and it is
 * not the person writing the migration. He was given the three with the cost of each beside it.
 *
 * THE CASE THAT PUT THE QUESTION AND REFUSES BOTH ALTERNATIVES: THE MODERATOR WHO ALSO RACES HAS
 * ONE LOGIN FOR BOTH THINGS. Delete his competitor record - which is exactly what disqualification
 * does („Diskvalifikacija brise kompletne rezultate i profil takmicara", PDL) - and:
 *
 *   - CASCADE TAKES HIS ADMINISTRATIVE ACCOUNT along with his racing record, and with it three
 *     further things nobody reading the DELETE could see: the account's live confirmation links
 *     (V6 cascades), its pointer in every verification it ever decided (V9 empties that and keeps
 *     the name for exactly this reason), and his way of signing in at all. A man stops being a
 *     competitor; that is not the same event as a man stopping being a moderator.
 *
 *   - SET NULL KEEPS THE ROW AND EMPTIES ONLY THE POINTER, and the row that is left still carries
 *     THE FIRST NAME, THE LAST NAME AND THE ELECTRONIC ADDRESS OF THE DELETED MAN. Measured with
 *     a probe before this was written: after `delete from competitor ...` the account read back
 *     `trci@primer.rs | Nalogovo Ime`. That is not an emptied reference, it is his personal data
 *     still being held, and the row is now indistinguishable from a moderator who never raced. It
 *     collides head on with the decision of 11.08.2026: „Ili ce biti skriven profil jer nema
 *     aktivno clanstvo, ili ce biti obrisan zauvek sa svim svojim profilom i rezultatima, a na
 *     mestima gde se pominje bice anonimizovan." (PDL, in five places; ADL A12.) An account is a
 *     place where he is mentioned, and SET NULL anonymises nothing.
 *
 * WHAT RESTRICT COSTS, WRITTEN DOWN BECAUSE HE BOUGHT IT KNOWINGLY: DELETING A MEMBER IS FROM
 * TODAY ALWAYS TWO STEPS. First somebody decides what happens to his account - it is anonymised,
 * or it is deleted - and only then may the member go. The procedure is longer, and that is the
 * whole of the price. What it buys is that NOBODY CAN FORGET, BECAUSE THE DATABASE REFUSES. Under
 * either other answer, whoever writes the deletion path half a year from now would have to
 * REMEMBER to anonymise the account, and on the day he forgot, nothing at all would break.
 *
 * AND PDL P23 IS NOT OVERTURNED BY THIS, which has to be said out loud because ten merged
 * migrations quote it. A member may still ask to be deleted. What is refused is not his request
 * but CARRYING IT OUT IN ONE STATEMENT while his login still names him; emptying `competitor_id`
 * first is the first of the two steps, and the moment it is done the delete goes through.
 *
 * THIS IS THE ONLY RESTRICT IN THE SCHEMA THAT GUARDS A PERSON, AND THAT IS WHY IT NEEDS A
 * SENTENCE THE OTHER KEYS DO NOT. Counted over every migration in this repository before this
 * line was written: every other ON DELETE RESTRICT points at `place`, `country`, `price_row`,
 * `ducat`, `ducat_kind` or `admin_right` (V7, V9, V10, V11, V15, V16, V18) - codebooks, all of
 * them - and there the word means „a codebook does not vanish under a row that names it". Here it
 * means something else entirely: A PERSON DOES NOT GO UNTIL SOMEBODY HAS DECIDED ABOUT HIS LOGIN.
 * A reader who knows the schema's other RESTRICTs will read this one as the codebook rule and be
 * wrong. The list of every key in the schema with its action, this one included, is
 * `CompetitorEventRaceAndResultTest.everyDeletionRuleInTheSchemaIsNamed`.
 *
 * WHAT THIS DOES TO THE SCHEMA'S TWO KINDS OF REFERENCE TO A MEMBER, since those two were the
 * whole of the argument before he answered and remain true of every other key. What IS one of his
 * rows goes with him - `verification.competitor_id` (V9), `registration` and `consent` (V8),
 * `pair` and `pair_invite` (V12), `message.to_id` (V13), `membership` (V22), all CASCADE, and ADL
 * A42 of 11.09.2026 is the owner's decision behind that word. What merely NAMES him keeps its own
 * existence and loses the pointer - `event_comment.competitor_id` (V7) beside `who text not null`,
 * `verification.decided_by` (V9) beside `decided_by_name`, `team.admin_id` (V11),
 * `league.admin_id` (V14), `message.from_id` (V13), every key of the frozen season (V17) - all SET
 * NULL. AN ACCOUNT IS NEITHER, and that is what sorting it into the second kind missed: those rows
 * keep a name that was always THEIRS to keep, the league's record of who did a thing that was
 * done. An account holds THE LIVING MAN'S OWN NAME AND HIS ADDRESS, as the thing he signs in with,
 * and a login is a historical record of nothing. So it is a THIRD kind - a row that must be DEALT
 * WITH before the member goes, rather than one that follows him or one that outlives him - and it
 * is the only member of that kind in the schema today.
 *
 * WHY THE NAME ON THE ACCOUNT IS STILL RIGHT, AND WHY IT IS NO LONGER WHAT LETS THE MEMBER GO. The
 * two columns added higher up in this file are a fact about the account (decision 1 at the top),
 * and the moderator who never raced needs them whatever this key says. What they are NOT, any
 * more, is the thing that makes a member's deletion safe: a name that outlives its man is the
 * damage here, not the repair.
 *
 * AND THE OTHER DIRECTION NEEDS NO WORDS AND HAS NONE: nothing points from `competitor` at
 * `account`, so deleting an ACCOUNT cannot reach a member and this refusal runs one way only. His
 * results are the league's history and do not belong to his login.
 *
 * WHAT IS DELIBERATELY NOT IN THIS FILE: the deletion path itself. Anonymising an account, or
 * deleting it, is written with the increment that writes actions over accounts, beside the refusal
 * to delete the last superadmin named at the top. This key is only the thing that makes one of
 * those two compulsory before a member may go.
 */
alter table account
    add column competitor_id bigint;

alter table account
    add constraint account_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete restrict,
    add constraint account_competitor_unique unique (competitor_id);

comment on column account.competitor_id is 'The member this account belongs to, if there is one. Empty for a moderator who does not race, which is the ordinary case and not a fault (owner, 14.09.2026). Unique, so no member hangs off two accounts. ON DELETE RESTRICT: the member cannot be deleted while this column still names him, so deleting a member is always two steps - first decide what happens to his account, anonymise it or delete it, and only then may he go (owner, 14.09.2026). The only RESTRICT in this schema that guards a person rather than a codebook.';
