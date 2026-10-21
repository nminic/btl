/*
 * The two towns called Stari Grad in Croatia are told apart by the town they stand by, and
 * the label that says it is now the right one.
 *
 * Owner, 20.10.2026 (PDL, "Stari Grad (Omiš)" i "Stari Grad (Gospić)" u šifarniku mesta
 * postaju "Stari Grad (Hvar)" i "Stari Grad (Pag)", ručno, po presedanu Kočevja), chosen between
 * the offered answers, with the coordinator's recommendation. PENDING 28046 is where it was found: the rule that
 * told the namesakes apart (V51) took the nearest bigger town with more than five thousand
 * inhabitants, and for these two that is a town nobody from the place would name. 3189965 is Stari
 * Grad on the island of Hvar, whose town of Hvar is 12.6 km away and the label V51 gave it was
 * Omiš; 3216885 is the Stari Grad by Pag, 1.7 km from the town of Pag, and its label was Gospić.
 * Both towns are in the codebook already (V3: Hvar at rank 36771, Pag at rank 38372, both above
 * the Stari Grads at 39176 and 39202), so the label is still the name of a bigger town of the
 * same country, which is what SameNamedTownsAreToldApartTest asks of every label.
 *
 * THE PRECEDENT IS THE LABELS OF KOČEVJE, and its shape is copied: V51 loaded "Dolga Vas
 * (Kočevje)" and "Dolenja vas (Kočevje)" where the rule's own answer was "Općina Kočevje", by hand
 * (the coordinator, 02.10.2026), and this is the same kind of correction. What is copied
 * is the statement V51 writes a codebook change with, an UPDATE over a VALUES list that identifies
 * every town by its GeoNames mark (ADL A16) and never by its position or by its name, and the floor
 * that holds it: the source file frontend/src/test/mock/places.json carries the same two names
 * (ReferenceDataMatchesCodebookTest), and SameNamedTownsAreToldApartTest pins both by mark.
 *
 * WRITTEN BY HAND AND NOT BY THE GENERATOR, and that is the owner's word ("ručno"). The
 * generator's --delta would write the same two UPDATEs out of the changed source file; what it
 * cannot carry is the reason, which is why this says it.
 *
 * WHAT IS NOT TOUCHED, which is most of it. A rename changes the one column and keeps the row, so
 * its key, its rank, its country and its English name are exactly what they were, and every row
 * that points at the town keeps pointing at it: a member's place (competitor_place_fk), an event's
 * (btl_event_place_fk), a run waiting to be judged (result_submission_place_fk) and a team's
 * (team_place_fk) all hold the key, never the name. Measured by
 * StariGradIsRenamedCarriedOverTest against rows that name the old towns before this runs. No
 * constraint is added, so there is no row that could refuse one (CLAUDE.md, section 11).
 *
 * THE GUARD IS THE OLD NAME. A town is renamed only if it still carries the label V51 gave it, so
 * a database in which somebody has already written either name by hand (or in which V51's label
 * has since moved) is left as it is rather than overwritten with a name chosen for a town this file
 * did not see. The unique key on the country and the name cannot be hit either way: neither
 * "Stari Grad (Hvar)" nor "Stari Grad (Pag)" is carried by any other town of Croatia, and
 * place_country_name_unique (V52) would refuse the second one if it were.
 *
 * There is no "set constraints all deferred" here, unlike V51, and that is on purpose: the three
 * order keys V51 deferred are about rows moving in an order, and nothing moves.
 */
update place as p
   set name = v.new_name
  from (values
           (3189965, 'Stari Grad (Omiš)', 'Stari Grad (Hvar)'),
           (3216885, 'Stari Grad (Gospić)', 'Stari Grad (Pag)')
       ) as v (geonames_id, old_name, new_name)
 where p.geonames_id = v.geonames_id
   and p.name = v.old_name;
