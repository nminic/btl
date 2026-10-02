/* A town is told apart from its namesakes by its name in its country.
 *
 * Owner, 02.10.2026, PDL "Odluke iz ciscenja nalaza (02.10.2026, vlasnik)", the entry that begins
 * „Istoimena mesta u istoj drzavi dobijaju u zagradi": towns of one country that were called alike carry,
 * in brackets, the nearest bigger town, „Belotić (Bogatić)" and „Belotić (Šabac)", and from then on the
 * database refuses two equal names in one country. This file is that refusal. The renaming is the
 * migration that runs before it, written by generate_reference_migrations.py --delta out of the codebook
 * that btl-produkt/istorijski-podaci/oznaci-istoimena-mesta.py labelled, and it is the data this key
 * stands on: run over V3 alone this statement fails, and it should.
 *
 * The owner said it again the same day, in capitals where it matters: „Isključivo DUPLIRANI nazivi dobijaju u
 * zagradi veći mesto. Svi ostali nemaju." A town whose name no other town of its country carries has no label,
 * and one that does has one, a city as much as a village; the delta before this file renames those towns and
 * no others.
 *
 *
 * WHAT THIS REPLACES, AND WHY IT IS WRITTEN HERE
 * ----------------------------------------------
 * The header of V3 says there is deliberately no unique key over (name, country), because it would not
 * hold: one thousand six hundred and sixteen name and country pairs occurred more than once, and three
 * towns in China are all called Zhongshan. That was true on the day V3 was written. V3 cannot be edited
 * (ADL A2), so the correction stands in the file that makes it untrue: the key holds now, because those
 * towns are told apart by the delta before this one, and Zhongshan is no longer three towns of one name.
 * What V3 says about the mark is not touched. The mark is still what a town IS (owner, 08.09.2026, ADL
 * A16): a label is the nearest bigger town and moves when GeoNames does, so a name can stop meaning the
 * town it meant while the mark goes on meaning it.
 *
 *
 * OVER THE COUNTRY AND THE NAME, NOT THE NAME
 * -------------------------------------------
 * Boston stands in the United States and in England, and that is not two towns under one name in one
 * country. A key over the name alone would refuse the second Boston, and it would also refuse every other
 * name the codebook carries in more than one country, of which there are hundreds. The names are compared
 * letter for letter, which is what the database means by equal: `name` is collated by sr_latn and V1 made
 * that collation deterministic, so there is no case or accent folding under this key that a reader could be
 * surprised by.
 *
 *
 * DEFERRABLE INITIALLY IMMEDIATE, AS place_rank_unique BESIDE IT, AND THE REASON IS NOT AN ORDER
 * ----------------------------------------------------------------------------------------------
 * V3 gave the order key that shape because an order is maintained by moving a range of it. A name is
 * maintained by a delta moving it, and the case that shows the same thing is two towns of one country
 * exchanging their names: GeoNames moves the town a label names from one namesake to the other, and the
 * delta that follows is ONE UPDATE over a VALUES list. Measured on 02.10.2026 on postgres:18 over V3 and the
 * delta before this file: under a plain key that statement stops on the first row to be written,
 *
 *     ERROR: duplicate key value violates unique constraint "place_country_name_unique"
 *
 * because it lands on a name the second row has not given up; under this key it goes through, because the
 * check happens when the statement ends and by then the names are unique again. Initially IMMEDIATE, so
 * everything else is as strict as it was: a second town taking a name a town of its country already wears is
 * refused by the INSERT that writes it, with a statement to blame, and not at some COMMIT far away.
 * ConstraintsTest holds both halves over this key, and DeltaMigrationAppliesTest holds the exchange as a
 * delta the generator writes.
 *
 * A plain key would not have been free either. The header the generator writes into every delta names the
 * keys the deferral at its top cannot reach, and a test reads it, so a plain key here would have to be named
 * there and the exchange of two towns' names refused by the generator the way the exchange of two countries'
 * names already is. Deferrable, none of that is needed: the delta already says `set constraints all deferred`
 * first.
 *
 *
 * WHAT THE DEFERRAL COSTS, AND WHY IT COSTS NOTHING HERE
 * ------------------------------------------------------
 * KeysAndIndexesTest measures the two prices of a deferrable unique key. It is no ON CONFLICT arbiter, and no
 * foreign key may name it ("cannot use a deferrable unique constraint for referenced table"). Neither is wanted
 * of this key.
 * A town is pointed at by its mark, which is plain (place_geonames_id_unique), and the portal does not send a
 * town by its name to be resolved to a row: the name travels as typed text and country, and no statement on
 * the server compares a place name.
 *
 *
 * WHAT THE INDEX IS FOR, AND WHAT IT IS NOT
 * -----------------------------------------
 * The key brings an index over (country_id, name) of its own, about four times the size of place_country_idx.
 * That index is left alone: with both present PostgreSQL still answers "every town of one country" through
 * the narrower one, with and without statistics (KeysAndIndexesTest holds the plan), so this migration
 * neither drops it nor depends on it.
 */
alter table place
    add constraint place_country_name_unique unique (country_id, name) deferrable initially immediate;
