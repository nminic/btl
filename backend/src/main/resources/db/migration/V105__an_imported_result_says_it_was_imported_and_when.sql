/*
 * AN IMPORTED RESULT SAYS IT WAS IMPORTED, AND WHEN: a third way a result is brought in, beside an approval and
 * the league's entry.
 *
 * Owner, PDL, 16.11.2026, chosen between the options offered: a result written by the import tool carries
 * `brought_by = 'import'` and the moment it was written in `brought_at`, and "Dukat se javlja samo ako je prag
 * preveo odobren rezultat i nijedan uvezen rezultat među prebrojanim nije stigao posle njega." The ducats an
 * import brings are written in silence ("Potpuno tiho", the same day). Until this file an imported result had
 * no moment at all, and a moment is what lets the portal tell an approval that came after an import from one
 * that came before it.
 *
 * ONE RULE WIDENED BY ONE WORD, AND NOTHING ELSE. `result_brought_by_known` (V97) is written again under its
 * own name with 'import' beside 'approval' and 'league'; `result_brought_at_and_by_together` already asks an
 * imported result for its moment, so it is not touched. The words are read back by
 * `BroughtMatchesTheSchemaTest`, which holds the rule and `AwardingDucats.Brought` equal both ways.
 *
 * ROWS ALREADY STANDING ARE NOT TOUCHED, and that is on purpose. The results imported before this file (2176 on
 * production on 16.11.2026) carry no moment and no way, which is the true state of them: nobody wrote down when
 * they came in, and a moment read off anything else would be made up (the reason V97 gives for the same rows).
 * They stay the history, whose ducats are written in silence. No default is given to either column, so a
 * result written without them is still the empty pair. Measured over rows written as a database holds them by
 * ResultImportedCarriedOverTest.
 */
alter table result
    drop constraint result_brought_by_known,
    add constraint result_brought_by_known check (brought_by in ('approval', 'league', 'import'));
