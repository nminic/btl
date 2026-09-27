package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

/**
 * WHICH CATEGORY A MEMBER HAS SAID HE WANTS TO RUN THE COMING SEASON IN, AND WHETHER HE MAY
 * STILL SAY IT.
 *
 * <p><b>Its own class and its own route, not a field on {@link MeApi}</b>, for
 * {@link MyApplicationsApi}'s reason: one screen asks this and every other caller of
 * {@code /api/me} would pay for it. The pair of classes on one path is
 * {@link NotificationApi} and {@link NotificationWriteApi}, and this follows it verb for
 * verb, including how an account with no member behind it is answered.
 *
 * <p><b>WHAT IS STORED IS THE WISH AND WHAT IS ANSWERED IS BOTH.</b> Owner, 26.09.2026 (PDL
 * P7 §9): „racunaj da clan bira ono sto ZELI, ali ga superadmin / moderator verifikacijom
 * necega moze gurnuti u starosnu kategoriju ako odobri rezultat kojim prelaz 12 bodova", and
 * the journal draws out of it: „Ono sto se cuva je ZELJA, ne kategorija. Clan stiklira sta
 * zeli, a kategorija u kojoj se takmici je izvedena: zelja i pravo." So this answers the wish
 * as it stands, the right as it stands, and the category the two make together - three
 * fields, because a member whose wish was overtaken by a verification must be able to see
 * both halves. Collapsing them into one would be the shape the owner turned down, and the
 * notice he asked for on 27.09.2026 („Ponisten izbor kategorije se javlja clanu, sa
 * razlogom") has nothing to describe if the screen cannot show the difference.
 *
 * <p><b>Why {@code open} is answered here rather than worked out on the screen.</b> The
 * deadline is 1 January at 10:00 ({@link SeasonClock#categoryMayBeChosenFor}) and the front
 * end reads whole days off one clock with no notion of an hour or a zone
 * ({@code frontend/src/data/season.ts}: „The portal reads whole days off one clock with no
 * notion of a zone"). It therefore CANNOT answer this, and a screen that guessed would be
 * wrong for ten hours on the one morning of the year the answer changes. Measured while this
 * was written: the draft box was drawn under {@code inYearlyWindow(today)}, which is
 * {@code 10-01 .. 12-31}, so it vanished at midnight on 1 January and took ten hours of the
 * member's own deadline with it.
 *
 * <p><b>And why the fee has nothing to do with it.</b> The same draft drew the box only for a
 * member who is NOT freed of the fee, and twenty nine of the thirty two members in the data
 * are freed of it. The owner's sentence of 26.09.2026 names payment and dismisses it in the
 * same breath - „Clan je nov, uplatio je clanarinu (ili nije), ali moze da bira u koju ce
 * kategoriju" - so nothing about money is asked anywhere here, and a member freed of the fee
 * is answered exactly as a member who has just paid is.
 *
 * <p><b>WHAT THIS ROUTE DELIBERATELY DOES NOT DO.</b> It does not freeze anything: assigning
 * the categories of the coming season at 16:00 on 1 January, together with the standings of
 * the one that ended, is one act of the portal's (PDL P7 §9, owner: „u 16h portal treba sam
 * da preracuna na osnovu svega odobrenog sta je finalno i da dodeli kategorije za novu sezonu
 * i plasmane za prethodnu") and it is its own increment. Nor does it send the member the
 * notice his overturned wish earns him (PDL, 27.09.2026): that is triggered by a VERIFICATION
 * rather than by anything here, so it belongs to the route that approves results. Both are
 * boundaries rather than omissions, and the frozen row they will write already has its column
 * ({@code season_competitor.category}, V17).
 */
@RestController
class MeCategoryApi {

	private final MemberOfAccount memberOfAccount;

	private final TheChoiceAsItStands theChoice;

	MeCategoryApi(MemberOfAccount memberOfAccount, TheChoiceAsItStands theChoice) {
		this.memberOfAccount = memberOfAccount;
		this.theChoice = theChoice;
	}

	/**
	 * THE WHOLE STATE OF THE CHOICE, WITH THE WISH AND THE CATEGORY AS SEPARATE FIELDS.
	 *
	 * <p>It lives on the reading class and is answered by the writing one too, which is how
	 * {@link NotificationWriteApi} answers with {@link NotificationApi.Settings}: one shape
	 * for one resource, whichever verb asked for it.
	 *
	 * @param season             the season being chosen FOR, which is the one the heading
	 *                           names. {@link SeasonClock#seasonBeingPaidFor}, because the box
	 *                           lives on the membership screen and PDL §12 says the member's
	 *                           two acts there are paying and choosing - both about one
	 *                           season. Not {@code transfersTakeEffect}, which answers next
	 *                           year on every day of this one and would offer 2028 in June
	 * @param firstSeason        what he has SAID he wants, unchanged by anything the portal
	 *                           thinks of it
	 * @param firstSeasonAllowed whether the beginners' category is open to him at all, worked
	 *                           out now and never stored
	 * @param category           the code he will actually run under: the wish AND the right,
	 *                           the right measured off the seasons BEFORE {@code season} and
	 *                           never off {@code season} itself ({@link BestOfficialSeason}) -
	 *                           a season's own still-growing total cannot close it on him,
	 *                           only a season already behind it can. The same string the
	 *                           tables and the public file key on, so a screen showing it
	 *                           shows what everybody else sees
	 * @param open               whether he may still change it, which is false from 10:00 on
	 *                           1 January of that season
	 */
	record Choice(int season, boolean firstSeason, boolean firstSeasonAllowed, String category,
			boolean open) {
	}

	/**
	 * <p><b>404 for an account with no member</b>, exactly as the {@code GET} beside it on
	 * {@code /api/me/notifications} does, and through {@code sendError} for the same reason: a
	 * signed-in account that does not race has nothing here, and it must not learn that the
	 * address exists (ADL A8, owner 13.09.2026 - the numbers are 401 and 404, never 403).
	 * Somebody who is not signed in at all never reaches this method: the chain answers 401 at
	 * {@code ApiSecurity}'s {@code anyRequest().authenticated()}, and {@code ApiSecurityTest}
	 * holds that for every route that has no rule of its own.
	 */
	@GetMapping("/api/me/category")
	Choice category(@AuthenticationPrincipal WhoIsAsking.Member member,
			HttpServletResponse response) throws IOException {

		Long me = memberOfAccount.competitorId(member.account());

		if (me == null) {
			response.sendError(HttpStatus.NOT_FOUND.value());
			return null;
		}

		return theChoice.of(me);
	}
}
