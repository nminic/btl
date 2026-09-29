package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.team.Membership;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.time.ZonedDateTime;
import java.util.List;

/**
 * WHETHER A TEAM HE IS ALREADY IN STANDS IN THE WAY OF HIM JOINING ANOTHER ONE, ASKED
 * WITHOUT THE TRANSFER WINDOW IN IT.
 *
 * <p><b>Why this exists beside {@link com.btl.portal.domain.team.JoiningATeam#mayJoin},
 * which already answers something very like it.</b> That method answers the COMPOSITE
 * question - the window and the team together - and answers the window FIRST, so on any
 * day outside 15 October to 31 December it says {@code THE_WINDOW_IS_SHUT} and never looks
 * at a membership at all. That is exactly right where it is asked: a member pressing
 * „Prijavi se u tim" or „Predloži tim" is refused by either half and told neither
 * ({@link TeamWriteApi}).
 *
 * <p><b>Three places need the OTHER half on its own, and every one of them is a place the
 * window must not answer for.</b>
 *
 * <ul>
 * <li><b>Sending an invitation.</b> PDL „Inkrement 134", 05.09.2026: „„Pozovi u tim" se
 * vidi samo kad taj drugi član nema tim". The window has already been asked of the
 * CALLER one statement earlier; what is asked here is about somebody else entirely, and
 * folding the window back in would answer „the window is shut" a second time under a
 * reason naming the invitee.
 * <li><b>Deciding an application.</b> PDL „Inkrement 134", 06.09.2026: „Prijava člana koji
 * je u međuvremenu dobio tim se timu ne prikazuje." That hiding holds on every day of the
 * year - a stale application is no more answerable in June than in November - so a
 * condition carrying the window would make the row visible again for nine months.
 * <li><b>Reading what he is waiting on.</b> PDL „Inkrement 134", 06.09.2026: „Poziv se ne
 * pamti kao odgovoren nego se pravo na odgovor računa u trenutku iscrtavanja. Čim član ima
 * tim, nijedan drugi poziv ne nudi „Prihvati"." {@link MyApplicationsApi} is that reading,
 * and the two states it has to tell apart are exactly the two the dictionary draws two
 * different sentences for: {@code teams.inviteWaits} („Poziv čeka") for a shut window,
 * which is still answerable in October, and {@code teams.inviteOvertaken} („U međuvremenu
 * si ušao/la u tim") for one that never will be. Asked with the window in it, the two
 * would be one answer and the portal would call a waiting invitation dead every January.
 * </ul>
 *
 * <p><b>THE RULE ITSELF IS NOT WRITTEN HERE AND MUST NOT BE.</b> What stands in the way is
 * {@link Membership#standsInTheWayOfJoiningIn}, and it is asked in Java over the rows
 * rather than spelt as a {@code where} clause, so that the sentence „a membership that ends
 * at or after the season he would join" has one home. Spelt as SQL it would have two, and
 * the repository has already measured what that costs: {@link VerificationWriteApi} carries
 * exactly that clause inline, with its own note admitting the rule belongs to the record -
 * <b>that copy is reported rather than moved, because touching the moderator's own decision
 * is a different increment with a different review.</b> A mutation to the record's method
 * therefore fails every caller of this class at once, which is the point of it.
 *
 * <p><b>THE SEASON IS {@link SeasonClock#transfersTakeEffect} AND THAT IS THE ONE PLACE
 * THIS CLASS COULD DISAGREE WITH {@code mayJoin}, so it is measured rather than assumed.</b>
 * {@code mayJoin} asks {@code seasonHeWouldJoin}, which is
 * {@link SeasonClock#seasonBeingPaidFor}, and the two methods genuinely differ for nine
 * months of the year. They cannot differ where {@code mayJoin} reads a membership at all:
 * inside the window {@code seasonBeingPaidFor} is the calendar year plus one and so is
 * {@code transfersTakeEffect}, both clamped to {@link SeasonClock#FIRST_SEASON} by the same
 * expression - and outside the window {@code mayJoin} has already returned. So on every
 * reachable path the two ask about one season. {@code transfersTakeEffect} is the one
 * written here because it is the number an acceptance really writes into
 * {@code team_membership.season_from} ({@link TeamJoiningWriteApi}), and the question this
 * class asks is „would that row be refused".
 *
 * <p><b>It asks nothing about the fee.</b> Whether a member is still a member is
 * {@code competitor.active}, one table away and one question along; every caller asks it
 * for itself, because the answer it wants differs - one refuses the caller, one hides a
 * row, and one leaves a name out of an answer.
 */
@Component
class ATeamHeIsAlreadyIn {

	private final JdbcClient db;

	ATeamHeIsAlreadyIn(JdbcClient db) {
		this.db = db;
	}

	/**
	 * Whether anything he has stands in the way of a new membership beginning in the season
	 * a change agreed at this moment takes effect in.
	 *
	 * @param competitor the member being asked about, who is never the caller in two of the
	 *                   three places this is asked
	 * @param at         the moment, in any zone: it is read in the league's own inside
	 *                   {@link SeasonClock}
	 */
	boolean standsInHisWay(long competitor, ZonedDateTime at) {
		int season = SeasonClock.transfersTakeEffect(at);

		return everyOneHeHasHad(competitor).stream()
				.anyMatch(one -> one.standsInTheWayOfJoiningIn(season));
	}

	/**
	 * EVERY MEMBERSHIP HE HAS EVER HAD, and not only the one that has not ended.
	 *
	 * <p>{@link Membership#standsInTheWayOfJoiningIn} says why it wants all of them: one he
	 * ended last season does not stand in the way of next, and one written ahead for a season
	 * still to come does. Read as „the open one", this would become „is he in a team today",
	 * which is a different question with a different answer - and since a member may leave
	 * inside the window ({@link TeamWriteApi#leave}), the two differ over rows that really
	 * exist rather than over ones nothing can write.
	 *
	 * <p><b>It is not private, and that is what keeps one query in one place.</b>
	 * {@link com.btl.portal.domain.team.JoiningATeam#mayJoin} takes the same list in order to answer the composite
	 * question, so {@link TeamJoiningWriteApi} would otherwise carry a second copy of this
	 * statement - and the day somebody narrowed one of the two to „the open one" the portal
	 * would answer two different things about one member.
	 */
	List<Membership> everyOneHeHasHad(long competitor) {
		return db.sql("select team_id, season_from, season_to, left_reason from team_membership"
						+ " where competitor_id = ?")
				.param(competitor)
				.query((row, one) -> new Membership(row.getLong(1), row.getInt(2),
						row.getObject(3, Integer.class), row.getString(4)))
				.list();
	}
}
