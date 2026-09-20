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
 * sixteen names the portal serves in {@code ducats.json} split in two, and
 * NEITHER half is derived from anything: there is no „who holds it first" and no
 * „who holds it last" in this file at all. Every one of the sixteen is a SETTING
 * of the family of ducats, and the two halves differ in who the setting belongs
 * to:
 *
 * <ul>
 * <li><b>The condition and what it is worth - nine settings, and they are this
 * resource.</b> {@code id} (the code the ducat is known by), {@code name},
 * {@code kind} (which of the eleven quantities is counted), {@code value} (the
 * threshold, or the FIRST threshold when the family is a run), {@code period},
 * {@code tier}, and the three that carry a run: {@code step}, {@code last} (the
 * LAST THRESHOLD of the run, not the last holder of anything) and
 * {@code tierUpFrom}. All nine are columns of {@code ducat} in V15.</li>
 * <li><b>How the ducat is DRAWN - seven settings, and they are not here.</b>
 * {@code top}, {@code topFemale}, {@code bottom}, {@code periodAt}, {@code mark},
 * {@code art} and {@code counted}. V15 refused them a column in as many words:
 * „How a badge is DRAWN - its mark, its artwork, the words above and below the
 * number - is the portal's and stays in the portal, keyed by the code below. The
 * schema decides who gets what; it does not decide what that looks like." They
 * are named as omissions at the call site in {@code DucatApiTest}, each with that
 * reason, and each is checked to be a name the portal really serves.</li>
 * </ul>
 *
 * <p><b>What IS derived lives in the portal and is derived from these nine.</b>
 * Which ducats of a family exist by a given day, and what one of them is worth
 * once the run has risen a tier, are worked out from {@code period}, {@code step},
 * {@code last} and {@code tierUpFrom} ({@code data/ducatRule.ts}). A table of
 * instances would be twenty-eight rows typed every first of January (ADL A12, 7),
 * so nothing of the sort is stored and nothing of the sort is answered.
 *
 * <p><b>AND WHO HOLDS WHICH DUCAT IS NOT HERE EITHER.</b> V15 has the table -
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
 * <p><b>The boundary, written here rather than left for somebody to find.</b> The
 * portal cannot be switched from its file to this resource on its own: seven of
 * the sixteen names it reads by are not answered and cannot be, so the screen that
 * draws a wall of ducats has to join what this answers to the drawing it already
 * carries, by {@code id}. That is V15's decision working as intended and not a gap
 * in this resource, and it is the one thing whoever switches the portal over has
 * to know.
 *
 * <p><b>AND A RESOURCE THAT KNEW WHO IS ASKING WOULD NOT CLOSE THAT BOUNDARY
 * EITHER, which was measured on 20.09.2026 and is written here so it is not
 * measured again.</b> P-javno (ADL, 13.09.2026) sends everything Article 73 does not
 * list „iza resursa koji zna ko pita", and the seven above look from the outside
 * like seven more fields waiting behind that door. They are not waiting behind any
 * door: {@code ducat} has nine columns of content in V15 and NONE of them is a mark,
 * an artwork or a word above a number. The seven are not withheld from a visitor and
 * held for a member - <b>this server does not have them at all</b>, and the portal
 * does, which is exactly what V15 decided. So this resource takes no parameter
 * naming the caller: there is nothing here that could depend on him, and a parameter
 * saying otherwise would be a promise.
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
	 * One family of ducats: the condition, and what meeting it is worth.
	 *
	 * @param id         the code the ducat is known by and its drawing is keyed on,
	 *                   which is NOT the row's key - the portal names a ducat
	 *                   {@code duk-sve-trke} and a number would mean nothing to it
	 * @param value      the threshold, or the first threshold of a run
	 * @param step       how much the threshold grows per piece of the run, nought
	 *                   when the family is one ducat
	 * @param last       the last threshold of the run, nought when there is none
	 * @param tierUpFrom the threshold from which the rest of the run is worth one
	 *                   tier more, nought when it never rises
	 */
	record Ducat(String id, String name, String kind, BigDecimal value, String period,
			int tier, BigDecimal step, BigDecimal last, BigDecimal tierUpFrom) {
	}

	@GetMapping("/api/ducats")
	List<Ducat> ducats() {
		/* The four numbers come back as they are stored. The column is `numeric(12,2)`
		   and `DucatKind` says why - a count compared against a decimal through a double
		   is a comparison that can go wrong at the boundary, which is the one place a
		   ducat is decided - so nothing here narrows them to a whole number on the way
		   out. Every threshold happens to be whole today; the schema does not say it has
		   to stay that way. */
		return db.sql("select code, name, kind, threshold, period, tier, step, last, tier_up_from"
						/* FROM BRONZE TO GOLD, and the key breaks the tie within one metal.
						   Ordered by the key alone the answer would still be this list today,
						   because the catalogue was written in tier order; ordered by the code
						   or the name it would not be, and neither of those is an order anybody
						   decided. The case that separates the first two adds a sixteenth ducat
						   of the lowest tier, which the key alone would put last. */
						+ " from ducat order by tier, id")
				.query((row, one) -> new Ducat(row.getString(1), row.getString(2), row.getString(3),
						row.getBigDecimal(4), row.getString(5), row.getInt(6),
						row.getBigDecimal(7), row.getBigDecimal(8), row.getBigDecimal(9)))
				.list();
	}
}
