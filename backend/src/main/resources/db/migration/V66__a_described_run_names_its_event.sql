/* A RUN ON A RACE THE CALENDAR DOES NOT HOLD NAMES ITS EVENT, CHOSEN OR TYPED.
 *
 * Owner, PDL P9, 19.10.2026: „Događaj, trka i rezultat u jednoj formi, i za člana na „Mojim
 * rezultatima” i za moderatora", and of the member's form, in his words: „Prvo ima naziv događaja
 * koji je autocomplete iz baze, ali mogu da unesem novu vrednost." Until this file a run described
 * by the member named a race and nothing else (V10), so the approval made an event named by the
 * moderator alone and the member had no way to say which event he had run at.
 *
 * And the same day, choosing among the outcomes offered, with my recommendation: „Prijava pamti
 * događaj koji je član izabrao, a moderator ga pri odobrenju sme promeniti; za stare prijave i
 * otkucano ime traži se po nazivu i godini." So the submission keeps what the member said and no
 * more: the event he CHOSE, by its key, or the name he TYPED. The moderator decides at approval
 * which event the race goes on, and what is kept here is what his screen starts from.
 *
 *
 * TWO COLUMNS, CHOSEN OR TYPED, NEVER BOTH
 * ----------------------------------------
 * The shape V10 already gives the town of the same row (`place_id` or `city`, never both), copied
 * with its guards rather than invented: a key where the member chose an event out of the calendar,
 * the name as he typed it where the calendar has no such event. The key and not a copy of the
 * event's name beside it, because an event renamed while the run waits would leave the copy saying
 * something the calendar no longer does - two homes of one name.
 *
 * NEITHER IS REQUIRED OF A DESCRIBED RUN, and that is a boundary rather than an oversight:
 *   - every row already standing names no event, and the decision says what is done with those
 *     („za stare prijave ... traži se po nazivu i godini"), which is the screen's lookup and not a
 *     value this file could invent for them;
 *   - and the member's form that sends the event is a later pull request than this one (7a-e), so
 *     until it ships the form sends no event and the run must still go in.
 * Whether a described run must name its event once that form ships is not decided here.
 *
 * ONLY A DESCRIBED RUN NAMES ONE. A run on a race of the calendar has its event through its race,
 * and a second answer here could disagree with it; the approval writes the run onto a race of the
 * calendar and clears both columns with the race's own description (VerificationWriteApi).
 *
 *
 * WHAT HAPPENS WHEN THE EVENT GOES
 * --------------------------------
 * `on delete set null`, and not cascade: an event the administration deletes while a member's run
 * waits on it is not a reason to lose the run. The row then names no event, which is exactly the
 * shape of every row written before this file, and the moderator chooses as he does for those. The
 * typed name is not kept in its place, because the member never typed one: he chose.
 *
 *
 * WHAT IT DOES TO THE ROWS THAT ARE ALREADY THERE
 * -----------------------------------------------
 * Nothing. Both columns are added empty, and every constraint below is satisfied by a row whose
 * two columns are empty, whatever else it holds. `ResultSubmissionEventCarriedOverTest` runs this
 * file over the shapes the table holds (a run from the calendar, a described run with a town of
 * the codebook and with a typed one, a correction) and holds that each is still there and still
 * names no event.
 *
 * This file does not change once it is applied (ADL A2); a correction is the next migration.
 */
alter table result_submission
    add column event_id bigint,
    add column event_name text collate sr_latn;

alter table result_submission
    add constraint result_submission_event_fk foreign key (event_id) references btl_event (id)
        on delete set null,

    /* Only a run the member describes names an event; a run from the calendar has its race's. */
    add constraint result_submission_only_a_described_run_names_its_event
        check (race_id is null or (event_id is null and event_name is null)),

    /* Chosen or typed, never both: `result_submission_town_is_from_the_codebook_or_typed`, one
       column along. */
    add constraint result_submission_event_is_chosen_or_typed
        check (event_id is null or event_name is null),

    add constraint result_submission_event_name_not_blank
        check (event_name is null or btrim(event_name) <> '');

/* The other end of `result_submission_event_fk`, which an event deleted reads to set it empty. */
create index result_submission_event_idx on result_submission (event_id);
