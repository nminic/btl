package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * WHO THE MODERATORS ARE AND WHAT EACH OF THEM MAY DO, read by the superadmin and by
 * nobody else at all.
 *
 * <p><b>The owner, 30.07.2026: „Ekran sa moderatorima vidi samo Superadmin"</b>
 * ({@code PDL.md:4438}). His reason is written with it and it is the reason this is the
 * one route of the portal that is guarded without asking for a right: „Bez te granice
 * moderator bi sam sebi mogao da dodeli prava, pa granularna prava ne bi značila
 * ništa." PDL P21 says the same from the other side - „Superadmin kreira moderatore i
 * uređuje im prava pojedinačno... Van toga, Superadmin i Moderator mogu isto"
 * ({@code PDL.md:2967}) - so this resource is literally the whole of „van toga", the
 * single thing in which the two roles differ.
 *
 * <p><b>Shut twice over, and the two shuttings answer different people.</b> A visitor
 * who is not signed in is refused by the chain, because this route is absent from
 * {@link ApiSecurity#READ_BY_ANYBODY} - the same way {@link AttendanceApi} and
 * {@link CommentApi} are closed, and for the reason ADL P-javno gives about all seven
 * remaining resources: „javno je ono sto Clan 73 nabraja, i nista vise"
 * ({@code ADL.md:3206}). Article 73 lists nothing whatever about moderators, so nothing
 * here is public. There is no condition in this class about who is asking, and there
 * must not be one.
 *
 * <p><b>And everybody else who IS signed in is refused by {@link OnlyTheSuperadmin},
 * which is a second kind of guard and not a second spelling of the first.</b> Every
 * other guarded route carries {@link RightIsNeeded} with the code of a box the
 * superadmin ticks. There is no box for this one and there must not be: „Ne treba ni da
 * postoji kolona moderatori jer samo superadmin ima ta prava" (owner, 13.08.2026,
 * {@code PDL.md:4403}), which is why the matrix has six entity columns against seven
 * entities. So a moderator holding every one of the twelve ticks is refused here
 * exactly as one holding none is, and that is the whole point rather than an edge case.
 *
 * <p><b>THE SUPERADMIN HIMSELF DOES NOT COME OUT OF THIS LIST.</b> „Superadmin nema
 * kućice. On sme sve, uvek, i ne pojavljuje se u ovoj tabeli kao neko kome se prava
 * dodeljuju" ({@code PDL.md:4422}). The screen the prototype draws says the same
 * sentence out loud to its reader. What makes it true here is the condition on the
 * ROLE: a query over every account, or over every account with any administrative
 * standing at all, answers with him - and he is the one row on which a tick means
 * nothing, so serving him would publish a row whose empty rights list reads as "may do
 * nothing" about the account that may do everything.
 *
 * <p><b>THE TICKS ARE READ PER ACCOUNT, and {@link WhatHeMayDo} already carries this
 * warning beside the statement it is about.</b> Without the condition naming the
 * account, every moderator holds every tick anybody was ever given, and a fixture with
 * one moderator in it does not notice. So {@code ModeratorApiTest} keeps four
 * moderators whose ticks differ, and the case that measures this gives one of them a
 * tick no other one holds.
 *
 * <p><b>AND A MODERATOR WITH NO TICKS IS ON THE LIST, WITH AN EMPTY ONE.</b> He is the
 * ordinary case and not the exotic one: the superadmin opens this screen precisely in
 * order to give a newly made moderator his first tick, and a moderator who is invisible
 * until he has one can never be given one. The portal's own type says it in as many
 * words - „An empty list is not a broken record, it is a moderator who has just been
 * made and may do nothing yet" ({@code frontend/src/data/types.ts}). An inner join to
 * {@code account_admin_right} drops him silently, so the rights are gathered by a
 * correlated {@code array_agg} with {@code coalesce(..., '{}')} over it, which is the
 * shape {@link LeagueApi} already uses for a league nothing counts towards yet and for
 * the same sentence: an empty list, not nothing.
 *
 * <p><b>THE NAME COMES OFF THE ACCOUNT AND NEVER OFF THE COMPETITOR, and that is the
 * whole of what changed on 14.09.2026.</b> B55 answered without {@code firstName} and
 * {@code lastName} because the schema had nowhere to hold them, and named the omission in
 * a case rather than leaving it silent. The owner then decided: „Ime i prezime nosi sam
 * nalog, i moderator ne mora da bude clan" ({@code PDL.md:4459}), V23 put
 * {@code first_name} and {@code last_name} on {@code account}, and the case that named the
 * omission now says the names really come out.
 *
 * <p><b>Off the ACCOUNT is not a detail of where the column happens to sit.</b> It is the
 * reason the decision was needed at all: a moderator does not have to be a member, so
 * there is no {@code competitor} row to read a name from for anybody on this screen who
 * does not race, and the portal draws him as initials („A. M.-S.", the role switcher of
 * 30.07.2026) which cannot be got out of an address of electronic mail. Reading the name
 * through {@code account.competitor_id} instead would drop every moderator who is not a
 * member - or hand back nothing for him - and would answer with a DIFFERENT name for the
 * ones who are, because the register of members holds the name the law on sport asks for
 * (PDL P32) and the account holds the one its owner signed up under. The two are two facts
 * and this resource wants the first. {@code ModeratorApiTest} keeps a moderator of each
 * kind, with the two names deliberately different for the one who is both, so that reading
 * the wrong table cannot pass.
 *
 * <p><b>The shapes are the schema's and not the file's</b> - the decision
 * {@link CalendarApi} took on 12.09.2026 and {@link AttendanceApi} repeats: {@code id}
 * answers with {@code account.id}, a {@code bigserial}, and not with the text slugs
 * ({@code mod-radulovic}) the prototype file used before there was a schema to answer
 * from.
 *
 * <p><b>In address order, which is total because the address is unique.</b> V6 puts a
 * unique index on {@code lower(email)}, so no two rows can tie here and the answer cannot
 * reshuffle between two readings of data nobody touched. The screen that will draw this
 * sorts its own copy by surname, which this resource does not have to give it.
 */
