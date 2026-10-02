package com.btl.portal.web;

import org.springframework.core.MethodParameter;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.method.HandlerMethod;

import java.util.Optional;
import java.util.stream.Stream;

/**
 * WHAT TYPE A HANDLER TAKES ITS BODY AS, asked in ONE place.
 *
 * <p>Three floors need the answer - one that sends each route a body its own form would accept,
 * one that asks which routes take a town, and the one that asks what a signed in account naming
 * no member is told for every kind of body. Each of the first two read the annotation on the
 * parameter by itself until 02.10.2026, and a third copy would have been a third place that
 * has to learn the day a handler takes its body some other way.
 */
final class TheBodyOf {

	private TheBodyOf() {
	}

	/**
	 * The record or class the body of this handler is read as, or nothing where the handler takes
	 * none.
	 */
	static Optional<Class<?>> type(HandlerMethod handler) {
		return Stream.of(handler.getMethodParameters())
				.filter(one -> one.hasParameterAnnotation(RequestBody.class))
				.map(MethodParameter::getParameterType)
				.<Class<?>>map(one -> one)
				.findFirst();
	}
}
