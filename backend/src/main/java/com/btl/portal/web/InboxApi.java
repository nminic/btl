package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

/**
 * THE SANDUCE: EVERYTHING WRITTEN TO WHOEVER IS ASKING, PLUS EVERYTHING WRITTEN TO THE
 * WHOLE LEAGUE.
 *
 * <p><b>Its own class, not {@link MeApi}.</b> This repository keeps one class per
 * resource rather than one large one (the shape {@link VerificationApi}, {@link PairApi}
 * and every other {@code *Api} already follow), and the inbox is a resource of its own -
 * V13's {@code message} table - even though reading it happens to require the same
 * session every other member route does.
 *
 * <p><b>WHOSE IT IS, AND WHY THE FILTER IS WRITTEN THE WAY IT IS.</b> V13: „A message may
 * be addressed to one member or to the whole league, and EMPTY MEANS EVERYBODY." That is
 * exactly {@link com.btl.portal.domain.inbox.WhoseMessageItIs#mayRead}, already written
 * and tested and not yet used anywhere in {@code main} - this is its first reader, though
 * it is asked here as a {@code where} clause rather than by fetching every message ever
 * sent and asking the class about each one, which would pull every member's private mail
 * into this process to throw most of it away. The two must agree on the one thing that
 * matters - a message is mine when {@code to_id} is mine or empty, and nothing else makes
 * it mine - and {@code InboxApiTest} measures exactly that split, the same way
 * {@code InboxRulesMatchTheSchemaTest} keeps the schema's own rule and
 * {@code WhoseMessageItIs.mayAnswer} from drifting apart.
 *
 * <p><b>NOTHING HERE IS PUBLIC AND THIS CLASS ASKS NOTHING ABOUT IT.</b> The route is
 * absent from {@link ApiSecurity#READ_BY_ANYBODY}, so an anonymous caller is answered 401
 * by the chain before this class runs - {@code ApiSecurityTest.everyRouteNobodyOpenedIsARouteNobodyCanRead}
 * measures that for every mapped route including this one. There must be no condition in
 * this class about whether anybody is signed in, for the same reason {@link
 * VerificationApi} carries none: a branch nothing can reach is a branch nothing can
 * measure.
 *
 * <p><b>AN ACCOUNT WITH NO MEMBER BEHIND IT IS TOLD THE ADDRESS IS NOT THERE.</b> The
 * header only ever shows the envelope beside a signed in MEMBER
 * ({@code app/Shell.tsx}: {@code memberNumber !== null}) and never beside a moderator or
 * superadmin session, which is a different concept entirely
 * ({@code roles/useRole.ts}). A moderator who does not race has no row in
 * {@code competitor}, so he has no inbox to speak of - not an empty one, none at all -
 * and the same 404 {@link VerificationApi} answers a moderator with no queue of his own
 * applies here for the same reason: „the administration draws no screen he may not open,
 * so the server must not be the one place that says the address is there." An account is
 * resolved to its member through {@link MemberOfAccount} rather than here, because
 * {@link NotificationApi} needs the identical fact.
 *
 * <p><b>NEWEST FIRST, WRITTEN DOWN ALREADY.</b> {@code session/SessionProvider.tsx}, the
 * one place the prototype ever added to the inbox: „Newest first, so what just arrived is
 * at the top of the panel and of the inbox, which is where somebody looking for it will
 * look." {@code order by sent_at desc}, and {@code id} breaks the tie so the order is
 * total - the same reason {@link VerificationApi} orders by its key last.
 *
 * <p><b>THE DAY IS THE DAY IN BELGRADE, not the instant.</b> {@code sent_at} is a
 * {@code timestamptz} because sending a message is a technical instant, but every screen
 * that draws one - {@code MessagesMenu}, {@code Messages}, {@code MessageDetail} - passes
 * it through {@code formatShortDate}, which takes a calendar day, and the mock messages
 * this prototype starts with (`data/seedMessages.ts`) carry one (`'2026-07-20'`), never a
 * time. Converted here in {@link SeasonClock#ZONE} for the same reason
 * {@link VerificationApi.Waiting#date} is: read as the machine's own zone, the day would
 * be wrong on every server this portal runs on.
 *
 * <p><b>{@code to_id} ITSELF DOES NOT LEAVE.</b> No screen reads {@code Message.to} today
 * - {@code session/context.ts} says outright it exists only so the prototype's own
 * provider can decide „is this mine", which here is the {@code where} clause's job before
 * a row is ever read into this answer. Serving it back would be „za svaki slucaj" (the
 * owner's rule of 13.09.2026), and it is one column narrower than the field it would
 * otherwise leak: a caller who is served his own row already knows it is his.
 *
 * <p><b>THE TWO QUESTIONS DO LEAVE, as the bare identity and nothing more.</b>
 * {@code MessageDetail.tsx} reads {@code message.invitation} and {@code message.pairInvite}
 * off this same list to decide whether to draw „Prihvati"/„Odbij" at all, so a screen
 * already reads them; answering an invitation is a separate resource this increment does
 * not add, exactly as V13 keeps {@code team_invitation}/{@code pair_invite} pointers
 * rather than copying anything out of those tables. {@code message_asks_at_most_one_question}
 * and {@code message_a_question_has_an_addressee} mean a row with either id set is never a
 * broadcast, so a caller served that row is always the one it was asked of - nothing extra
 * to check here beyond the {@code where} clause every row already passed.
 */
