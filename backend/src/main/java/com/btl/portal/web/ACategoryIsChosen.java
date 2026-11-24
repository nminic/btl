package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * A CATEGORY CHOSEN FOR A MEMBER, BY WHOEVER CHOOSES IT: THE ONE HOME OF THE WRITE.
 *
 * <p><b>Two routes write a wish and both write it here</b>, so the two cannot come to disagree about the
 * deadline, the season or what is kept: {@link MeCategoryWriteApi}, the member on „Moja članarina", and
 * {@link MemberCategoryApi}, the administration on the card „Podaci". Owner, 24.11.2026 (PDL, „Administracija
 * bira kategoriju članu u njegovim podacima, a u prijavi je starosna podrazumevana"): „Ma hocu da imam izbor
 * u podacima clana koje vidim sa njegove strane (edit, ili kad sa profila kliknem na podaci)". And the rule
 * written beside it, which is the assistant's derivation and not the owner's words: „Izbor u podacima člana
 * radi po istim pravilima kao članov izbor na „Mojoj članarini” (sezona u prodaji, portal proverava pravo na
 * početničku, isti rok)". Each of the three is one line below, and none is a line of either route.
 *
 * <p><b>WHAT IS KEPT IS THE WISH, AND A WISH WITH NO RIGHT BEHIND IT IS KEPT TOO</b> (PDL P7, 26.09.2026, „Ono
 * što se čuva je ŽELJA, ne kategorija"): the right is asked every time the choice is READ
 * ({@link TheChoiceAsItStands}), so nothing here refuses it, for the administration exactly as for the member.
 */
@Component
class ACategoryIsChosen {

	private final JdbcClient db;

	private final TheChoiceAsItStands theChoice;

	ACategoryIsChosen(JdbcClient db, TheChoiceAsItStands theChoice) {
		this.db = db;
		this.theChoice = theChoice;
	}

	/**
	 * The choice before the write and after it, both read whole, so a caller can tell whether the wish
	 * moved without reading it a second way.
	 */
	record Chosen(MeCategoryApi.Choice before, MeCategoryApi.Choice after) {

		boolean theWishMoved() {
			return before.firstSeason() != after.firstSeason();
		}
	}

	/**
	 * Writes the wish for the season the box is for, or nothing at all once the deadline has passed.
	 *
	 * <p><b>The deadline is asked of {@link TheChoiceAsItStands} as a whole answer</b>, which works out
	 * which season is being chosen and whether it is still open from ONE moment; read as two more clock
	 * calls here, the write would be free to disagree with the read beside it about which season is even
	 * shown.
	 *
	 * @param member {@code competitor.id}, which each route has resolved for itself: off the session for
	 *               the member, off the member number in the address for the administration
	 * @return null where the choice is shut, which each route answers as {@link MeCategoryWriteApi#THE_CHOICE_IS_SHUT}
	 */
	Chosen choose(long member, boolean firstSeason) {
		MeCategoryApi.Choice before = theChoice.of(member);

		if (!before.open()) {
			return null;
		}

		write(member, before.season(), firstSeason);

		/* AND THE ANSWER IS WORKED OUT AGAIN RATHER THAN ECHOED: `firstSeasonAllowed` is a sum over his
		   results and `category` is the wish AND that right, and neither is in the request. */
		return new Chosen(before, theChoice.of(member));
	}

	/**
	 * THE WRITING, WHICH TOUCHES ONE ROW: THIS MEMBER'S, FOR THE SEASON THE BOX IS FOR.
	 *
	 * <p><b>An insert that becomes an update</b>, because a season may have no row of its own yet: it reads
	 * the last one before it until somebody ticks the box (PDL, 30.10.2026), and the first tick for a new
	 * season is the moment that season gets one.
	 *
	 * @param season the season the deadline was just asked of, never read again here
	 */
	private void write(long member, int season, boolean beginner) {
		db.sql("insert into category_wish (competitor_id, season, beginner) values (?, ?, ?)"
						+ " on conflict (competitor_id, season) do update set beginner = excluded.beginner")
				.params(member, season, beginner)
				.update();
	}
}
