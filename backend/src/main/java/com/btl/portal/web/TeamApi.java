package com.btl.portal.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

/**
 * THE TEAMS OF THE LEAGUE, and only what the rulebook publishes about them.
 *
 * <p><b>Article 73 is the measure and nothing else is.</b> It lists what a public
 * competition publishes - „Ime i prezime, clanski broj i kategorija, Mesto i
 * zemlja, Profilna fotografija, Svi verifikovani rezultati..., Bodovi, plasman,
 * statistika, dukati i priznanja, <b>Tim, trkacki par i klub</b>" - and the team
 * is on it by name. A team is also the one thing besides a member that has a
 * standing of its own (V11), so what makes it that thing is what this answers
 * with: which team it is, what it is called, where it is, and what it says about
 * itself. Everything else waits for a resource that knows who is asking, and
 * where this resource was in any doubt the field was LEFT OUT rather than served
 * "in case somebody needs it". Owner, 13.09.2026.
 *
 * <p><b>WHO ADMINISTERS THE TEAM DOES NOT LEAVE.</b> The portal reads it as
 * {@code organizerMemberNumber} and it is left out for three reasons, each of
 * which would be enough on its own.
 *
 * <ul>
 * <li>Article 73 makes „Tim" public, which is WHICH team a member runs for. It
 * makes no role inside a team public, and administering one is a right and not a
 * standing: the same sentence lists points, placings and awards, and stops there.
 * </li>
 * <li><b>No screen publishes it even today.</b> Measured before this was written:
 * the one public page that reads the field, {@code pages/TeamDetail.tsx}, never
 * draws it. All three uses are conditions - {@code runs !== null} and
 * {@code runs === memberNumber} - which decide whether the READER may edit the
 * team and answer applications. That is an authorisation question, and the
 * answer to "may I edit this" belongs to the resource that knows who is asking,
 * not to a list anybody may read.</li>
 * <li>And the member it names may be one whose fee has lapsed, whom the owner's
 * decision of 13.09.2026 keeps off {@code /api/competitors} altogether (PDL P11,
 * „ko nije platio, ne vidi se nigde"). A member number answered here and absent
 * there says by subtraction exactly what that decision shut.</li>
 * </ul>
 *
 * <p><b>WHAT DOES LEAVE, SINCE 20.09.2026, IS THE ANSWER TO THE QUESTION THE
 * NUMBER WAS BEING READ FOR, and only to the one asking it.</b> The paragraph
 * above says the number is read as a condition and never drawn, and that was
 * measured again before this was written: all three uses in
 * {@code pages/TeamDetail.tsx} are {@code runs !== null} and
 * {@code runs === memberNumber}, and the one use in {@code pages/member/EditTeam.tsx}
 * is a guard that refuses the page to anybody but the administrator, after which the
 * name it draws is the READER's own off the reader's own record. So no screen wants
 * to know who founded a team; every screen wants to know whether the reader did.
 * {@code foundedByMe} is that, and it is the number reduced to what Article 73 lets
 * the reader have - nothing about anybody else at all.
 *
 * <p><b>AND IT IS THE STORED FACT, NOT THE STANDING RULE, WHICH IS A BOUNDARY AND
 * IS WRITTEN DOWN RATHER THAN LEFT TO BE FOUND.</b> Who ADMINISTERS a team is more
 * than who founded it: „Administrator tima je onaj ko je tim osnovao. Kad se mesto
 * isprazni, po podrazumevanom ga preuzima clan koji je najduze u timu, dakle
 * najraniji `teamSince`, a kod izjednacenja manji broj clana" (owner, PDL,
 * 04.09.2026). The second half of that sentence is worked out from the roster and
 * lives in {@code frontend/src/data/teamAdmin.ts}; this resource does not repeat it,
 * because two homes for one rule drift and the other home is the one the owner's
 * decision was written against. What the portal cannot do once the number is gone is
 * tell whether the seat is EMPTY, which is the first line of that same function -
 * and that is the one bit this resource still owes. It is named here, and in
 * {@code TeamApiTest}, rather than guessed at: either this answers a second
 * condition beside the one below, or the standing rule moves here whole. That is a
 * decision about where a rule lives and it is the owner's to make.
 *
 * <p><b>AND NEITHER DO THE MEMBERS OF THE TEAM</b>, although they are public.
 * Article 73 does make them public and this resource still does not carry them,
 * and that is a decision about where one fact lives rather than about whether it
 * may be read. Who is in which team is already answered, once, by
 * {@code /api/competitors} as {@code teamId} and {@code teamSince}; two homes for
 * one fact drift, and the second home would be the worse of the two. Built here
 * out of {@code team_membership} it would carry the members whose fee has lapsed,
 * which is the door above again. Filtered to the members whose fee is standing it
 * would be the first list inverted, kept in a second place, by a second query
 * that has to be remembered every time the first one changes. So this resource
 * answers with no member number at all, in any field, and
 * {@code TeamApiTest.noMemberNumberLeavesTheServer} measures that over the whole
 * text rather than over a name.
 *
 * <p><b>AND THE MARK DOES NOT LEAVE, BECAUSE THIS SCHEMA HAS NO ADDRESS FOR
 * ONE.</b> The portal reads {@code logo} as a path to a picture. A picture is a
 * row in {@code photo} (V8, V21), and that row carries a media type, a byte size,
 * a digest and the crop - nothing that points at bytes - and no route of this
 * application serves a picture. Pictures are F5 (ADL, 15.08.2026, and PENDING:
 * „Timska slika se u celini gubi pri odobravanju... F5"). An address invented
 * here would be a broken circle beside every team that has a mark and a promise
 * the next increment would have to keep, so the field is left out and the screen
 * draws initials, which is what it already does for a team with no mark.
 *
 * <p><b>What IS answered is the square of the mark</b>, because that half the
 * schema really holds. It is three exact fractions on the picture's row and it is
 * what the team chose; leaving it out would mean choosing it again when the
 * picture gets an address. A team with no mark has no crop and answers null,
 * which is what the portal already reads as „the whole picture"
 * ({@code components/crop.ts}, {@code cropIn}).
 *
 * <p><b>The three numbers are answered under the portal's names and not the
 * schema's, and that is a boundary rather than an oversight.</b> V21 renamed the
 * third column {@code crop_diameter}; the portal still calls it {@code size}
 * ({@code frontend/src/data/types.ts}), and the difference is a recorded open
 * item that this increment does not close. It matters which way round it is
 * answered: {@code cropIn} asks for the name {@code size} and quietly returns the
 * whole picture for a record without it, so answering {@code diameter} would lose
 * every crop on the portal without one error anywhere. The values are the same
 * fractions on both sides; only the word differs.
 *
 * <p><b>The town in the two shapes the schema allows</b>, the same as a member's
 * (V11, and {@code CompetitorApi} before it): one out of the codebook and one
 * typed in, and the country comes from whichever of the two the team used.
 *
 * <p><b>In name order, and the tie is broken by the key.</b> A team is spoken of
 * by its name and the table of teams is read down the names; the collation is the
 * column's own {@code sr_latn} (V11), so the order is the one a reader of the
 * portal's language expects. The name is not unique - only the address is - so
 * {@code id} ends the sentence, exactly as the season does for a league.
 */
