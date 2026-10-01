/* THE MEMBER NUMBER SEQUENCE IS MOVED ABOVE THE NUMBERS ALREADY WRITTEN, SO THAT THE NEXT DRAW IS A
   NUMBER NOBODY HOLDS.

   WHAT WAS SEEN. On the QA database on 29.09.2026, a measurement the pouring script records as well
   (deploy/pour-from-qa/sequences.sql): one row in `competitor`, holding `000001`, and
   `member_number_seq` standing at `last_value = 1, is_called = false`. A sequence in that state hands
   out 1 the next time it is asked, which is the number the row already holds. The first activation
   to go through the portal would draw `000001`, meet `competitor_member_number_unique` and be refused.

   AND THE REFUSAL COSTS THE NUMBER FOR GOOD. `nextval` is outside the transaction by construction
   (V16: "A sequence only ever goes up, and it is the one shape that survives a deleted row"), so a
   draw whose booking the database then refuses is not given back. PDL section 19 names that as the
   price of the design: "Aktivacija trosi clanski broj nepovratno". Each refusal of this kind would be
   a permanent hole in the numbering and not a retry.

   WHAT WROTE THE ROW IS NOT KNOWN FROM THIS REPOSITORY, and nothing below depends on it. No migration
   inserts into `competitor` (every file was searched, line breaks and quoting allowed for), and the
   routes that write the column take the number from `MemberNumbers.draw()`, the only caller of
   `nextval`, or keep the one the member already holds. A row that arrived by any other road carries a
   number the sequence never handed out, and that is the whole of the state this file repairs.

   WHAT IT DOES, in the two states a database can be in:

     - somebody holds a number: the sequence is moved so that the next draw is ONE ABOVE THE HIGHEST
       NUMBER HELD (`setval` to that number, called), and only if it is not already there or beyond;
     - nobody does, because the table is empty or holds only people who registered and have not been
       activated, whose column is empty since V16: nothing is touched, and the sequence goes on
       standing at its start, which hands out 1.

   ONLY UPWARD, AND THAT IS THE DECISION AND NOT A PRECAUTION. PDL P8, 31.07.2026: "Clanski broj se
   nikad ne dodeljuje dvaput. Sledeci broj je jedan iznad najviseg ikad dodeljenog, nikad prvi
   slobodan." The table knows only the numbers that still stand, and the sequence is the memory of the
   ones handed out and gone since: a member deleted on request (P23), or a draw that a refused booking
   spent. A sequence beyond the highest number held is therefore the ordinary state of a live portal
   and not a fault, and taking it back to the table would hand out a number that a printed card and
   an old result still carry.

   WHAT "THE NEXT DRAW" IS, because the two flags of a sequence say it differently: with `is_called`
   false it is `last_value` itself, and with it true it is `last_value + 1`. The comparison is written
   against exactly that, so a sequence put at 20 and not called (it stands at 20 and will hand out 20)
   is left alone and not pushed to 21, which would skip a number that was never handed out.

   COMPARED AS A NUMBER, and that is a reason and not a guard: `setval` takes a number. Read as text
   the answer would be the same, because `competitor_member_number_shape` (V7) lets nothing through
   that is not exactly six digits, so two numbers never differ in width.

   THE OWNER'S NUMBER IS NOT AT RISK. PDL 13.09.2026 has his own account made first and on purpose, and
   it has to be `000001`. Where nobody holds a number nothing here moves, so that account still draws
   1. Where one already holds `000001`, as on QA, the next member draws `000002`, which is what that
   entry asks for: "novi PRAVI clanovi nastave redom da dobijaju sve nakon 000001".

   WHAT THIS DOES NOT TOUCH: no schema, no row, no constraint. V16 is not edited (ADL A2: it has been
   applied, and its checksum stands in flyway_schema_history).

   TWO BOUNDARIES, written down instead of left to be found:

     - PostgreSQL has no atomic "advance to at least" for a sequence, so reading where it stands and
       moving it are two steps of one statement, and a draw by another session between them is not
       guarded. Flyway runs this while the application starts, before it serves a request.
     - It repairs the state that exists when it runs. A loader that writes member numbers directly,
       later, has to move the sequence itself after it loads, and a migration that has already run
       cannot. The pour from QA is such a loader: production is migrated while it is empty, so this
       does nothing there, and the position the pour carries is the one QA stands at when the dump is
       taken (deploy/pour-from-qa/sequences.sql moves it as it stands, on purpose). So this has to be
       live on QA before that dump is taken. */

select setval('member_number_seq', highest.number, true)
from (select max(member_number::integer) as number from competitor) as highest,
     (select case when is_called then last_value + 1 else last_value end as number
      from member_number_seq) as next_draw
where highest.number >= next_draw.number;
