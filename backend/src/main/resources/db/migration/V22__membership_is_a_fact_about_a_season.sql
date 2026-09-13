/* MEMBERSHIP IS A FACT ABOUT A SEASON, AND UNTIL NOW THE SCHEMA COULD NOT SAY IT.
 *
 * The question is one sentence long - "in which seasons was this person a member" - and on
 * 13.09.2026 an audit measured that nothing here answers it:
 *
 *   - `competitor.active` (V7) is one boolean with no season in it. It answers "is he a member
 *     NOW" and can never answer "was he a member in 2027".
 *   - `payment` would answer it, but only for the people who PAY. `payment_amount_positive`
 *     (V16) refuses a row of nought, so somebody the association let in without a fee has no
 *     row in it for any season at all.
 *   - `competitor.membership_basis` stands per PERSON and not per season, so it cannot describe
 *     a man who is let in free one year and pays the next.
 *
 * THE OWNER'S OWN EXAMPLE, 13.09.2026, which is the clearest thing this migration exists for. A
 * man joins and pays on 1 October 2027 FOR THE SEASON 2028, and then asks for his races of 2027
 * to be entered retroactively. All three of these are true at once and every one of them is a
 * decision already taken:
 *
 *   - he is on the list of competitors the moment his payment is recognised, whichever season he
 *     paid for (PDL P8, 31.07.2026: "Clan se pojavljuje u spisku takmicara u trenutku kad mu je
 *     uplata proknjizena, bez obzira na to za koju sezonu je platio");
 *   - his 2027 races show on his profile, because a result may be entered for any year;
 *   - and he enters NO table of 2027 - not a ranking, not a pair, not a team standing - because
 *     "mesto u tabeli ide uz sezonu za koju je placeno".
 *
 * The third of those is the one the server had no way to carry out. `active` is true for him, he
 * has a payment, and neither of them says the year he is a member OF.
 *
 * WHAT THIS MIGRATION ADDS AND WHAT IT DELIBERATELY DOES NOT.
 *
 * It adds the fact and nothing else: one row per person per season, with the basis it stands on.
 * No resource reads it yet, no screen writes it, and `competitor.active` stays exactly where it
 * is and keeps being written and read as before. The decision of 13.09.2026 says the flag
 * BECOMES derivable - a member of the current season, and during the transfer window of 1
 * October to 31 December also a member of the next one - but removing it touches `CompetitorApi`
 * and `ResultApi` and is its own increment with its own review. A migration that both changes
 * the shape of a fact and rewrites the readers of it is a migration nobody can review in halves.
 *
 * `competitor.membership_basis` IS LEFT WHERE IT IS, and that is measured rather than assumed.
 * The decision above says it "prestaje da bude tacan oblik te cinjenice", and it does; but it is
 * read today, and dropping a column that is read is a different increment from adding a table
 * that is not. Counted over the whole repository on 13.09.2026: no Java under `backend/src/main`
 * mentions it, but the portal does - `frontend/src/data/types.ts` declares it, `AdminMembers.tsx`
 * draws it as a tag, `Membership.tsx` asks whether it is `feeExempt`, `Payments.tsx` activates a
 * member with it, `session/context.ts` carries it, `admin-clan.form.json` is the field that sets
 * it and `i18n/sr.json` names its two values - and so does a guard, `CompetitorApiTest`, which
 * reads the words out of `competitor_membership_basis_known` itself to say none of them ever
 * leaves the server (Clan 74). Until those move, the column stays, and the day it goes it goes
 * with them in one change.
 *
 * WHY THE PAIR IS THE KEY AND THERE IS NO `id`.
 *
 * A36/O1 says a key is a bigserial, and it says it about a thing that HAS an identity of its own.
 * This row has none: it is the person and the year, and nothing points at it. The schema already
 * carries that shape wherever the pair is the fact rather than a property of something -
 * `league_race_pk` over (league, race) in V19, `message_read_pk` over (message, member) in V13 -
 * and the reason to prefer it here is the same one those two give: a surrogate key beside a pair
 * that must be unique is a second thing to keep, and it lets a second row for one person and one
 * season be written by anybody who forgets the unique key. Here the key IS "one answer per person
 * per season", so forgetting it is not possible.
 *
 * The order of the two columns is the question the audit asked: "in which seasons was he a
 * member" reads the member's side, so he leads. The other side - everybody who was a member in
 * one season, which is what every table of a season is drawn from - gets its own index, exactly
 * as `league_race` gives one to the race whose league side its key already serves.
 *
 * TWO BASES AND NO THIRD, and the boundary of the whole table is there. "Uplata" and "pocasno"
 * are what PDL P8 knows, and they are the two `competitor_membership_basis_known` already names,
 * word for word, so the two cannot drift apart while both exist.
 *
 * AND NOTHING BEFORE 2027, the same sentence `payment_season_not_before_the_league` (V16),
 * `league_season_not_before_the_league` (V14) and `team_membership_season_from_not_before_the_league`
 * (V11) already carry: the league starts in 2027 and there is no season before it.
 */
