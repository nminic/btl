package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;

/**
 * THE RACING PAIRS, and only what the rulebook makes public about them.
 *
 * <p>Article 73 lists what is public and the racing pair is on it in as many
 * words: „Liga je javno takmičenje, pa su javni: ... Tim, trkački par i klub."
 * The member number is on the same list („Ime i prezime, članski broj i
 * kategorija"), so who the two of them are is public too. That is the whole of
 * what this resource answers with, and the owner's decision of 13.09.2026 says
 * it is also the whole of what it MAY answer with: „javno je ono sto Clan 73
 * nabraja, i nista vise. Sve ostalo ceka resurs koji zna ko pita."
 *
 * <p><b>AND THE DAY THE PAIR WAS MADE DOES NOT LEAVE, which is the one omission
 * here and the reason this class carries a note as long as the query.</b> What
 * the portal serves today ({@code mock/pairs.json}) carries {@code since}, and
 * {@code profile/RacingPairLine.tsx} draws it on a profile - anybody's profile,
 * not only the member's own. Article 73 names a day exactly once, and it is the
 * day of a verified RESULT („Svi verifikovani rezultati sa duzinom, usponom,
 * spustom, vremenom i datumom"). The day two people became a pair is not on the
 * list. It is also, by the portal's own definition, the day the second of them
 * ANSWERED an invitation ({@code data/types.ts}: „`since` is the day the second
 * of the two confirmed"), and Article 74 puts private messages among the things
 * that are never public. Two readings, and they point the same way; where they
 * did not, the owner's rule of 13.09.2026 settles it anyway: „Kad je sporno,
 * polje se IZOSTAVLJA, izostavljanje se imenuje sa razlogom." It is named in
 * {@code PairApiTest} at the call site, with the reason, and measured there twice
 * over - by name and as text, because a field renamed is a field that walks past
 * a check that only reads names.
 *
 * <p>What follows from that, and is owed: the sentence that profile draws needs
 * either the owner's word that the day of forming is public, or it loses its
 * date. Nothing is blank today, because the portal stays on its own files until
 * every resource exists and then switches once (A50).
 *
 * <p><b>THE TWO OF THEM COME BACK IN THE ORDER THE SCHEMA STORES THEM: the man
 * first.</b> A racing pair is mixed, one man and one woman (PDL), and V12 holds
 * that in the database rather than in a service: {@code man_id} and
 * {@code woman_id} are two named columns, each with a CONSTANT gender generated
 * beside it and a foreign key into {@code competitor (id, gender)}, so there is
 * no row the man's column could hold that is not a man. There is no column that
 * says "first" and none is needed. The order cannot drift either, and that is
 * the same foreign key: it may not cascade an update, so a member who is in a
 * pair cannot have his gender changed until the pair is gone (V12 says so in as
 * many words). The two pairs the portal serves today are both written man first,
 * which is the same answer from the other side.
 *
 * <p>Why a settled order is worth saying out loud: the board of best pairs
 * breaks its last tie on {@code memberNumbers[0]} and keeps the written order
 * when the two halves scored level ({@code data/derive.ts}). Answered in
 * whatever order a row came back in, the board would reshuffle between two
 * readings of data that never changed.
 *
 * <p><b>AND THE SEASON IS THE PAIR'S OWN COLUMN, never worked out from the day
 * it was made.</b> A pair belongs to one season and to one only: {@code season}
 * is NOT NULL and one person may hold at most one pair in it, from either side
 * ({@code racing_pair_one_man_a_season}, {@code racing_pair_one_woman_a_season}).
 * Reading the season off the day instead is a measured mistake and it is written
 * down as one: forming has to be finished by 31 December to count for the season
 * that follows, and read from the day of the QUESTION the portal made a pair for
 * a season already being run, with a green gate (PDL, 07.09.2026). That is why
 * {@code pair_invite} carries no season at all and this table does, and why this
 * query answers with the column.
 *
 * <p><b>AN INVITATION IS NOT A PAIR, and nothing from {@code pair_invite} comes
 * out of here.</b> A pair is formed by both sides confirming (PDL); until the
 * second one answers there is a question and no pair. The two tables are also
 * not the same shape - an invitation has no season and no gender key, on purpose
 * (V12) - so an invitation answered here would be a pair with an invented
 * season, made public before anybody agreed to it. Who asked whom is their own
 * business besides: the portal does not draw an invitation on anybody else's
 * profile (PDL, 07.09.2026), and this resource is read by anybody at all.
 *
 * <p><b>A member whose fee has lapsed is not filtered out here, and that is not
 * an oversight.</b> „Par se raskida kad jedna strana ne produzi clanarinu" (PDL
 * P13, 11.08.2026): the pair ENDS, so there is no row left to leave out. Ending
 * it is a write and belongs to the increment that makes and breaks pairs; a
 * reader that also decided it would be a second answer to the same question.
 *
 * <p><b>And a member number may be missing, which is why the two of them are not
 * gathered with {@code List.of}.</b> Since V16 a row in {@code competitor} is a
 * person who REGISTERED and a member is a row whose number is there, so the
 * number is nullable. Whether somebody without one may be in a pair is a
 * question for the flow that makes pairs and not for a reader; what a reader
 * must not do is answer 500 when it happens, and {@code List.of} refuses a null.
 * This answers what the row says and invents no rule.
 *
 * <p><b>In season order, and within a season by the man's number.</b> Sorted by
 * the key it would come back in whatever order the rows were written, which for
 * an imported history is no order at all; the member number is printed on the
 * card and never changes. The key is the last tie-break so the order is total
 * even between two pairs whose men have no number yet.
 */
@RestController
class PairApi {

	private final JdbcClient db;

	PairApi(JdbcClient db) {
		this.db = db;
	}

	/**
	 * @param memberNumbers both of them, the man first, which is the order the
	 *                      schema stores them in and the only one it can vouch for
	 */
	record RacingPair(long id, int season, List<String> memberNumbers) {
	}

	@GetMapping("/api/pairs")
	List<RacingPair> pairs() {
		return db.sql("select p.id, p.season, man.member_number, woman.member_number"
						+ " from racing_pair p"
						/* Joined on the key alone. The pair of columns (man_id, man_gender) is
						   what the foreign key is written over, and repeating the gender here
						   would be this query saying a second time what the database already
						   refuses to store otherwise. */
						+ " join competitor man on man.id = p.man_id"
						+ " join competitor woman on woman.id = p.woman_id"
						+ " order by p.season, man.member_number, p.id")
				.query((row, one) -> new RacingPair(row.getLong(1), row.getInt(2),
						/* Not `List.of`: a member number is nullable since V16 and `List.of`
						   answers a null with an exception rather than with a list. */
						Arrays.asList(row.getString(3), row.getString(4))))
				.list();
	}
}
