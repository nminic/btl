package com.btl.portal.web;

import com.btl.portal.domain.category.Category;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.membership.WhatAMembershipChangeSays;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * THE BEGINNERS' CATEGORY THAT A MEMBERSHIP WRITTEN OR CANCELLED CLOSES OR OPENS AGAIN, AND THE LINE
 * THAT TELLS HIM.
 *
 * <p><b>Why a membership can move it at all.</b> Since 18.10.2026 a season counts toward the category
 * only where he was a member of it ({@link BestOfficialSeason}, PDL P9: a result of a year he was not a
 * member in „ne ulazi ni u jednu sezonsku tabelu, Top listu ni nagradu"). So a membership written for a
 * season whose approved results reach the threshold closes the category for the season after it, and a
 * cancellation („storno", PDL P8, 18.10.2026: „rezultati se ne brišu") can open it again. Until this
 * class only an approval ({@code VerificationWriteApi}), a correction of a race ({@code RaceWriteApi})
 * and the league's own entry ({@code ResultsByTheLeagueApi}) told him; the review of PR 563 found
 * that no membership write did.
 *
 * <p><b>The decisions.</b> PDL P7, 27.09.2026, the owner's choice among the outcomes offered: „Poništen
 * izbor početničke kategorije se javlja članu, sa razlogom." PDL P4, 10.10.2026, for a correction of a
 * race, the line goes „u oba smera"; the same holds here, because a cancellation is to a membership
 * what a downward correction is to a run. The words: {@link WhatAMembershipChangeSays#beginnersCategoryMoved}.
 *
 * <p><b>The shape is the three precedents'</b>: the right is asked before the write and after it, in
 * the one transaction, and the line goes only when the answer changed. The right is asked of the two
 * homes that own its halves, {@link BestOfficialSeason} for the points and {@link Category} for the
 * threshold, exactly as those three ask it and as {@code TheChoiceAsItStands} asks it for the screen;
 * nothing here counts a point or knows a number.
 *
 * <p><b>THE SEASON ASKED IS THE ONE AFTER THE MEMBERSHIP'S, NEVER ITS OWN.</b> {@link BestOfficialSeason}
 * counts a season only toward the seasons after it, so a membership of a season can never move that
 * season's own category. It is worked out once, in {@link #before}, and the line names the very number
 * the right was asked for. A membership of the season on sale from 15 October has no approved runs yet
 * (a race is not entered before it is run), so writing one moves nothing and no line goes; that is the
 * arithmetic and not a condition written here.
 *
 * <p><b>It is sent whether or not he ever ticked the box</b>, for {@code VerificationWriteApi}'s reason:
 * the wish lives in a column whose name carries a season ({@code competitor.first_season_2027}), and
 * what the line reports is true either way.
 *
 * <p><b>Under the league's name</b>, which is what every line on these roads is sent under: PDL P13,
 * 19.09.2026, „Kad portal sam piše poruku članu, pošiljalac je naziv lige."
 *
 * <p><b>Called by the routes and not by the statements that write the row</b>, and that is the one thing
 * here a later edit could get wrong. The change of basis on the member's row
 * ({@link MemberMembershipApi}) deletes the season's row and writes it again in one transaction, and
 * reaches {@link BookingAPayment} and {@link GrantingASeason} between the two; asked there, the right
 * would be read with the row gone and then with it back, and the member told his category had closed
 * when nothing about it moved. So every route that writes or cancels a season asks {@link #before} once
 * its member is locked and before its first write, and {@link #tellHimIfItMoved} after its last one. The
 * change of basis asks neither, on purpose: the season stands before it and after it, on whatever
 * basis, and {@link BestOfficialSeason} reads no basis.
 */
@Component
class ABeginnersCategoryAMembershipMoves {

	private final JdbcClient db;

	private final BestOfficialSeason bestOfficialSeason;

	ABeginnersCategoryAMembershipMoves(JdbcClient db, BestOfficialSeason bestOfficialSeason) {
		this.db = db;
		this.bestOfficialSeason = bestOfficialSeason;
	}

	/**
	 * Whether the category was open to him for the season after this one, asked before anything is
	 * written.
	 *
	 * @param member {@code competitor.id}, already locked by the route
	 * @param season the season whose membership the route is about to write or cancel
	 */
	Before before(long member, int season) {
		int theSeasonAfter = season + 1;

		return new Before(member, season, theSeasonAfter, isOpen(member, theSeasonAfter));
	}

	/**
	 * And the line in his inbox when the write changed that answer, in either direction; nothing when it
	 * did not, which is the ordinary case.
	 */
	void tellHimIfItMoved(Before before) {
		boolean open = isOpen(before.member(), before.theSeasonAfter());

		if (open == before.wasOpen()) {
			return;
		}

		Said said = WhatAMembershipChangeSays.beginnersCategoryMoved(open, before.season(),
				before.theSeasonAfter());

		/* ALWAYS ADDRESSED: `message.to_id` left empty means EVERYBODY (V13). */
		db.sql("insert into message (to_id, from_id, from_name, subject, body) values (?, null, ?, ?, ?)")
				.params(before.member(), PairWriteApi.THE_LEAGUE, said.subject(), said.body())
				.update();
	}

	private boolean isOpen(long member, int season) {
		return Category.firstSeasonAllowed(bestOfficialSeason.pointsFor(member, season));
	}

	/**
	 * What {@link #tellHimIfItMoved} compares against.
	 *
	 * @param season         the season of the membership
	 * @param theSeasonAfter the season whose category was asked, worked out once
	 * @param wasOpen        the answer before the write
	 */
	record Before(long member, int season, int theSeasonAfter, boolean wasOpen) {
	}
}
