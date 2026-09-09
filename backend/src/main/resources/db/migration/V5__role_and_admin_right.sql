/* Roles, and the boxes the superadmin ticks for one moderator.
 *
 * ADL A36 O9 puts accounts and roles in the first schema and authentication in
 * the second, so nothing here knows about a password or a session. What this
 * file writes is what a role is and what a right is, which are the two
 * codebooks everything else about permission points at. The account itself is
 * V6, and it points at role.id.
 *
 * Written by hand rather than by backend/tools/generate_reference_migrations.py,
 * and the difference is the source and not the size. That script exists because
 * two codebooks ship as files under frontend/ - two hundred and forty six
 * countries and forty seven thousand towns - and a generated file is the only
 * honest way to keep a migration equal to a file that long. Roles and rights
 * ship as TypeScript the portal executes, not as a file to copy, so there is
 * nothing for a generator to read. What replaces it is RolesAndRightsTest,
 * which reads the portal's own dictionary and compares it with what loaded.
 *
 *
 * FOUR ROLES, AND WHY THE OTHER THREE OF PDL P21 ARE NOT HERE
 * -----------------------------------------------------------
 * PDL P21 lists seven roles and calls the list final: Superadmin, Moderator,
 * Takmicar, Posetilac, Organizator lige, Sponzor, Butik. The running portal
 * carries four of them (frontend/src/roles/context.ts): a league organiser and
 * a sponsor get their own screens later, and the boutique is inactive until
 * further notice while its holder sells inside the portal rather than the
 * association selling for him (PDL P20).
 *
 * ADL A8, decision of 08.09.2026: the schema carries exactly four, and the
 * other three do not enter it. The owner was asked twice, the second time with
 * the two sentences that said the opposite quoted back to him verbatim, and
 * answered the same both times. What that decision overturned, said here so it
 * cannot come back as an assumption: that a difference between the list and the
 * SCHEMA would be a debt, and that the boutique exists in the model from the
 * start.
 *
 * The cost is known and was accepted with the decision. When a league organiser
 * or a sponsor gets a screen, that is a migration over a table that already
 * carries rows and accounts pointing at them, rather than one line in the first
 * migration, and a migration cannot be edited once it is merged (ADL A2, worded
 * for this decision in A8). What is NOT changed is PDL P20 and P21: seven is
 * still the list of roles the portal knows as a concept. Four is what the
 * database holds.
 *
 * This file is corrected in place rather than followed by a migration that
 * deletes three rows, because it has not been merged: A8 words the immutability
 * of A2 as being from the merge onward, and a V6 undoing a V5 that never ran
 * anywhere would leave a history claiming the portal once shipped seven roles.
 *
 *
 * WHAT THESE TWO TABLES DELIBERATELY DO NOT CARRY
 * -----------------------------------------------
 * Said out loud rather than left to be found, because each one is a decision:
 *
 *   - No grant, no row of the matrix. A tick belongs to one named moderator
 *     (ADL A8: the rights belong to a row in the matrix, and without a name
 *     there is no row). V6 gives the name an account, but which accounts hold
 *     which boxes is the moderator's own increment; the grant table joins
 *     account.id to admin_right.id when it arrives.
 *
 *   - No isMember and no isStaff. The two predicates in context.ts answer for
 *     the four roles the portal shows, and every role here is one of those
 *     four, so a column would repeat in the database what rights_mode and the
 *     four codes already say. The day a sponsor arrives, whether a sponsor
 *     belongs inside administration is a decision that comes with him.
 *
 *   - No in_use. It was here while the table carried seven rows and told the
 *     four the portal shows from the three it does not. With four rows it is
 *     true on every one of them, and a column that never differs is a sentence
 *     the reader has to check before learning it says nothing.
 *
 *   - No order. The order of the columns in the matrix is read off the two
 *     lists that build it (ENTITY_FORMS, QUEUES), the definitions stay in the
 *     repository (ADL A36 O18 and O15), and no screen reads its order from
 *     here. A sort_order column would be a second home for a fact the front end
 *     already owns, and two homes for one fact is two facts the day one of them
 *     is edited. The country and town codebooks carry one because there the
 *     database IS the source; here it is not.
 *
 *   - No addresses. The sixteen guarded paths of needs.ts are the front end's
 *     route table, guarded by its own suite, and an address is not a fact about
 *     the database.
 *
 * O21 asks for the Serbian collation on columns holding names. Neither table
 * holds one: a role and a right are known here by a code that is ASCII and
 * never shown, and the words a person reads stand in the portal's dictionary
 * under rights.column and rights.action. So sr_latn is not used here, and that
 * is the decision rather than an oversight.
 */


