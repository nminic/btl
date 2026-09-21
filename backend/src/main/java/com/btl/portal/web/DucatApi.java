package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

/**
 * THE DUCATS AND WHAT EACH OF THEM IS EARNED FOR.
 *
 * <p>Article 73 of the rulebook lists what a public competition publishes, and
 * this resource is one line of it: „Bodovi, plasman, statistika, <b>dukati i
 * priznanja</b>". The rulebook's own section on ducats is written for the reader
 * of it - „Dodeljuje se automatski, onog trenutka kad ono što ste istrčali pređe
 * granicu koja na njemu piše" - and a threshold nobody can read is a rule nobody
 * can meet. So the condition is public, and it is public to a visitor who is not
 * signed in, because it is what somebody deciding whether to join reads first.
 *
 * <p><b>WHAT A FIELD OF THIS ANSWER IS, measured rather than assumed.</b> The
 * sixteen names the portal serves in {@code ducats.json} are answered here, all
 * sixteen, and NONE of them is derived from anything: there is no „who holds it
 * first" and no „who holds it last" in this file at all. Every one of the sixteen
 * is a SETTING of the family of ducats, and they fall into two halves:
 *
 * <ul>
 * <li><b>The condition and what it is worth - nine settings.</b> {@code id} (the
 * code the ducat is known by), {@code name}, {@code kind} (which of the eleven
 * quantities is counted), {@code value} (the threshold, or the FIRST threshold
 * when the family is a run), {@code period}, {@code tier}, and the three that
 * carry a run: {@code step}, {@code last} (the LAST THRESHOLD of the run, not the
 * last holder of anything) and {@code tierUpFrom}. All nine are columns of
 * {@code ducat} in V15.</li>
 * <li><b>How the ducat is DRAWN - seven settings, and V27 is where they came
 * from.</b> {@code top}, {@code topFemale}, {@code bottom}, {@code periodAt},
 * {@code mark}, {@code art} and {@code counted}. V15 refused them a column and
 * said so in as many words; V27 overturns that and gives the reason at length.
 * The short of it: what crosses over is not a picture but a codebook - which of
 * seven marks the portal draws, which of three artworks, and the words on the two
 * arcs - and the ducats are a codebook by the owner's own decision of 10.08.2026,
 * „Spisak dukata je zatvoren i ugrađen".</li>
 * </ul>
 *
 * <p><b>And the seven are not a widening of what is public.</b> P-javno (ADL,
 * 13.09.2026) says „javno je ono što Član 73 nabraja, i ništa više", and these
 * seven are the legend struck on a coin the portal already draws for a visitor
 * who is not signed in. Nothing about a person is in them: no member, no number,
 * no figure anybody reached. What changes is where the words are kept, never who
 * may read them.
 *
 * <p><b>What IS derived lives in the portal and is derived from these.</b> Which
 * ducats of a family exist by a given day, and what one of them is worth once the
 * run has risen a tier, are worked out from {@code period}, {@code step},
 * {@code last} and {@code tierUpFrom} ({@code data/ducatRule.ts}), and which of
 * the two legends a woman reads is worked out from {@code top} and
 * {@code topFemale} by the same file. A table of instances would be twenty-eight
 * rows typed every first of January (ADL A12, 7), so nothing of the sort is
 * stored and nothing of the sort is answered.
 *
 * <p><b>AND WHO HOLDS WHICH DUCAT IS NOT HERE.</b> V15 has the table -
 * {@code ducat_award}, with the snapshot of what the member had when he won it -
 * and Article 73 does make a recognition public. It is left out all the same,
 * because no screen reads it: the portal serves fifteen definitions under this
 * name and nothing else, and a server that answers with more than the portal asks
 * for is a server publishing on the chance it will be wanted. When a screen needs
 * it, it is its own increment with its own decision about the ORDER those
 * recognitions come back in - and the field that names the holder will be the
 * MEMBER NUMBER, which is what Article 73 makes public, never a name beside
 * anything else off the member's row. {@code DucatApiTest} measures that nothing
 * about a member who holds a ducat leaves through this route today.
 *
 * <p><b>The boundary that used to be here is gone, and this says so because the
 * next reader will look for it.</b> Until 20.09.2026 this javadoc ended on a
 * warning: seven of the sixteen names the portal reads by could not be answered,
 * so „the screen that draws a wall of ducats has to join what this answers to the
 * drawing it already carries, by {@code id}". That join is no longer needed and
 * the switch from the file to this resource is no longer blocked by anything
 * here. What still holds is the sentence under it: this resource takes no
 * parameter naming the caller, because there is nothing here that could depend on
 * him and a parameter saying otherwise would be a promise.
 *
 * <p><b>The one thing still waiting is a language, and it is not waiting on
 * this.</b> ADL.md (18.09.2026) asks for „imena i opisi dukata" to be translated.
 * No mechanism for a translation exists and {@code name} has not got one either;
 * the seven legends are in exactly {@code name}'s position and will move when it
 * does. Nothing here names a language.
 *
 * <p><b>From bronze to gold</b>, which is the order the rulebook speaks of them in:
 * „od bronzanih, koje mnogi osvoje već u prvoj sezoni, preko srebrnih, do zlatnih,
 * koji se skupljaju godinama". Within one metal the order is the one the catalogue
 * was written in, because nothing else about two ducats of the same tier ranks one
 * before the other.
 */