create table membership (
    /* Who, and which year he is a member OF - not the year he paid in, which is `payment`'s
       business and a different number for everybody who joins in the transfer window. */
    competitor_id bigint  not null,
    season        integer not null,

    /* What the membership stands on. Never shown publicly, to anybody, on any screen (PDL P8,
       28.07.2026: "Osnov clanstva se nikad ne prikazuje javno"); it is here because "was he a
       member" has to have one answer for the man who pays and the man who is let in free. */
    basis         text    not null,

    /* ONE ANSWER PER PERSON PER SEASON, and it is the key rather than a unique constraint beside
       a surrogate one, because there is nothing else the row could be identified by. */
    constraint membership_pk primary key (competitor_id, season),

    /* The membership goes with the person, which is what `payment_competitor_fk` (V16) and
       `team_membership_competitor_fk` (V11) both say about the rows hanging off a member. What
       survives a deleted member is the frozen season (A37), which is its own tables of hardcoded
       values and carries his name as text, so nothing here is the history PDL P23 protects. */
    constraint membership_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete cascade,

    constraint membership_basis_known check (basis in ('payment', 'feeExempt')),
    constraint membership_season_not_before_the_league check (season >= 2027)
);

/* Everybody who was a member in one season, which is the side every table of a season is drawn
   from. The member's own side is already served by the key. */
create index membership_season_idx on membership (season);

comment on table membership is 'One row per person per season: which seasons somebody was a member of, and on what basis. competitor.active answers only "now", and payment only ever exists for the people who pay.';


/* WHAT IS CARRIED OVER, AND WHAT IS NOT, and the second half is the part that needs writing down.
 *
 * EVERY RECOGNISED PAYMENT BECOMES A MEMBERSHIP OF THE SEASON IT WAS FOR. That is the same
 * sentence the portal already lives by, written in the new shape: a recognised payment for a
 * season IS a membership of that season, and `payment.season` is already the season paid for
 * rather than the season paid in.
 *
 * A payment that is still `awaited` is not one. Nobody has recognised it, the member number has
 * not been handed out, and PDL P8 ties everything to the moment it is recognised. A `reversed`
 * payment is not one either, and that is the sharper of the two: the owner said in as many words
 * what a reversal means, 11.08.2026 - "propada clanski broj, a korisnik postaje inaktivan za tu
 * sezonu" - so carrying it would write down the opposite of what happened.
 *
 * NO `on conflict` CLAUSE, and that is a fact and not an omission. `payment_one_a_season` (V16)
 * is a unique key over exactly (competitor_id, season), so the select below cannot produce the
 * same pair twice; and the table is created three statements above this one, so there is nothing
 * already in it that a row could collide with. A clause here would be a promise about a case
 * that cannot arise, and it would hide the one that could - a duplicate meaning the key above no
 * longer says what it says.
 *
 * AND THE ONE THING THAT IS NOT CARRIED, named here because it is silent: somebody the
 * association let in free. Having no recognised payment is what being let in free MEANS, so this
 * select does not reach him - and if one day he does have one, being carried on it is right, not
 * a leak. There is no honest year to write him down for otherwise: the column that says he is
 * `feeExempt` carries no season at all, which is the whole reason this table exists. Inventing a
 * year would be the migration deciding something the owner decided differently on 13.09.2026:
 * honorary membership is granted "za svaku sezonu posebno", and he chose that direction against
 * the other one knowing the cost - "ko zaboravi da potvrdi, taj clan ispadne iz lige za tu
 * sezonu: greska se vidi i ispravlja se jednim potezom", where the opposite mistake leaves
 * somebody a member forever with nothing anywhere showing it. So an honorary membership is
 * granted, once per season, by the screen that does not exist yet, and this migration does not
 * guess on its behalf.
 */
insert into membership (competitor_id, season, basis)
select p.competitor_id, p.season, 'payment'
from payment p
where p.state = 'recorded';
