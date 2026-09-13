package com.btl.portal.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * WHO MAY, ASKED BEFORE THE METHOD THAT WOULD ANSWER RUNS.
 *
 * <p>This is where {@link RightIsNeeded} is applied. It sits in front of every route
 * under {@code /api}, so a route added tomorrow is covered by whatever it declares
 * without anybody remembering this file exists - which is the point of ADL A8 and the
 * reason the rule is not written inside each handler.
 *
 * <p><b>Nothing about the resource is read before the answer.</b> The question is
 * settled in {@code preHandle}, so a refusal costs the account's role and its ticks
 * and not a single row of what was asked for. A check written at the top of a handler
 * method would already have bound a path variable and, the day one of those is looked
 * up to validate it, would already have said whether the thing exists.
 *
 * <p><b>THE REFUSAL IS 404 AND NOT 403.</b> Owner, 13.09.2026, asked outright and
 * answering in one word: 404. His reason was that a deep link held by somebody without
 * the right already lands him on the front page, and that the administration draws no
 * screen he may not open - so the server has no business being the one place that says
 * the address is there at all. That is ADL A8 of 30.07.2026 ("Zatvorena vrata ne kazu
 * nista") and {@code PDL.md:4172} ("Ne treba ni da budu svesni moderatori da postoje
 * akcije koje im nisu dodeljene") applied to the API rather than to a screen.
 *
 * <p>What it costs is known: a refusal and a typo now read the same from outside, so a
 * broken address and a missing tick look alike to whoever is debugging. That is the
 * price of the address saying nothing, and it was the owner's to pay. The case that
 * holds it is {@code aRefusedModeratorIsToldNoMoreThanSomebodyAskingForNothing}, which
 * compares the two answers rather than naming a number, so the day one of them moves
 * the other has to move with it.
 *
 * <p><b>401 IS STILL NOT THIS FILE'S ANSWER AND MUST NOT BECOME IT.</b> Somebody who is
 * not signed in never reaches here: the chain refuses him first, because a route that
 * needs a right is a route {@link ApiSecurity} has not opened. 401 gives nothing away -
 * it is the same answer for an address that exists and one that does not, and it says
 * "sign in" rather than "there is something here". Turning it into 404 would lose the
 * only sentence the portal still needs to be able to say. The cases are
 * {@code nobodySignedInIsAskedToSignInRatherThanRefused} and
 * {@code everyRouteThatNeedsARightIsShutToSomebodyWhoIsNotSignedIn}, and the second
 * asks every route that carries a right rather than the one somebody thought of.
 *
 * <p><b>And a refusal is not a queue.</b> The owner, 13.09.2026: "superadmin odmah,
 * moderator po privilegiji", and what he has no privilege for "ne moze uopste". There
 * is no third outcome here: a request either goes through or is refused. The queues
 * that wait for approval are what MEMBERS send in, and they are a different thing in a
 * different increment.
 *
 * <p><b>The body is empty on purpose</b>, and with 404 that is no longer only about
 * ADL A8's struck-out sentence naming the right: a body of any kind is something an
 * address that does not exist would not have.
 *
 * <p><b>This file is not the whole of the answer, and the other half is in
 * {@link ApiSecurity}.</b> Spring answers {@code OPTIONS} out of the methods a path
 * maps, without ever dispatching to a handler, so nothing here is consulted and no
 * annotation is read. Measured on a running server: {@code OPTIONS} on a guarded route
 * came back 200 with {@code Allow}, to a moderator who may not read it, while an
 * address that maps nothing came back 404 - which enumerates every administrative
 * address whatever number this file returns. That is shut where the paths are already
 * decided, one rule beside the open list.
 */
@Component
class RightsAtTheDoor implements WebMvcConfigurer, HandlerInterceptor {

	private final WhatHeMayDo mayHe;

	RightsAtTheDoor(WhatHeMayDo mayHe) {
		this.mayHe = mayHe;
	}

	/**
	 * In front of everything under {@code /api}, and not of what is outside it.
	 *
	 * <p>Outside is the health check, which the container's own probe calls without a
	 * session and which must stay reachable or QA never comes up.
	 */
	@Override
	public void addInterceptors(InterceptorRegistry registry) {
		registry.addInterceptor(this).addPathPatterns("/api/**");
	}

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response,
			Object handler) {

		/* NOT EVERYTHING UNDER /api IS A METHOD OF THIS PORTAL'S. A signed in member
		   asking for an address nothing maps is dispatched to the handler that serves
		   static files, which has no annotations to read and is nobody's route. Without
		   this line that request is a class cast and a 500 where 404 is the answer;
		   `aSignedInMemberAskingForSomethingThatIsNotThereIsToldSo` measures it. */
		if (!(handler instanceof HandlerMethod method)) {
			return true;
		}

		RightIsNeeded needed = method.getMethodAnnotation(RightIsNeeded.class);

		/* A ROUTE THAT DECLARES NOTHING IS LEFT ALONE, and that is the whole of what
		   this increment changes for what already exists. `/api/me` and the six open
		   resources pass through here untouched; the day a route needs a right it says
		   so on itself. */
		if (needed == null) {
			return true;
		}

		if (mayHe.may(needed.value())) {
			return true;
		}

		/* THE RIGHT THIS ROUTE DECLARED, and not one written here. A fixed code in this
		   line survived the whole suite on 13.09.2026, because there was exactly one
		   guarded route in it and "the right this route asks for" and "the only right
		   anywhere" were the same string. There are two routes now, asking for different
		   rights, and `eachModeratorPassesOnlyTheDoorHisOwnTickOpens` crosses them. */
		response.setStatus(HttpStatus.NOT_FOUND.value());
		return false;
	}
}
