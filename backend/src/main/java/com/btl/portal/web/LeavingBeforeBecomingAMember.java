package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * WHETHER A MEMBER MAY DELETE HIS OWN ACCOUNT, WHICH ONLY ONE WHO NEVER BECAME A MEMBER MAY.
 *
 * <p>The owner, 20.11.2026: „Moze li na kraju strane Moja Članarina da bude Obriši nalog. … jednostavno da
 * se obriše član kao da nikad nije ni registrovan i to je to, ionako nema njegovih podataka u sistemu niti
 * rezultata." So the button is for an account with nothing in the league behind it, and for nobody else:
 * every other account still asks by mail (PDL, 11.08.2026, „Brisanje naloga i odjava se traže mejlom.";
 * the button is an exception to it and not its end).
 *
 * <p><b>ONE CONDITION IN ONE PLACE, READ BY BOTH DOORS.</b> {@code GET /api/me} answers it as
 * {@code mayLeave} ({@link MeApi}), so the screen draws the button only to whom the server would let
 * through, and {@code DELETE /api/me} ({@link MeLeavingApi}) asks it again under its holds before it
 * deletes anything. Two copies would be two answers the day one of them gained a clause; the shape is
 * {@code ProfilesPastTheirKeepingAreDeleted.TWELVE_MONTHS_OVER}, which asks the same kind of question of
 * the same tables for the deletion twelve months on.
 *
 * <p><b>WHAT „NEVER BECAME A MEMBER" IS, CLAUSE BY CLAUSE.</b> No member number; no season of membership,
 * the one freed of the fee included; no trail of one ({@code membership_change}, which a cancelled
 * season leaves); no payment, recorded or awaited; no entry in the book of his balance. No result, no
 * result waiting for a moderator, no announcement for an event. Not in a team, and no proposal of a team,
 * application to one or invitation into one. Not the administrator of a team. And his account
 * administers nothing of the portal, asked of {@link CompetitorWriteApi#hisAccountAdministers}, which is
 * the question every deletion of a member asks and the one part of this that is not a column (the
 * superadmin is a setting, not a row).
 *
 * <p><b>A LEAGUE HAS NO ADMINISTRATOR TO ASK ABOUT.</b> The column went in V19 (the owner, 12.09.2026,
 * „NE POSTOJI ADMINISTRATOR PROPRATNE LIGE"): a league is edited by the superadmin or by a moderator with
 * the right over leagues, which is a right of the account and is the last clause above.
 *
 * <p><b>A RACING PAIR IS NOT A CLAUSE, AND THAT IS MEASURED RATHER THAN FORGOTTEN.</b> The one statement
 * that writes {@code racing_pair} is {@code PairWriteApi.settle}, reached only through {@code answer},
 * and both {@code answer} and {@code invite} let in only a member whose fee stands
 * ({@code ActiveMemberOrAdministration.activeMember}), which is a {@code membership} row. Such a row is
 * deleted only by {@code MemberMembershipApi.gone}, and every call of it writes a trail beside it. So an
 * account that was ever half of a pair always fails the second or the third clause.
 */
@Component
class LeavingBeforeBecomingAMember {

	/** Over a {@code competitor} aliased {@code c}: true exactly when nothing of the league stands behind him. */
	static final String NEVER_A_MEMBER = "c.member_number is null"
			+ " and not exists (select 1 from membership x where x.competitor_id = c.id)"
			+ " and not exists (select 1 from membership_change x where x.competitor_id = c.id)"
			+ " and not exists (select 1 from payment x where x.competitor_id = c.id)"
			+ " and not exists (select 1 from balance_entry x where x.competitor_id = c.id)"
			+ " and not exists (select 1 from result x where x.competitor_id = c.id)"
			+ " and not exists (select 1 from result_submission x where x.competitor_id = c.id)"
			+ " and not exists (select 1 from attending x where x.competitor_id = c.id)"
			+ " and not exists (select 1 from team_membership x where x.competitor_id = c.id)"
			+ " and not exists (select 1 from team_proposal x where x.competitor_id = c.id)"
			+ " and not exists (select 1 from team_application x where x.competitor_id = c.id)"
			+ " and not exists (select 1 from team_invitation x where x.competitor_id = c.id)"
			+ " and not exists (select 1 from team x where x.admin_id = c.id)";

	private final JdbcClient db;

	private final CompetitorWriteApi members;

	LeavingBeforeBecomingAMember(JdbcClient db, CompetitorWriteApi members) {
		this.db = db;
		this.members = members;
	}

	/**
	 * @param member the member his own account names, never anybody the request named
	 * @return whether he may delete his account himself, now
	 */
	boolean may(long member) {
		return db.sql("select exists (select 1 from competitor c where c.id = ? and " + NEVER_A_MEMBER + ")")
				.param(member)
				.query(Boolean.class)
				.single()
				&& !members.hisAccountAdministers(member);
	}
}
