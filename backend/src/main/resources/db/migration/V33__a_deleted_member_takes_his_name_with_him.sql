/*
 * A DELETED MEMBER TAKES HIS NAME WITH HIM, AND NOT ONLY THE POINTER AT HIM.
 *
 * PDL, owner, 11.08.2026: „Ne postoje arhivirani takmicari. Ili ce biti skriven profil jer nema
 * aktivno clanstvo, ili ce biti obrisan zauvek sa svim svojim profilom i rezultatima, a na mestima
 * gde se pominje bice ANONIMIZOVAN." And in as many words, on what „anonimizovan" costs when it is
 * only half done (PDL P23): „Ako igde ostane zapis da je 000127 bio odredjena osoba, nista nije
 * obrisano nego samo sakriveno, a to je i dalje licni podatak."
 *
 * WHAT WAS MEASURED, AND IT IS A CLASS RATHER THAN ONE ROW. The schema sorts a foreign key at
 * `competitor` into `on delete cascade` (the row was HIS and goes with him) and `on delete set
 * null` (the row is somebody else's and keeps its own existence). The second kind empties the
 * POINTER, and a foreign key cannot empty a second column - so wherever a table keeps the name
 * BESIDE the pointer, the pointer went and the name stayed. Swept over every migration by column
 * shape rather than by memory, there are exactly four such columns and V17 already closed two:
 *
 *   - `season_competitor.who`         - closed by V17's trigger, which this file keeps word for word
 *   - `season_league_standing.who`    - the same
 *   - `message.from_name`             - OPEN until today
 *   - `event_comment.who`             - OPEN until today
 *
 * THIS IS THE SAME FINDING THE REVIEW OF PR 281 MADE ABOUT `account`, arriving one table further
 * on. There the owner's answer was `on delete restrict` (V23), because an account is a row that
 * must be DEALT WITH before its member goes. These two are not that kind: a message outlives its
 * sender and a comment outlives its author, both by decision (owner, 07.08.2026, on keeping
 * published comments). What was never decided is that his NAME outlives him, and V13 said so in a
 * sentence - „The pointer empties, the name does not" - which was reasoning written into a
 * migration rather than anything the owner chose. That sentence no longer holds. It stands in V13
 * because a merged migration is never edited (ADL A2), and it is named here so the next reader
 * meets the correction in the same place he meets the column.
 *
 * WHY THE NAME IS REPLACED HERE AND EMPTIED THERE, WHICH IS THE ONE PLACE THIS FILE DEPARTS FROM
 * V17. V17 emptied `who` and left the word to the reader, with its reason written out: „the
 * replacement differs by gender and `gender` is already here, so writing it would be a second copy
 * of something derivable". `message` and `event_comment` have no gender column, and after the
 * deletion there is nowhere left to derive one from - `competitor` is the only row that ever held
 * it and it is the row going away. So the choice is between adding a gender column to two more
 * tables and writing the finished text once, at the one moment the gender is still in hand. The
 * trigger has `old.gender` in its hand exactly then, and writes the text the owner chose.
 *
 * THE TEXT IS NOT INVENTED HERE. ADL A37, owner, 06.09.2026: „Zamenski tekst je <Obrisani clan>,
 * odnosno <Obrisana clanica>, sa uglastim zagradama." His own words: „Moze da bude <Obrisani clan>
 * ili clanica npr. Sa sve ovim znakovima okolo." The brackets are part of the text and do the work
 * V17 wanted an empty column to do: they tell a reader at once that this is not a name but the
 * place a name used to be. A blank column would have done it too and cannot be used here, because
 * both columns are NOT NULL and the reader that would fill them in has no gender to fill them from.
 *
 * WHAT DOES NOT CHANGE, AND IT IS DELIBERATE: nothing that reads these two tables needs a line.
 * `CommentApi` already draws the name off `event_comment.who` and the LINK off the join, so an
 * author with no row comes back as text with no profile behind it - which is what it already did
 * for a member who never renewed. `InboxApi` already reads `message.from_name` straight out.
 */


/*
 * The pointer and the name are emptied TOGETHER, in one statement, and that is what makes the
 * order of this trigger and the foreign keys beside the point.
 *
 * BEFORE DELETE, the same as V17 and for its reason: „it has to run while the row is still
 * findable - by the time the foreign keys have emptied the pointers there is nothing left to find
 * the rows by". Written as an AFTER trigger it would be racing the referential actions, which are
 * themselves AFTER triggers, and the winner would be whichever was created first - a fact about
 * the order of two migrations rather than about what the portal means.
 *
 * So each statement writes BOTH columns. The referential action still runs afterwards and finds
 * nothing left pointing at the member, which is the same end state by a road that cannot be
 * reordered.
 *
 * `season_competitor` and `season_league_standing` keep V17's two statements WORD FOR WORD, and
 * they keep emptying rather than replacing. That is not carelessness about consistency: those two
 * tables carry `gender` as a column precisely so the reader can write the word (ADL A37), and
 * changing them here would put a second copy of a derivable value into a frozen snapshot. The rule
 * of 05.09.2026 applies to this file too - a guard is not replaced until the cases the old one
 * caught are run against the new one - so the two statements it held are still here, unchanged.
 */
create or replace function forget_the_name_of_a_deleted_member() returns trigger
    language plpgsql
as $body$
declare
    /* The word the owner chose, picked by the one column that can still answer. `gender` is
       `M` or `F` and nothing else (`competitor_gender_known`, V7), so there is no third branch
       to get wrong and no `else` to hide one. */
    gone text := case old.gender when 'M' then '<Obrisani član>' else '<Obrisana članica>' end;
begin
    update season_competitor set who = null where competitor_id = old.id;
    update season_league_standing set who = null where competitor_id = old.id;

    update message set from_id = null, from_name = gone where from_id = old.id;
    update event_comment set competitor_id = null, who = gone where competitor_id = old.id;

    return old;
end;
$body$;


comment on column message.from_name is
    'The name the message went out under. The portal writing to a member itself signs with the '
        'name of the league and has no pointer at all (PDL P13, 19.09.2026). When the sender is '
        'deleted this column is REWRITTEN to <Obrisani član> or <Obrisana članica> by '
        'competitor_deletion_forgets_the_name, in the same statement that empties from_id: a name '
        'that outlived its man was measured on 25.09.2026 and is what PDL P23 calls "nista nije '
        'obrisano nego samo sakriveno".';

comment on column event_comment.who is
    'The name the comment went out under, kept on the comment so that published prose survives its '
        'author (owner, 07.08.2026). When the author is deleted this column is REWRITTEN to '
        '<Obrisani član> or <Obrisana članica> by competitor_deletion_forgets_the_name, in the same '
        'statement that empties competitor_id. The link is drawn off the pointer and so goes with '
        'it; the row stays and says a member wrote it, without saying which.';
