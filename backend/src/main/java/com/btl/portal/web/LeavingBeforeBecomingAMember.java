package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * WHETHER A MEMBER MAY DELETE HIS OWN ACCOUNT, WHICH ONLY ONE WHO NEVER BECAME A MEMBER MAY, AND WHETHER
 * THE ADMINISTRATION MAY DELETE HIS REGISTRATION, WHICH IS THE SAME SET (the owner, 23.11.2026).
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
 * deletes anything. Since 23.11.2026 two more read it, the same question asked by the administration
 * about somebody else: {@code mayBeDeleted} on every row of {@code GET /api/payments} ({@link
 * PaymentsDueApi}) draws „Obriši" on the screen Uplate, and {@code DELETE
 * /api/members/unnumbered/{competitorId}} ({@link ARegistrationIsDeletedApi}) asks it again under the same
 * holds (the owner, 23.11.2026: „Dugme je samo za prijavu koja nikad nije postala član, isti skup kao kod
 * dugmeta „Obriši nalog” od 20.11.2026"). Two copies would be two answers the day one of them gained a clause; the shape is
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
	 * @param member for {@code DELETE /api/me} the member his own account names, never anybody the request
	 *               named; for the administration, the registration its row on the screen Uplate names
	 * @return whether he may be deleted as never having become a member, by himself or by the
	 *         administration, now
	 */
	boolean may(long member) {
		return whoOf(Set.of(member)).contains(member);
	}

	/**
	 * THE SAME QUESTION OVER A WHOLE LIST AT ONCE, for the screen Uplate, which draws „Obriši" on a row only
	 * where the server would let it through. {@link #may} is this over one key, so the condition and the
	 * clause about the portal's administration are put together here and nowhere else.
	 *
	 * <p>One statement over every key rather than one per row, the reason {@code PaymentsDueApi} reads the
	 * price list and the book once: the clause about the administration is then asked only of the few who
	 * pass the condition, which on that screen are the registrations with no number.
	 *
	 * @param members the keys to ask about; none is an answer of none, and no statement is sent
	 * @return those of them who may be deleted as never having become a member, now
	 */
	Set<Long> whoOf(Collection<Long> members) {
		if (members.isEmpty()) {
			return Set.of();
		}

		return db.sql("select c.id from competitor c where c.id in (:members) and " + NEVER_A_MEMBER)
				.param("members", members)
				.query(Long.class)
				.list().stream()
				.filter(one -> !this.members.hisAccountAdministers(one))
				.collect(Collectors.toUnmodifiableSet());
	}
}