@RestController
class DucatApi {

	private final JdbcClient db;

	DucatApi(JdbcClient db) {
		this.db = db;
	}

	/**
	 * One family of ducats: the condition, what meeting it is worth, and the coin it
	 * is struck on.
	 *
	 * <p>The components are in the order the portal's own file writes them, so the
	 * answer and {@code ducats.json} read alike side by side, which is how the two
	 * are compared.
	 *
	 * @param id         the code the ducat is known by and its drawing is keyed on,
	 *                   which is NOT the row's key - the portal names a ducat
	 *                   {@code duk-sve-trke} and a number would mean nothing to it
	 * @param value      the threshold, or the first threshold of a run
	 * @param top        the legend along the top arc of the coin, empty when the
	 *                   period stands there
	 * @param topFemale  the same legend for a woman, empty when the wording does not
	 *                   change, which is seven of the fifteen
	 * @param bottom     the legend along the bottom arc, empty when the period
	 *                   stands there
	 * @param periodAt   which of the two arcs the period takes, or neither
	 * @param mark       which of the seven marks is struck at nine and three o'clock
	 * @param art        what stands in the middle when a number would say less:
	 *                   nothing, a galaxy, a globe
	 * @param step       how much the threshold grows per piece of the run, nought
	 *                   when the family is one ducat
	 * @param last       the last threshold of the run, nought when there is none
	 * @param tierUpFrom the threshold from which the rest of the run is worth one
	 *                   tier more, nought when it never rises
	 * @param counted    what a piece of a run is counted in („trka", „država"), empty
	 *                   for a family that is one ducat
	 */
	record Ducat(String id, String name, String kind, BigDecimal value, String period,
			String top, String topFemale, String bottom, String periodAt, String mark, String art,
			int tier, BigDecimal step, BigDecimal last, BigDecimal tierUpFrom, String counted) {
	}

	@GetMapping("/api/ducats")
	List<Ducat> ducats() {
		/* The four numbers come back as they are stored. The column is `numeric(12,2)`
		   and `DucatKind` says why - a count compared against a decimal through a double
		   is a comparison that can go wrong at the boundary, which is the one place a
		   ducat is decided - so nothing here narrows them to a whole number on the way
		   out. Every threshold happens to be whole today; the schema does not say it has
		   to stay that way.

		   The seven of the drawing are text and come back as text. An empty one is empty
		   and never null: V27 forbids a null in all seven, because „this ducat has no
		   bottom legend" and „this ducat has an empty bottom legend" are the same
		   sentence and the portal reads the second. */
		return db.sql("select code, name, kind, threshold, period,"
						+ " top, top_female, bottom, period_at, mark, art,"
						+ " tier, step, last, tier_up_from, counted"
						/* FROM BRONZE TO GOLD, and the key breaks the tie within one metal.
						   Ordered by the key alone the answer would still be this list today,
						   because the catalogue was written in tier order; ordered by the code
						   or the name it would not be, and neither of those is an order anybody
						   decided. The case that separates the first two adds a sixteenth ducat
						   of the lowest tier, which the key alone would put last. */
						+ " from ducat order by tier, id")
				.query((row, one) -> new Ducat(row.getString(1), row.getString(2), row.getString(3),
						row.getBigDecimal(4), row.getString(5),
						row.getString(6), row.getString(7), row.getString(8), row.getString(9),
						row.getString(10), row.getString(11),
						row.getInt(12), row.getBigDecimal(13), row.getBigDecimal(14),
						row.getBigDecimal(15), row.getString(16)))
				.list();
	}
}