@RestController
class InboxApi {

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	InboxApi(JdbcClient db, MemberOfAccount memberOfAccount) {
		this.db = db;
		this.memberOfAccount = memberOfAccount;
	}

	/**
	 * One row of the inbox.
	 *
	 * @param from             {@code message.from_name}. Never the id: the sender may have
	 *                         asked to be deleted (PDL P23) and V13 keeps his name on the
	 *                         message for exactly that reason, „the pointer empties, the
	 *                         name does not."
	 * @param date             the day it was sent, in the league's own zone
	 * @param read             whether the one asking has a row in {@code message_read} for
	 *                         it - never whether ANYBODY has, which for a broadcast is a
	 *                         different question with a different answer per member
	 * @param teamInvitationId the invitation this message asks about, or absent for a
	 *                         message that only tells
	 * @param pairInviteId     the pair invite this message asks about, kept apart from the
	 *                         field above rather than sharing it with a kind beside it, the
	 *                         same reason {@code session/context.ts} keeps its two fields
	 *                         separate: „the compiler is then the thing that keeps them
	 *                         apart"
	 */
	record Item(long id, String from, String subject, String body, LocalDate date, boolean read,
			Long teamInvitationId, Long pairInviteId) {
	}

	/**
	 * @param response asked for so a refusal can go down the same road an address that is
	 *                 not there takes, exactly as {@link VerificationApi#verification} does
	 */
	@GetMapping("/api/inbox")
	List<Item> inbox(@AuthenticationPrincipal WhoIsAsking.Member member, HttpServletResponse response)
			throws IOException {
		Long me = memberOfAccount.competitorId(member.account());

		if (me == null) {
			response.sendError(HttpStatus.NOT_FOUND.value());
			return null;
		}

		return messagesFor(me);
	}

	private List<Item> messagesFor(long me) {
		return db.sql("select m.id, m.from_name, m.subject, m.body, m.sent_at,"
						+ " m.team_invitation_id, m.pair_invite_id, (mr.competitor_id is not null)"
						+ " from message m"
						+ " left join message_read mr on mr.message_id = m.id and mr.competitor_id = :me"
						/* HIS OWN, OR EVERYBODY'S - the two halves of
						   WhoseMessageItIs.Whose that are not SOMEBODY_ELSES. */
						+ " where m.to_id = :me or m.to_id is null"
						/* NEWEST FIRST (SessionProvider.tsx), id LAST so the order is total. */
						+ " order by m.sent_at desc, m.id desc")
				.param("me", me)
				.query((row, i) -> new Item(row.getLong(1), row.getString(2), row.getString(3),
						row.getString(4),
						row.getTimestamp(5).toInstant().atZone(SeasonClock.ZONE).toLocalDate(),
						row.getBoolean(8), row.getObject(6, Long.class), row.getObject(7, Long.class)))
				.list();
	}
}
