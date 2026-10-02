package com.btl.portal.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.MethodParameter;
import org.springframework.core.ResolvableType;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.List;

/**
 * THE BODY OF A REQUEST, READ WHEN A HANDLER ASKS FOR IT AND NOT WHEN THE HANDLER IS CALLED.
 *
 * <p><b>Why a body is not bound as an argument on a route that asks which member is asking.</b> ADL A8,
 * owner, 13.09.2026: the server need not give away even that an address exists. A body bound with
 * {@code @RequestBody} is read while ARGUMENTS ARE RESOLVED, which is before the first line of the
 * handler, so a signed in account that names no member - V23 calls it the ordinary case for a
 * moderator who does not race - was told 400 for a body that is not JSON or none at all, and 404 for a
 * body that reads, while an address that maps nothing says 404 to both (register 166, measured on a
 * real socket by PR 466 for nine routes). One request with a broken body, and he knows that a write
 * lives there. {@code InboxWriteApi}, {@code MeWriteApi}, {@code MeCategoryWriteApi} and the
 * decision on the verification queue closed it by taking the request and reading its bytes after
 * „has he a member" is answered.
 *
 * <p><b>Why this is a type and not the request.</b> Those four routes hide the type of their body from
 * the signature, and two floors derive it from there: the one that sends each route a body its own
 * form would accept ({@code AWordInAKeyOverRealHttpTest}) and the one that asks which routes take a
 * town ({@code EveryRouteFindsATownByItsMarkTest}). A route that takes the request is invisible to
 * both; the second compares the routes the dispatcher finds with its probes in BOTH directions, so
 * {@code POST /api/results} - whose body carries a {@code placeId} - would have failed it. Here the
 * type is the generic argument, in the signature, where a floor can read it: {@link TheBodyOf} in the
 * tests is the one place that knows both spellings.
 *
 * <p><b>The order is the whole of it.</b> Nothing is read until {@link #read} is called, and a handler
 * calls it after the member question. Nothing here consults the stream when the argument is resolved,
 * so {@code consumes} on the mapping goes on being asked before anything is dispatched, exactly as it
 * is for {@code @RequestBody}: neither declares {@code required = false}, which is the other thing
 * that annotation does and the reason the four routes above are not written that way. The measurement
 * is {@code InboxWriteApi.write}'s own: that flag also clears {@code ConsumesRequestCondition}'s
 * {@code bodyRequired}, and {@code consumes} then stopped guarding the very door it was added for.
 *
 * <p><b>Absent, empty and unreadable are one answer and not three</b>, for the reason
 * {@code InboxWriteApi} gives for the same shape: none of them carries a single value the route could
 * act on, and the caller who sees the refusal is by then always somebody the address is really for.
 * Written with no condition of its own: Jackson refuses empty input exactly as it refuses input it
 * cannot parse, and the word {@code null} reads as nothing, so a check for either would be a branch
 * beside a road that already goes where it should. What changes for such a member is the sentence and
 * not the number: 400 as before, carrying the route's own {@code theFormIsNotComplete} instead of the
 * container's error document.
 *
 * <p><b>The application's own {@link ObjectMapper} and not one made here</b>, so a body is read exactly
 * as {@code @RequestBody} would have read it - unknown fields dropped and all - and the only thing
 * that changed about reading it is WHEN. Read off the stream and not into an array first, so a body is
 * never held whole by this class; {@code NoBodyIsLargerThan} is what says how much of it there can be.
 *
 * <p><b>What it deliberately leaves alone:</b> the {@code charset} parameter of the {@code Content-Type},
 * which is not read (JSON is UTF-8, RFC 8259, and the decision on the verification queue reads the same
 * way); and an exception thrown by the stream itself, which is not a {@link JacksonException} and so is
 * never turned into „unreadable": a body that is too long is a refusal the container answers, not a form
 * that was left empty.
 *
 * @param <T> the record the body is read as, which the handler declares in its signature
 */
final class WhatWasSent<T> {

	private final HttpServletRequest request;

	private final ObjectMapper json;

	private final Class<T> type;

	WhatWasSent(HttpServletRequest request, ObjectMapper json, Class<T> type) {
		this.request = request;
		this.json = json;
		this.type = type;
	}

	/**
	 * WHAT WAS SENT, TURNED INTO THE RECORD, OR NOTHING AT ALL.
	 *
	 * <p>Asked once, after the member question is answered. A second call would read what is left of
	 * the stream, which is nothing, and answer as for an empty body.
	 */
	T read() throws IOException {
		try {
			return json.readValue(request.getInputStream(), type);
		}
		catch (JacksonException cannot) {
			return null;
		}
	}

	/**
	 * The one place Spring is told how to hand a body over lazily, so that no route has to remember to
	 * - the shape {@link AKey.Reading} gives a key.
	 */
	@Configuration(proxyBeanMethods = false)
	static class Reading implements WebMvcConfigurer, HandlerMethodArgumentResolver {

		private final ObjectMapper json;

		Reading(ObjectMapper json) {
			this.json = json;
		}

		@Override
		public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
			resolvers.add(this);
		}

		@Override
		public boolean supportsParameter(MethodParameter parameter) {
			return parameter.getParameterType() == WhatWasSent.class;
		}

		/**
		 * Built from the generic argument the handler declares, and never touching the stream: the
		 * request is only held.
		 */
		@Override
		public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer container,
				NativeWebRequest asked, WebDataBinderFactory binders) {
			return new WhatWasSent<>(asked.getNativeRequest(HttpServletRequest.class), json,
					ResolvableType.forMethodParameter(parameter).getGeneric(0).toClass());
		}
	}
}
