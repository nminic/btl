/* One picture of one member waits for a moderator at a time.
 *
 * Owner, PDL, the entry „Ponovno slanje pregazi red koji ceka, ne pravi drugi" (27.09.2026): sending
 * again, or moving the circle over the same picture, „gazi trenutan red kod verifikatora", and the
 * entry says „Red ostaje jedan". MePhotoApi carried that out by asking, with FOR UPDATE, whether a
 * picture of his already waits, and then either repointing that row or opening one. For a FIRST send
 * the question returns no row, so there is nothing for FOR UPDATE to lock: two first sends that both
 * asked before either wrote were both told „nothing waits" and both opened a row. A member pressing
 * „Posalji" twice is enough. Measured on 09.10.2026 on the code before this file, with the case
 * written first: two first sends held at the foreign key of the insert by one row lock and then let
 * go were both answered 200, with two different queue rows; the queue held two pictures of one member
 * waiting, both of their photo rows were held, and both files were on the disk.
 *
 *
 * WHAT THIS INDEX IS FOR, AND WHAT IT IS NOT
 * ------------------------------------------
 * It is the database saying the rule, the way „asked once" is already said in five places:
 * team_application_asked_once, team_invitation_sent_once, pair_invite_asked_once,
 * verification_team_proposal_unique and, beside this one, verification_one_text_waits_per_member (V53).
 * An INDEX and not a constraint, for V53's reason: a unique constraint takes no WHERE, and the rule is
 * about a part of the table.
 *
 * It does NOT make the second send an overwrite. The owner's answer for the second send is „pregazi",
 * and a unique violation is not that: V53 answers its loser with a 409 because for a text the owner
 * chose 409. For a picture the loser has to come out exactly as a send that arrived after the first
 * one comes out, and that is the route's work: MePhotoApi makes the sends of one member take turns,
 * with a transaction-scoped advisory lock taken before the question is asked, so the second asks
 * after the first has committed and finds its row. This index is the floor under that lock. A writer
 * that does not take it meets a unique violation and not a second row.
 *
 * The two are measured apart on purpose. With the lock and without this index the forced cases
 * still leave one row, because the lock alone does (measured 09.10.2026), so no case through the
 * route can tell whether the index exists. What holds the index is VerificationConstraintsTest,
 * KeysAndIndexesTest and OnePictureWaitsCarriedOverTest, and what holds the lock is
 * APictureSentTwiceAtOnceTest. Neither set can be left to the other.
 *
 *
 * THE CONDITION IS THE ROUTE'S OWN, AND EACH HALF OF IT IS A DECISION
 * ------------------------------------------------------------------
 *   queue = 'profiles'  the tab a member's picture waits in (PDL P28a). A row waiting in another tab
 *                       is not his portrait and stops nothing.
 *   state = 'waiting'   a DECIDED picture row holds no picture at all (V9,
 *                       verification_decided_keeps_no_photo), so beside the next term this one
 *                       cannot be told apart from it by any row the schema lets stand. It is written
 *                       because it says what the index means to a reader who has not got V9 open,
 *                       and because MePhotoApi asks the same words.
 *   photo_id is not null  the complement of V53: a text waits in the same tab beside a picture
 *                       (PDL P28a, „isti clan, isti profil, dve stavke") and photo_id is what the
 *                       schema offers to tell the two apart.
 *
 * competitor_id is null for a row about somebody who is not a member yet (V9). An index compares no
 * null with another, so such rows stand side by side, as they always could.
 *
 *
 * WHAT IT DOES TO THE ROWS THAT ARE ALREADY THERE
 * -----------------------------------------------
 * It refuses to be created over a member with two pictures waiting, and that is a precondition rather
 * than something this file settles: which of two pictures would survive is a deletion from the queue,
 * and nobody has approved one. Measured on QA on 09.10.2026, read only, against Flyway 54: no member
 * held more than one picture waiting, and no picture was waiting at all. OnePictureWaitsCarriedOverTest
 * runs this file over every shape the queue can hold beside a waiting picture, and over the two
 * pictures that stop it.
 *
 * On production the file runs over an empty queue, which is filled by the one-time transfer of QA's
 * data. A unique index is not a constraint (pg_constraint has no row for it), so the pour does not
 * lift it, and the rows it copies come from a database that holds the index already.
 * PouringFromQaTest and PouringFromQaLeavesNothingBehindTest stay green with it.
 *
 * This file does not change once it is applied (ADL A2); a correction is the next migration.
 */
create unique index verification_one_picture_waits_per_member on verification (competitor_id)
    where queue = 'profiles' and state = 'waiting' and photo_id is not null;
