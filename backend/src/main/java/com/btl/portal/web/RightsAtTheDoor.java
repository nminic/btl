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
 * <p><b>401 IS NOT THIS FILE'S ANSWER AND MUST NOT BECOME IT.</b> Somebody who is not
 * signed in never reaches here: the chain refuses him first, because a route that needs
 * a right is a route {@link ApiSecurity} has not opened. That order is not a detail -
 * answering 403 to a stranger says the address is real and that something is behind it,
 * and the portal's own rule for shut doors (ADL A8, 30.07.2026) is that they tell
 * nobody anything. The case that holds the order is
 * {@code everyRouteThatNeedsARightIsShutToSomebodyWhoIsNotSignedIn}, and it asks every
 * route that carries a right rather than the one somebody thought of.
 *
 * <p><b>And 403 is the answer to a moderator without the tick, not a queue.</b> The
 * owner, 13.09.2026: "superadmin odmah, moderator po privilegiji", and what he has no
 * privilege for "ne moze uopste". So there is no third outcome here: a request either
 * goes through or is refused. The queues that wait for approval are what MEMBERS send
 * in, and they are a different thing in a different increment.
 *
 * <p><b>The body of a refusal is empty on purpose.</b> A sentence naming the missing
 * right is exactly what ADL A8 struck out on 30.07.2026, in the owner's words: a
 * moderator is not to know that actions he was not given even exist.
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

		response.setStatus(HttpStatus.FORBIDDEN.value());
		return false;
	}
}