/* One row per role, and a role is a code (O1: the key is a bigserial, and the
   mark people speak out loud stands beside it as its own unique column).

   `rights_mode` is the whole of useMay() in rights.ts, which is the one place
   the portal asks whether somebody holds a right, held here as a fact about the
   role rather than as three branches somebody has to find:

     all      Holds every right, always, and is never looked up. The superadmin
              has no row in the matrix precisely because there is nothing to
              give him or to take away (PDL P28a, P21).
     granted  Holds what has been ticked for him, one box at a time. The
              moderator, and the only reason the matrix exists: a single level
              called "moderator" would make the six people who administer this
              portal into one person with six passwords (ADL A8).
     none     Holds nothing: the visitor and the competitor. The twelve rights
              below are the moderator's matrix, and PDL P21 says granular rights
              describe what a moderator may do, not what anybody else may.

   The floor under the four rows is the portal's own dictionary rather than this
   comment: the role switch names every role it can become, so a role the portal
   learns tomorrow arrives in the dictionary and fails RolesAndRightsTest until
   this table carries it too. */
create table role (
    id          bigserial not null,
    code        text      not null,
    rights_mode text      not null,

    constraint role_pk primary key (id),
    constraint role_code_unique unique (code),

    constraint role_code_shape check (code ~ '^[a-z]+(_[a-z]+)*$'),
    constraint role_rights_mode_known check (rights_mode in ('all', 'granted', 'none'))
);

/* At most one role holds everything, and it is the security statement of this
   file rather than tidiness. A second role with rights_mode 'all' would be a
   second way to hold every right, granted to whoever carries it and ticked by
   nobody, and no screen would say so: useMay() answers yes and stops. A
   partial index and not a constraint, because PostgreSQL will not take a WHERE
   on a unique constraint.

   Only "at most". That there IS one is a statement about the rows, not about
   what the table will take, and it is held by RolesAndRightsTest. */
create unique index role_only_one_holds_every_right on role (rights_mode) where rights_mode = 'all';


/* One row per box in the matrix of moderator rights.
 *
 * Two groups because they are two different actions on two different things
 * (rights.ts): editing an entity changes a record, deciding in a queue lets
 * somebody else's work out or hands it back, and somebody may be trusted to
 * judge results without being trusted to rewrite the price list.
 *
 * `code` is the key the portal already writes a right down under - entity:members,
 * queue:results - and it is GENERATED rather than a column somebody fills in.
 * The front end had the same choice and made the same one, for the reason
 * written beside it: a key built out of the thing it guards is spelt once and
 * cannot go missing, where a key fetched by a name made from it can come back
 * empty and leave a door standing open. Here that means a right whose code and
 * whose pair disagree is not a row that can be written.
 *
 * The prefix is not decoration either. An entity and a queue can carry the same
 * id, and two of them do: teams is an entity to edit and a queue of teams
 * somebody proposed, which are not remotely the same permission.
 *
 * There is deliberately no unique key over (scope, target). It would be the
 * same sentence as the one on `code`, because neither side may hold a colon:
 * the scope is one of two words and the shape check refuses one in the target.
 * That is what makes the composed key unambiguous, and it is why the shape
 * check is a constraint and not a comment.
 *
 * `code` deliberately carries no NOT NULL. Both of its inputs are NOT NULL, so
 * the expression cannot yield one, and a constraint no row can break is an
 * intention wearing a constraint's clothes. */
create table admin_right (
    id     bigserial not null,
    scope  text      not null,
    target text      not null,
    code   text generated always as (scope || ':' || target) stored,

    constraint admin_right_pk primary key (id),
    constraint admin_right_code_unique unique (code),

    constraint admin_right_scope_known check (scope in ('entity', 'queue')),
    constraint admin_right_target_shape check (target ~ '^[a-z][a-zA-Z0-9]*$')
);


/* The four the owner decided on 08.09.2026, and no others. A league organiser,
   a sponsor and a boutique are roles the portal knows as a concept (PDL P21,
   P20) and are not rows here; see the head of this file. */
insert into role (code, rights_mode) values
    ('visitor', 'none'),
    ('competitor', 'none'),
    ('moderator', 'granted'),
    ('superadmin', 'all');

/* Six entities and six queues.
 *
 * The entities are ENTITY_FORMS less the ones no moderator may ever open, and
 * the moderators are the only such entity today: a column for it was a box the
 * superadmin could tick, a row that then read one right more, and a moderator
 * who got the same refusal as before (ADL A8, 30.07.2026). The exclusion is a
 * fact about the entity - superadminOnly - and not a special case here, so a
 * second such entity leaves the matrix on the day it is marked.
 *
 * The queues are QUEUES whole: the five that wait in a file and the results a
 * competitor sends in during the visit. */
insert into admin_right (scope, target) values
    ('entity', 'members'),
    ('entity', 'events'),
    ('entity', 'teams'),
    ('entity', 'leagues'),
    ('entity', 'pages'),
    ('entity', 'pricing'),
    ('queue', 'results'),
    ('queue', 'payments'),
    ('queue', 'teams'),
    ('queue', 'profiles'),
    ('queue', 'comments'),
    ('queue', 'schedule');
