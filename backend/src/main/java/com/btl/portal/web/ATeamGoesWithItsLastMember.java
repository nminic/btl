package com.btl.portal.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * A TEAM THAT HAS LOST ITS LAST MEMBER GOES, AND IT GOES BY ITSELF.
 *
 * <p>Owner, PDL P13a, 25.09.2026, his own words: „I tim (ako nema više ni jednog člana) i
 * par (ako nema bar jednog člana) nestaju sa spiska i brišu se svi rezultati te sezone.
 * Prethodne sezone su zamrznute i ne diraju se." And, choosing between the three offered
 * answers on the same day: the team disappears <b>of its own accord</b> the moment it has
 * nobody, rather than waiting for an administrator to press something or for the job of 1
 * January. He was offered both of those and refused both.
 *
 * <p><b>This is the boundary {@link TeamWriteApi#leave} wrote down rather than decided</b>,
 * measured by the review of PR 359 with a probe that read the database after a removal - „0
 * memberships and 1 team rows" - and left standing with the sentence „Two answers are
 * defensible from what is written down, so this route takes neither on its own: the empty
 * team stands and the owner decides." He has decided, and this is the decision.
 *
 * <p><b>WHY THIS IS A CLASS AND NOT TWO STATEMENTS.</b> A team loses a member down exactly
 * two roads: he is deleted ({@link CompetitorWriteApi}) or he walks out
 * ({@link TeamWriteApi}). Written at each of them the sentence would have two homes free to
 * drift the day one is edited, and it is the second home that is always the one nobody
 * remembers to change - the class of fault the journal names „dva doma jedne cinjenice koji
 * se ne slazu". One home, asked by both.
 *
 * <p><b>AND SINCE B97 THE CLASS HOLDS A SECOND ACT, WHICH IS WHY ITS NAME IS NOW NARROWER
 * THAN WHAT IT DOES.</b> {@link #goIfEmpty} is the rule the name describes; {@link #takeAway}
 * is a team deleted on purpose, by whoever administers it or by the administration (PDL
 * P13b, 25.09.2026). They are here together because „a team going" is ONE act whatever
 * started it - the row, then the mark's row, then the mark's file, in that order - and that
 * act is exactly what had two homes the first time round. The name is left alone rather than
 * widened because a merged file is read by its history as much as by its title, and renaming
 * it would take the owner's decision of 25.09.2026 out of the first line somebody reads.
 *
 * <p><b>„EMPTY" IS NO ROW AT ALL, AND THAT IS THE WHOLE OF THE CARE IN THIS FILE.</b> Three
 * resources already ask which team a member is in and all three ask it as {@code
 * m.season_to is null} - {@link CompetitorApi}, {@link MeApi} and {@link TeamApi}'s
 * {@code standing}. That question is „whose team is it TODAY", and it is the wrong one
 * here: a member who walked out in October keeps a row with {@code season_to} set, because
 * V11 stores „the last season he is in it" and he is in it until 31 December. Asked the
 * other way this class would empty a team ON THE DAY somebody left, which is a month or
 * three early and takes the team out from under everybody still in it.
 *
 * <p><b>What that costs, written here rather than left to be found.</b> Between October and
 * the turn of the year a team whose only member has left stands with nobody visible in it:
 * the three resources above already answer „no members" while this class still answers „not
 * empty". That gap closes when the row stops covering the season, and the thing that ends
 * it is the job of 1 January at 16:00 CET which PDL P13, 19.09.2026 already decided and
 * which does not exist yet („portal dobija prvi zakazan posao ikad; u celom bekendu danas
 * nema nijednog {@code @Scheduled}"). Deleting the team earlier is the one thing that
 * cannot be undone, so the wait is the safe half of the boundary and it is named as a
 * boundary rather than implemented as a rule.
 *
 * <p><b>Nothing here says a word about points, and that is a measurement.</b> The owner's
 * sentence asks for the team's total for the season to go with it. Swept on 25.09.2026:
 * there is no {@code sum(} anywhere in this package, no table of team totals for a season
 * being run, and no {@code season_pair} table at all. A team's total is DERIVED from its
 * members' results wherever it is drawn, so it goes when the team's row goes, by
 * construction rather than by a statement. What is materialised is the frozen season
 * ({@code season_team}), and that is {@code on delete set null} (V17) and stays exactly as
 * it was - which is the other half of his sentence, „Prethodne sezone su zamrznute i ne
 * diraju se".
 *
 * <p><b>AND THE TEAM'S LOGO GOES WITH IT, ROW AND FILE, WHICH IS MINE TO REASON ABOUT RATHER
 * THAN THE OWNER'S TO HAVE DECIDED.</b> Nothing in either journal names a team's logo when the
 * team itself disappears - the closest is PDL P21 on a MEMBER'S own picture, „jedina
 * fotografija clana je njegova profilna, koja odlazi sa profilom" - so this is this class's own
 * reasoning and not a decision, and it is said out loud as one rather than left to look like a
 * quote. The reasoning: a logo left standing would be a {@code photo} row and a file that
 * nothing in the schema points at any more the moment {@code team.logo_id} goes with the row it
 * was on, and nothing scans for such a thing (the class note above already measures that no
 * sweep of any kind exists in this package). {@link MePhotoApi#remove} is the portal's own
 * precedent for taking a picture down at all, and its shape is copied together with its guard:
 * „THE ROW AND THE FILE BOTH GO, and the order is the row first".
 */
@Component
class ATeamGoesWithItsLastMember {

	private static final Logger LOG = LoggerFactory.getLogger(ATeamGoesWithItsLastMember.class);

	private final JdbcClient db;

	private final Path folder;

	/**
	 * @param folder the same setting {@link MePhotoApi} and {@link PhotoApi} read, and it must
	 *               be: a second copy of the property would be a second home for the one folder
	 *               a logo's file actually lives in.
	 */
	ATeamGoesWithItsLastMember(JdbcClient db, @Value("${btl.photos.folder}") String folder) {
		this.db = db;
		this.folder = Path.of(folder);
	}

	/**
	 * Every team this member had a row in, read BEFORE he is deleted.
	 *
	 * <p>Read here and not after, for {@link PairWriteApi#end}'s reason one table over: the
	 * rows that say which teams to look at are {@code on delete cascade}
	 * ({@code team_membership_competitor_fk}, V11), so after the deletion there is nothing
	 * left to read them off.
	 *
	 * <p><b>Every membership and not the open one.</b> A member carries at most one open
	 * membership ({@code team_membership_one_team_at_a_time}) and any number of ended ones,
	 * and all of them go with him. So more than one team can be left with nobody by a single
	 * deletion, and asking only for the open one would empty the newest of them and leave
	 * the rest standing.
	 */
	List<Long> teamsOf(long member) {
		return db.sql("select distinct team_id from team_membership where competitor_id = ?"
						+ " order by team_id")
				.param(member)
				.query(Long.class)
				.list();
	}

	/**
	 * Deletes each of these teams that now has nobody, and leaves the rest alone.
	 *
	 * <p>This is the owner's rule of 25.09.2026 that the class note quotes, and the whole of
	 * what it adds to {@link #away} is the condition: the team is spared while anybody at all
	 * is still in it. What „nobody" means, and why the emptiness is asked inside the
	 * statement rather than counted first, are both written where the statement is.
	 *
	 * @param teams the teams to look at, from {@link #teamsOf} or from the one a member has
	 *              just walked out of
	 */
	void goIfEmpty(Collection<Long> teams) {
		for (Long team : teams) {
			away(team, true);
		}
	}

	/**
	 * AND THE SAME TEAM TAKEN AWAY WHATEVER ITS ROSTER, WHICH IS THE OTHER THING THE OWNER
	 * DECIDED ABOUT A TEAM DISAPPEARING.
	 *
	 * <p>PDL, owner, 04.09.2026 (`PDL.md:6396`): „„Obrisi" trazi potvrdu („Da li ste
	 * sigurni?") pa brise tim i bodove tog tima iz tabele za tu sezonu", and PDL P13b,
	 * 25.09.2026, which says the administration presses the same button with the same
	 * consequences. The team that is pressed on is a team that normally still HAS members -
	 * that is the whole difference from {@link #goIfEmpty} - so the condition that method
	 * carries must not be here, and it is the only difference between the two.
	 *
	 * <p><b>Why it lives in this class rather than in the route that calls it.</b> „A team's
	 * row and its mark go together, the row first" is one fact with, as of this method, three
	 * callers, and the class note above gives the reason a second home for it would be the
	 * one nobody remembers to change. {@link TeamWriteApi#remove} decides WHETHER a team
	 * goes; what going means is decided here.
	 *
	 * @param team the team to take away, whether or not anybody is still in it
	 */
	void takeAway(long team) {
		away(team, false);
	}

	/**
	 * THE TAKING AWAY ITSELF, WHICH IS THE ROW AND THE MARK AND THE ORDER BETWEEN THEM.
	 *
	 * <p><b>The emptiness is asked inside the statement rather than before it.</b> Read as a
	 * count and then acted on, the two would be two moments, and a team somebody joined in
	 * between would be deleted on the strength of a count taken before he did. Here there is
	 * one statement and the condition travels with it.
	 *
	 * <p><b>And it is asked of the named team only, never of the whole table.</b> „Delete
	 * every empty team there is" would reach a team another transaction is halfway through
	 * making - an approval writes the team and then writes its founder into it
	 * ({@link VerificationWriteApi}, PDL 05.09.2026: „Odobrenje novog tima upisuje osnivaca
	 * u taj tim"), and between those two statements that team has nobody and is not empty in
	 * any sense anybody means.
	 *
	 * <p><b>A boolean rather than two methods each with its own statement</b>, and that is
	 * measured rather than tidy: the two would differ by one clause and share the reading of
	 * the mark, the order between row and file, and the „only when the row really went"
	 * question. Split, those three would be the copy that drifts, and the drift would be a
	 * mark left on disk that nothing in the schema points at any more.
	 *
	 * @param onlyIfNobodyIsLeft whether the team is spared while anybody is still in it, which
	 *                           is true for {@link #goIfEmpty} and false for {@link #takeAway}
	 */
	private void away(long team, boolean onlyIfNobodyIsLeft) {
		/* READ BEFORE THE DELETE AND NEVER AFTER, {@link CompetitorWriteApi}'s own reason:
		   once the team's row is gone there is nothing left to read its logo_id off. */
		Optional<Long> logo = db.sql("select logo_id from team where id = ?")
				.param(team)
				.query(Long.class)
				.optional();

		int gone = db.sql("delete from team where id = ?"
						/* NOT „no OPEN membership". See the class note: a member who left
						   in October keeps a row until the season turns, and this asks
						   whether the team has any row at all. */
						+ (onlyIfNobodyIsLeft
								? " and not exists (select 1 from team_membership m"
										+ " where m.team_id = team.id)"
								: ""))
				.param(team)
				.update();

		/* ONLY WHEN THE TEAM ACTUALLY WENT. A team named here that still has somebody in it
		   is untouched by the statement above, and its logo is not this method's to take
		   away - {@code goIfEmpty} means „empty the ones that are empty", not „every team
		   this member ever touched". It is asked of {@link #takeAway} too, where what it
		   catches is a team that was not there at all. */
		if (gone > 0) {
			logo.ifPresent(this::takeAwayThePhoto);
		}
	}

	/**
	 * A LOGO'S ROW AND ITS FILE, BOTH GONE, THE SAME SHAPE {@link MePhotoApi#remove} KEEPS FOR
	 * A MEMBER'S OWN PICTURE.
	 *
	 * <p>The row first, then the file: the pointer that named this row is already gone with the
	 * team's own row by the time this runs, so nothing more is emptied here. A fault in the
	 * file's removal is logged and swallowed rather than thrown, for the same reason
	 * {@link CompetitorWriteApi} swallows it - the team going is the act the owner decided
	 * (PDL P13a, 25.09.2026), and a stray file nobody will ever serve again is the one leak
	 * {@link PhotoApi} already answers nothing for, not a reason to leave the team standing.
	 */
	private void takeAwayThePhoto(long photo) {
		db.sql("delete from photo where id = ?").param(photo).update();

		try {
			if (!Files.deleteIfExists(folder.resolve(String.valueOf(photo)))) {
				LOG.warn("the file of photo {} was already gone when its team was deleted", photo);
			}
		}
		catch (IOException notRemoved) {
			LOG.warn("the file of photo {} could not be removed from disk when its team was"
					+ " deleted", photo, notRemoved);
		}
	}
}
