package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * WHAT MEMBERS WROTE ABOUT AN EVENT, and the first resource of this portal that
 * asks who is reading.
 *
 * <p><b>Comments are read by members and by nobody else.</b> The owner, 11.08.2026:
 * „komentare vide samo prijavljeni clanovi BTL. Drugim (posetiocima) se ne
 * prikazuju." A visitor sees the races and the results; what people said about a
 * running he does not. Nine resources came before this one and every one of them was
 * public, so this is also the first real load the layer of 13.09.2026 carries.
 *
 * <p><b>How that is enforced is by NOT being enforced here, and that is the whole
 * design of {@link ApiSecurity}.</b> Everything under {@code /api} is shut and a few
 * things are opened by name; this route is simply not among them, so the chain answers
 * 401 before any method here runs and no row is read to refuse anybody. There is no
 * condition in this class about who is asking, and there must not be one: a rule
 * written twice is a rule that can disagree with itself, and the half written here
 * would be the half that runs after the query.
 *
 * <p><b>And it needs no {@link RightIsNeeded}, which is a decision rather than an
 * omission.</b> That annotation carries the code of a box the superadmin ticks, and
 * reading a comment is not a moderator's action - EVERY signed in account reads these,
 * a plain competitor included. So this is the first route that is neither public nor
 * administrative, and it is named in {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT}
 * with that reason. That snapshot compares exactly, so the route could not have been
 * added quietly in either direction.
 *
 * <p><b>ONLY WHAT A MODERATOR LET OUT, and in this schema that is not a condition but a
 * table.</b> „Komentari idu kroz odobrenje pre objave" (PDL P18, „Komentari idu kroz odobrenje
 * pre objave") and „prikazuju se na dnu strane dogadjaja i to tek kad ih moderator odobri" (PDL
 * P28a, 06.08.2026, „Komentari se prikazuju na dnu strane"). V7 answers that by making {@code
 * event_comment} the record of what WAS published - the row is written when the approval happens,
 * and what is still waiting is a row in {@code verification} and nothing else. So „only the
 * approved ones" is the table this query names, and an unapproved comment is not filtered out
 * here: it was never in what this reads.
 *
 * <p><b>NOTHING IN THIS QUERY TOUCHES THE QUEUE FOR APPROVAL, and that has been a leak
 * once already.</b> The owner, 07.08.2026: „Javne strane ne smeju da preuzimaju red za
 * verifikaciju. Strana dogadjaja ga je citala da bi nasla odobrene komentare, pa je
 * svaki posetilac dobijao u pregledac adrese neaktiviranih clanova i tekstove
 * neodobrenih komentara, ukljucujuci i onaj sa reklamom za tudji link." The shape that
 * caused it was exactly the tempting one here - join the queue to find what was approved
 * - and it is refused by construction rather than by care: {@code verification} is not
 * named in this file at all. {@code CommentApiTest} puts rows in that queue that WOULD
 * change the answer if it were read, and measures that none of them does.
 *
 * <p><b>THE NAME IS THE ONE THE COMMENT WENT OUT UNDER, always.</b> {@code who} is V7's
 * tombstone and it is NOT NULL: „Komentar clana koji je napustio ligu ostaje sa imenom
 * pod kojim je objavljen" (PDL P28a, 06.08.2026, „Komentari se prikazuju na dnu strane"). It is
 * not read off the member's row and must not be, because a comment whose author is gone has no
 * row to read one off - the reference is {@code on delete set null} precisely so the comment
 * survives him.
 *
 * <p><b>AND THE MEMBER NUMBER IS THERE ONLY WHILE THERE IS A PROFILE TO READ, which is
 * the same question the portal already asks and the answer to the one thing this
 * increment had to decide.</b> „Komentar clana koji je napustio ligu nema vezu ka
 * profilu, pa ni kad je taj clan i dalje u zapisu", and the reason given on 07.08.2026
 * is that the code asked the wrong question: „ima li zapisa" umesto „ima li vidljivog
 * profila" (PDL P28a, 07.08.2026, „Komentar člana koji je napustio ligu nema vezu"). A member
 * whose fee has lapsed is still in the record and has no visible profile - {@code
 * /api/competitors} keeps him off its list altogether (owner, 13.09.2026) - and {@code
 * EventComments.tsx} says the same sentence from the browser's side in as many words.
 *
 * <p>So a comment of a member who did not renew DOES come back: it is published prose
 * and the decision above keeps it, with the name written on the day standing where the
 * link would be. What does not come back is his NUMBER, and that half is not a nicety.
 * It is the subtraction {@code PairApi} names: a number that is in this answer and not
 * in {@code /api/competitors} says, through the DIFFERENCE between two answers rather
 * than through any field in either, the one thing Article 74 puts beside the date of
 * birth - „sve u vezi sa clanarinom". The two readings point the same way here, which is
 * why this was not a question for the owner: the number is the profile link, and there
 * is no profile.
 *
 * <p><b>THE TOTAL MARK IS NOT ANSWERED, because it is not stored and must not be.</b>
 * „Ukupna ocena se ne cuva nego se racuna gde god se prikaze" (PDL P28a, 07.08.2026, „Ukupna
 * ocena se ne čuva nego se računa", 07.08.2026), and the reason is that a number derived from
 * three others has no fourth place to live: the first rounding somebody changed would leave two
 * different answers on one portal. The three marks are three columns (V7, PDL P6) and the total
 * is the reader's arithmetic ({@code OverallMark.tsx}). A fourth mark arriving inside {@code
 * rating} is what {@code CommentApiTest} refuses, against the file the portal serves rather than
 * against a list written here.
 *
 * <p><b>THE DAY IS THE DAY IN BELGRADE.</b> V7 stores {@code published_at} as a
 * timestamptz and says why: the day a race is run is a DAY, and a comment going out is a
 * technical instant. „Held in UTC; which day that is in Belgrade is the backend's
 * arithmetic" - so it is done here, in the zone {@code SeasonClock} owns, and never with
 * a zone written into the query. A comment published at half past eleven at night is
 * dated the next day, which is the day it was published in the league's own time.
 *
 * <p><b>Newest first, which is the order the page reads in and not a default.</b>
 * „Komentari se ucitavaju skrolovanjem, deset pre prvog dopunjavanja, od najnovijeg ka
 * najstarijem" (owner, 11.08.2026), and inherited comments from an earlier running go
 * „izlistano redom" among them rather than in a section of their own (owner,
 * 11.08.2026). The key breaks the tie so the order is total: two comments published in
 * the same instant would otherwise come back in whatever order the rows were written,
 * which for an imported history is no order at all, and the page that grows by ten would
 * reshuffle between two readings of data nobody touched.
 *
 * <p><b>Every comment of every event, in one answer.</b> That is the shape the portal
 * reads by: {@code EventComments.tsx} takes the whole list and keeps the ones belonging
 * to the event being drawn, together with the ones from its earlier runnings, which is
 * a rule about events rather than about comments („komentar za Beogradski maraton 2026.
 * mora biti vidljiv i uz izdanje iz 2027"). A resource answering per event would have had
 * to know that rule as well, and until 21.09.2026 the portal stayed on its own files
 * until every resource existed and then switched once (A50); PR 340 was that switch, and
 * {@code comments} is one of the fourteen names it carried to {@code /api}.
 */
@RestController
class CommentApi {

	private final JdbcClient db;

	CommentApi(JdbcClient db) {
		this.db = db;
	}

	/**
	 * @param memberNumber the author's, while there is a profile to lead to, and missing
	 *                     where there is not - a member who did not renew, or one who is
	 *                     gone altogether
	 * @param who          the name the comment went out under, which stays either way
	 */
	record EventComment(long id, long eventId, String memberNumber, String who, LocalDate date,
			Rating rating, String body) {
	}

	/** The three marks PDL P6 fixes, and no fourth: the total is worked out where it is drawn. */
	record Rating(int organisation, int value, int ambience) {
	}

	@GetMapping("/api/comments")
	List<EventComment> comments() {
		return db.sql("select c.id, c.event_id,"
						/* THE NUMBER ONLY WHILE THE PROFILE IS THERE TO READ. A left join and a
						   CASE rather than a condition on the rows: the comment comes back either
						   way, because it is published prose and the owner kept it (07.08.2026);
						   it is the LINK that goes. An author who is gone leaves `author.active`
						   null and the CASE answers nothing, which is the same sentence as one
						   who did not renew, and both are "no visible profile". */
						+ " case when author.active then author.member_number end,"
						/* OFF THE COMMENT AND NEVER OFF THE MEMBER. V7's tombstone: the name as it
						   was on the day, kept for an author who has no row left at all. Read from
						   `author` this column would be empty for exactly the comments it exists
						   for. */
						+ " c.who, c.published_at,"
						+ " c.rating_organisation, c.rating_value, c.rating_ambience, c.body"
						+ " from event_comment c"
						/* LEFT, because `competitor_id` is nullable on purpose: the reference is
						   `on delete set null` so that a comment survives its author. An inner
						   join here would delete from the portal every comment of everybody who
						   ever left, which is the opposite of what 06.08.2026 decided. */
						+ " left join competitor author on author.id = c.competitor_id"
						+ " order by c.published_at desc, c.id desc")
				.query((row, one) -> new EventComment(row.getLong(1), row.getLong(2),
						row.getString(3), row.getString(4),
						/* THE LEAGUE'S OWN ZONE, asked of the one place that holds it. Read as the
						   machine's day this would be right in Belgrade and wrong on a server kept
						   in UTC, which is every server this portal runs on. */
						row.getTimestamp(5).toInstant().atZone(SeasonClock.ZONE).toLocalDate(),
						new Rating(row.getInt(6), row.getInt(7), row.getInt(8)),
						row.getString(9)))
				.list();
	}
}
