package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;

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
 */
@Component
class ATeamGoesWithItsLastMember {

	private final JdbcClient db;

	ATeamGoesWithItsLastMember(JdbcClient db) {
		this.db = db;
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
	 * <p><b>The emptiness is asked inside the statement rather than before it.</b> Read as a
	 * count and then acted on, the two would be two moments, and a team somebody joined in
	 * between would be deleted on the strength of a count taken before he did. Here there is
	 * one statement and the condition travels with it.
	 *
	 * <p><b>And it is asked of the named teams only, never of the whole table.</b> „Delete
	 * every empty team there is" would reach a team another transaction is halfway through
	 * making - an approval writes the team and then writes its founder into it
	 * ({@link VerificationWriteApi}, PDL 05.09.2026: „Odobrenje novog tima upisuje osnivaca
	 * u taj tim"), and between those two statements that team has nobody and is not empty in
	 * any sense anybody means.
	 *
	 * @param teams the teams to look at, from {@link #teamsOf} or from the one a member has
	 *              just walked out of
	 */
	void goIfEmpty(Collection<Long> teams) {
		for (Long team : teams) {
			db.sql("delete from team where id = ?"
							/* NOT „no OPEN membership". See the class note: a member who left
							   in October keeps a row until the season turns, and this asks
							   whether the team has any row at all. */
							+ " and not exists (select 1 from team_membership m"
							+ " where m.team_id = team.id)")
					.param(team)
					.update();
		}
	}
}