@RestController
class ModeratorApi {

	private final JdbcClient db;

	ModeratorApi(JdbcClient db) {
		this.db = db;
	}

	/**
	 * @param firstName the name on the ACCOUNT, which every account has and which is not
	 *                  the name in the register of members even for a moderator who is
	 *                  also one (V23)
	 * @param rights    the codes the superadmin has ticked for this one account, as
	 *                  {@code admin_right.code} generates them; empty for a moderator who
	 *                  has just been made and may do nothing yet
	 */
	record Moderator(long id, String firstName, String lastName, String email, List<String> rights) {
	}

	@GetMapping("/api/moderators")
	@OnlyTheSuperadmin
	List<Moderator> moderators() {
		/* `a.first_name` AND NOT A JOIN TO `competitor`, and the header says at length why.
		   The short of it: a moderator need not be a member, so the join answers with
		   nothing for him, and where it does answer it answers with the other of the two
		   names this portal keeps. */
		return db.sql("select a.id, a.first_name, a.last_name, a.email,"
						/* GATHERED IN THE DATABASE AND NAMED BY ACCOUNT, the shape LeagueApi
						   already uses for the races a league counts. The condition on
						   `account_id` is the whole of the statement: without it this is one
						   list of every tick anybody was ever given, handed back identically
						   to every moderator, and a fixture holding one moderator agrees.
						   `WhatHeMayDo` carries the same warning over the same table.

						   And `coalesce(..., '{}')` rather than a join, because a moderator
						   with nothing ticked is a real state and the state this screen exists
						   to end: the superadmin opens it to give him his first tick. An inner
						   join drops him without a word. */
						+ " coalesce(("
						+ "   select array_agg(t.right_code order by t.right_code)"
						+ "   from account_admin_right t"
						+ "   where t.account_id = a.id"
						+ " ), '{}') as rights"
						+ " from account a"
						/* THE MODERATORS AND NOBODY ELSE. The superadmin „ne pojavljuje se u
						   ovoj tabeli kao neko kome se prava dodeljuju" (PDL.md:4422), and
						   neither does a competitor or a visitor. Read as "any account" or as
						   "any account with administrative standing", this answers with him. */
						+ " join role r on r.id = a.role_id"
						+ " where r.code = 'moderator'"
						+ " order by a.email")
				.query((row, one) -> new Moderator(row.getLong(1), row.getString(2), row.getString(3),
						row.getString(4), List.of((String[]) row.getArray(5).getArray())))
				.list();
	}
}
