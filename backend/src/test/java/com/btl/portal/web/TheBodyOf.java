package com.btl.portal.web;

import org.springframework.core.MethodParameter;
import org.springframework.core.ResolvableType;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.method.HandlerMethod;

import java.util.Optional;

/**
 * WHAT TYPE A HANDLER TAKES ITS BODY AS, asked in ONE place.
 *
 * <p>Three floors need the answer - one that sends each route a body its own form would accept
 * ({@code AWordInAKeyOverRealHttpTest}), one that asks which routes take a town
 * ({@code EveryRouteFindsATownByItsMarkTest}), and the one that asks what a signed in account naming
 * no member is told for every kind of body ({@code ABodyIsReadAfterTheDoorOverRealHttpTest}). The
 * first two read the annotation on the parameter by themselves until 02.10.2026, and a third copy
 * would have been a third place that has to learn the day a handler takes its body some other way.
 *
 * <p><b>Two spellings, and the second is the reason this exists.</b> A body bound as an argument is
 * {@code @RequestBody X}. A body that is read once the account is known to name a member is
 * {@code WhatWasSent<X>}, so that the type stays in the signature where a floor can read it - a
 * handler that took the request instead would be invisible to every floor that derives anything from
 * what a route takes.
 */
final class TheBodyOf {

	private TheBodyOf() {
	}

	/**
	 * The record or class the body of this handler is read as, or nothing where the handler takes
	 * none.
	 */
	static Optional<Class<?>> type(HandlerMethod handler) {
		for (MethodParameter one : handler.getMethodParameters()) {
			if (one.hasParameterAnnotation(RequestBody.class)) {
				return Optional.of(one.getParameterType());
			}

			if (one.getParameterType() == WhatWasSent.class) {
				return Optional.of(ResolvableType.forMethodParameter(one).getGeneric(0).toClass());
			}
		}

		return Optional.empty();
	}
}
