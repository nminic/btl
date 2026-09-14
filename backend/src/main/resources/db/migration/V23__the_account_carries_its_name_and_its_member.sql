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
 * WHAT HAPPENS WHEN THE MEMBER IS DELETED: SET NULL, and the reason is a precedent rather than a
 * preference.
 *
 * THE SCHEMA ALREADY SORTS ITS REFERENCES TO A MEMBER INTO TWO KINDS, and the question is only
 * which kind this one is.
 *
 *   - What IS one of his rows goes with him: `verification.competitor_id` (V9), `registration` and
 *     `consent` (V8), `pair` and `pair_invite` (V12), `message.to_id` (V13), `membership` (V22) -
 *     all ON DELETE CASCADE. ADL A42, 11.09.2026, is the owner's decision behind that word and it
 *     names the cost he accepted: a member's rows go with him, as his results do.
 *
 *   - What merely NAMES him, while being a row about something else, keeps its own existence and
 *     loses the pointer: `event_comment.competitor_id` (V7) beside `who text not null`,
 *     `verification.decided_by` (V9) beside `decided_by_name`, `team.admin_id` (V11),
 *     `league.admin_id` (V14), `message.from_id` (V13), and every key of the frozen season (V17)
 *     beside the name the trigger empties. All ON DELETE SET NULL.
 *
 * AN ACCOUNT IS THE SECOND KIND, AND FROM TODAY IT IS MORE PLAINLY SO THAN IT WAS YESTERDAY. It
 * exists before anybody is a member (V6 says so in as many words), it outlives a membership, and
 * since the decision above it may belong to somebody who was never a member at all. And the two
 * columns added higher up in this same file are exactly what `event_comment.who` and
 * `decided_by_name` are: the row's own copy of the name, so that when the member goes the account
 * still says whose it is instead of having to fetch it from a row that is no longer there. That is
 * what makes SET NULL available here at all, and it is why the two halves of this migration belong
 * in one file.
 *
 * WHAT IS LEFT BEHIND IS NOT A DAMAGED ROW. An account pointing at nobody is the shape this
 * increment created on purpose - the moderator who does not race - so nothing that reads accounts
 * has to learn a new state, and `/api/moderators` answers about him out of his own columns without
 * a branch.
 *
 * CASCADE IS REFUSED, and it is the tempting one because so many neighbours use it. It would make
 * the deletion of a MEMBER into the deletion of a LOGIN, and then into three more things that
 * nobody reading the DELETE could see: the account's live confirmation links go (V6 cascades),
 * every decision that account ever made in the verification queue loses its `decided_by` (V9 sets
 * it null and keeps the name for exactly this reason), and a moderator who also happens to race
 * would lose his administrative account the day his competitor record is deleted - which is what
 * disqualification does („Diskvalifikacija brise kompletne rezultate i profil takmicara", PDL).
 * Whether the login goes when the member does is a question about ACCOUNTS, and it belongs to the
 * increment that writes actions over accounts, beside the refusal to delete the last superadmin.
 * A foreign key action is the one place that decision must not be taken silently.
 *
 * RESTRICT IS REFUSED TOO, and more simply: it would break the one deletion a member has a right
 * to. PDL P23 lets him ask to be deleted, and under RESTRICT his own account would be what refuses
 * it. Deleting the account first and the member second would work, but that is an order of
 * statements somebody has to remember, and a rule kept by remembering is not kept.
 *
 * AND THE OTHER DIRECTION NEEDS NO WORDS AND HAS NONE: nothing points from `competitor` at
 * `account`, so deleting an account cannot reach a member. His results are the league's history
 * and do not belong to his login.
 */
alter table account
    add column competitor_id bigint;

alter table account
    add constraint account_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete set null,
    add constraint account_competitor_unique unique (competitor_id);

comment on column account.competitor_id is 'The member this account belongs to, if there is one. Empty for a moderator who does not race, which is the ordinary case and not a fault (owner, 14.09.2026). Unique, so no member hangs off two accounts.';
