package com.btl.portal.web;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

/**
 * THE SIX SWITCHES, READ BACK FOR WHOEVER THEY BELONG TO.
 *
 * <p><b>Its own class, and not {@link MeApi}.</b> The route starts with {@code /api/me},
 * but {@code notification_setting} is its own resource - V13's own third table - and this
 * repository keeps one class per resource rather than growing one large one. Nothing here
 * is a fact about „who the portal thinks is asking" the way {@link MeApi} answers; it is a
 * fact about a member's mailbox preferences, read by account only because that is how
 * every member-scoped resource finds him.
 *
 * <p><b>WHAT THE SIX ARE, AND WHY THERE ARE NO OTHERS.</b> PDL P22: „Zvono uvek, mejl
 * podrazumevano ISKLJUCEN, clan ga sam pali: sve drustveno i sporedno (komentar, poziv u
 * tim, zahtev za par, ponuda prevoza, osvojena znacka, poruka u inboksu)." Those six are
 * exactly V13's six columns - {@code comment_mail}, {@code team_mail}, {@code pair_mail},
 * {@code lift_mail}, {@code badge_mail}, {@code inbox_mail} - and V13 says why there is no
 * seventh column and no table of rows instead: „A seventh switch is a migration rather
 * than a row somebody typed." The six mandatory mails P22 also names (account and address,
 * password, a result entered, a result changed, a request for more proof, a major change
 * to the portal) have no switch at all and therefore nothing to answer with, „a column for
 * them would be a promise the portal must refuse to keep."
 *
 * <p><b>THIS DELIBERATELY DOES NOT ANSWER WITH WHAT {@code Settings.tsx} READS TODAY.</b>
 * The screen still binds to {@code NOTIFICATION_KEYS = ['resultApproved', 'resultChanged',
 * 'newsletter']} ({@code session/context.ts}), which is the prototype's own mock and is
 * two mandatory mails P22 forbids switching off, plus a newsletter P22 never mentions and
 * {@code PDL.md:3039} explicitly removed the one thing close to it („obavestenja o
 * predstojecem dogadjaju nema uopste"). Mock data is provisional and is not carried into
 * the backend on its own say-so; the schema is what actually encodes the settled P22
 * decision, six columns matching six sentences of it exactly, and this answers with
 * those six under their own names. Wiring {@code Settings.tsx} to them is a front end
 * change this increment does not make.
 *
 * <p><b>NOTHING IS PUBLIC, NOTHING IS CHECKED HERE ABOUT BEING SIGNED IN.</b> Same as
 * {@link InboxApi}: the route is absent from {@link ApiSecurity#READ_BY_ANYBODY}, so the
 * chain answers 401 before this class runs, and there must be no branch here pretending
 * to ask the same question a second time.
 *
 * <p><b>AN ACCOUNT WITH NO MEMBER BEHIND IT HAS NO SWITCHES TO READ</b>, for the identical
 * reason {@link InboxApi} answers 404 rather than an empty shape: {@code notification_setting}
 * exists per {@code competitor_id}, a moderator who does not race is not one, and
 * {@code Settings.tsx} is only ever reached from behind the same {@code memberNumber !==
 * null} gate the inbox is.
 *
 * <p><b>A MEMBER WHO HAS NEVER OPENED THIS PANEL HAS NO ROW AT ALL, AND THAT IS NOT A
 * FAULT.</b> Nothing writes {@code notification_setting} yet - registration does not, and
 * nothing else does either - so the ordinary state for most members today is no row. V13's
 * own columns default every switch to {@code false} for exactly this member, and this
 * answers the same way a row of defaults would rather than failing him for never having
 * visited Settings.
 */
@RestController
class NotificationApi {

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	NotificationApi(JdbcClient db, MemberOfAccount memberOfAccount) {
		this.db = db;
		this.memberOfAccount = memberOfAccount;
	}

	/** The six switches, named exactly as V13 names its columns. */
	record Settings(boolean commentMail, boolean teamMail, boolean pairMail, boolean liftMail,
			boolean badgeMail, boolean inboxMail) {

		/** Nobody has touched a switch, which V13's own defaults make identical to a row of
		 *  them all written down false, and not a fault to be refused. */
		private static final Settings NOBODY_HAS_TOUCHED_ANY = new Settings(false, false, false,
				false, false, false);
	}

	@GetMapping("/api/me/notifications")
	Settings notifications(@AuthenticationPrincipal WhoIsAsking.Member member, HttpServletResponse response)
			throws IOException {
		Long me = memberOfAccount.competitorId(member.account());

		if (me == null) {
			response.sendError(HttpStatus.NOT_FOUND.value());
			return null;
		}

		return settingsOf(me);
	}

	private Settings settingsOf(long me) {
		return db.sql("select comment_mail, team_mail, pair_mail, lift_mail, badge_mail, inbox_mail"
						+ " from notification_setting where competitor_id = ?")
				.param(me)
				.query((row, i) -> new Settings(row.getBoolean(1), row.getBoolean(2), row.getBoolean(3),
						row.getBoolean(4), row.getBoolean(5), row.getBoolean(6)))
				.optional()
				.orElse(Settings.NOBODY_HAS_TOUCHED_ANY);
	}
}