@RestController
class TeamApi {

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	TeamApi(JdbcClient db, MemberOfAccount memberOfAccount) {
		this.db = db;
		this.memberOfAccount = memberOfAccount;
	}

	/**
	 * Which circle of the mark is drawn, as three fractions between 0 and 1.
	 *
	 * @param size the diameter, as a fraction of the picture's shorter edge. The
	 *             column is {@code crop_diameter} since V21 and the portal's word
	 *             is {@code size}; see the note on this class for why the answer
	 *             carries the portal's.
	 */
	record Crop(BigDecimal x, BigDecimal y, BigDecimal size) {
	}

	/**
	 * @param crop        the square of the mark, or null for a team that has no mark
	 * @param foundedByMe whether the one asking is the member this team's seat names,
	 *                    and ABSENT - not null, and not false - from every answer
	 *                    nobody signed in asked for. False and absent are two
	 *                    different sentences: „you did not found this" and „I do not
	 *                    know who you are", and a visitor must be told the second
	 */
	record Team(long id, String slug, String name, String city, String country, String bio,
			Crop crop,
			@JsonInclude(JsonInclude.Include.NON_NULL) Boolean foundedByMe) {
	}

	/**
	 * @param member who the chain worked out is asking, or NULL when nobody is, for the
	 *               reason written on {@code CompetitorApi}: this route is open for
	 *               reading, so an anonymous GET arrives here rather than at a 401
	 */
	@GetMapping("/api/teams")
	List<Team> teams(@AuthenticationPrincipal WhoIsAsking.Member member) {
		/* The caller as a MEMBER, which an account that does not race does not have:
		   a signed in moderator founded no team and is answered exactly what a
		   visitor is. */
		Long me = member == null ? null : memberOfAccount.competitorId(member.account());

		return db.sql("select t.id, t.slug, t.name,"
						/* The town in the two shapes V11 allows, and the country off whichever
						   of them the team used. The same three columns and the same coalesce as
						   on a member, because it is the same fact about a different thing. */
						+ " coalesce(town.name, t.city) as city,"
						+ " coalesce(town_country.code, typed_country.code) as country,"
						+ " t.bio,"
						/* AND THE SQUARE OF THE MARK, WITHOUT THE MARK. The picture has no
						   address in this schema and nothing serves one; the crop is the half
						   that is really here. `crop_diameter` and not `crop_side`: V21 renamed
						   it when the three became fractions. */
						+ " mark.crop_x, mark.crop_y, mark.crop_diameter,"
						/* AND WHETHER THE ONE ASKING IS THE MEMBER THIS SEAT NAMES.
						   Written as two questions and not one, because `t.admin_id = :me`
						   alone is NULL for two different reasons - nobody is asking, and
						   the seat is empty - and those are the two sentences this field
						   exists to keep apart. The outer `case` answers the visitor with
						   null, which `@JsonInclude` leaves out; the `coalesce` answers a
						   signed in member `false` for a team whose seat nobody holds.

						   `t.admin_id` and never the member number: the number is what must
						   not leave (see the note on this class), and comparing keys means
						   this query never reads one.

						   CAST ON THE FIRST ONE, and it is a requirement rather than a
						   flourish: the other mention sits beside `t.admin_id` and takes its
						   type from it, but `? is null` stands alone and PostgreSQL refuses
						   the statement outright - „could not determine data type of
						   parameter $1" - rather than guessing. */
						+ " case when cast(:me as bigint) is null then null"
						+ "      else coalesce(t.admin_id = :me, false) end as founded_by_me"
						+ " from team t"
						+ " left join place town on town.id = t.place_id"
						+ " left join country town_country on town_country.id = town.country_id"
						+ " left join country typed_country on typed_country.id = t.country_id"
						/* Left, because a team with no mark is an ordinary team and not a team
						   missing from the list. */
						+ " left join photo mark on mark.id = t.logo_id"
						/* NOTHING IS JOINED TO `team_membership` HERE, and that is the decision
						   above rather than an omission: who is in which team is answered by
						   /api/competitors. A join would also give a team as many rows as it has
						   members. */
						+ " order by t.name, t.id")
				.param("me", me)
				.query((row, one) -> {
					/* Exact decimal all the way out, never a double. V21 chose `numeric(9, 8)`
					   for this and said why: the rule is about the exact boundaries 0 and 1, and
					   a binary fraction cannot be trusted at one. Reading it as a double here
					   would undo that on the way to the answer. */
					BigDecimal across = row.getBigDecimal(7);

					return new Team(row.getLong(1), row.getString(2), row.getString(3),
							row.getString(4), row.getString(5), row.getString(6),
							/* Every column of `photo` is NOT NULL, so this one is null exactly
							   when no picture joined, which is a team with no mark. */
							across == null ? null
									: new Crop(across, row.getBigDecimal(8), row.getBigDecimal(9)),
							row.getObject(10, Boolean.class));
				})
				.list();
	}
}
