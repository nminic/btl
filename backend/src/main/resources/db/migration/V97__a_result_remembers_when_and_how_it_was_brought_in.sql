/*
 * A RESULT REMEMBERS WHEN AND HOW IT WAS BROUGHT IN: THE MOMENT A MODERATOR APPROVED IT OR THE LEAGUE ENTERED
 * IT, AND WHICH OF THE TWO.
 *
 * Owner, PDL, 12.11.2026: "Portal pamti koji je rezultat doneo dukat i kad je rezultat odobren. Poruka
 * "Osvojili ste dukat" nabraja samo dukate iz rezultata odobrenih od početka dodele, i piše se u istoj
 * transakciji sa dukatom." And the same day: "Tiho ostaje samo ono što dolazi iz rezultata odobrenih pre
 * početka dodele."
 *
 * WHICH RESULT BROUGHT A DUCAT IS ALREADY REMEMBERED, and this file does not add it a second time. V91's
 * `ducat_award.result_id` is the result that carried the member over the threshold (the crossing, in the
 * order the races were run), with ON DELETE SET NULL (result_id): the way a deleted result already leaves
 * a ducat to the reconciliation that decides whether it goes. A second pointer would be a second home of
 * one fact.
 *
 * `brought_at` - the moment the result was approved (a run a member sent, or a correction of one he
 * holds) or entered by the league. Written by the approval and the entry in the transaction that writes
 * the result, from the portal's clock.
 *
 * `brought_by` - which of the two: 'approval' or 'league'. The message about a ducat begins "Odobren vam
 * je rezultat" for the one and "Liga vam je unela rezultat" for the other (owner, 08.11.2026), and the
 * night job, which writes a ducat with no act in front of it, has nowhere else to read it from.
 *
 * "FROM THE START OF AWARDING" is not a column and not decided here. It is one constant in the code
 * (`AwardingDucats.AWARDING_BEGAN`), and a result was approved from then on exactly when its `brought_at`
 * is at or after it.
 *
 * ROWS ALREADY STANDING STAY EMPTY, and that is the true state of them, not a gap. A result approved or
 * entered before this file has no recorded moment: the history imported from the old portal never had one,
 * and a moment read off anything else (the day of the race, the moment a submission was decided) would be
 * a record of an approval at a time nobody wrote down. No moment is made up. An empty `brought_at` is a
 * result from before the start of awarding, and the ducats it brings are written in silence. Both new
 * rules accept the empty pair, so every row a database holds goes through; measured by
 * ResultBroughtInCarriedOverTest.
 */
alter table result
    add column brought_at timestamptz,
    add column brought_by text;

alter table result
    add constraint result_brought_by_known check (brought_by in ('approval', 'league')),
    add constraint result_brought_at_and_by_together check ((brought_at is null) = (brought_by is null));
