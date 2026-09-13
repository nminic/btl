package com.btl.portal.web;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.webmvc.autoconfigure.WebMvcRegistrations;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.util.Set;

/**
 * AN ADDRESS THAT ALMOST MATCHES IS AN ADDRESS THAT IS NOT THERE.
 *
 * <p>The dispatcher finds the path, finds no mapping that fits it, and then says WHY - and
 * every one of those reasons is a sentence about something that exists. 405 with {@code
 * Allow: GET} says a route lives here and takes a read. 406 with {@code Accept: text/csv}
 * says it lives here and makes a spreadsheet. So does 415, and so does the refusal for a
 * missing parameter. Meanwhile an address that maps nothing answers 404 and says nothing,
 * and the difference between the two is a list of every administrative address the portal
 * has, gathered one request at a time.
 *
 * <p><b>This is the same finding as the one about {@code OPTIONS}, arriving for the fourth
 * time.</b> Each round closed the branch it had measured - {@code OPTIONS}, then the
 * method - and the next round found the next branch of the same mechanism. The reason is
 * always the same: none of it reaches {@link RightsAtTheDoor}, because the dispatcher
 * decides before any interceptor runs.
 *
 * <p><b>So this stops naming branches.</b> {@code handleNoMatch} is the one method the
 * dispatcher calls when the path matched and nothing else did, and its signature says
 * {@code throws ServletException} and nothing more - measured off the class file, not
 * assumed. Whatever it raises, now or in a Spring release that adds a fifth reason, is
 * turned into "no handler", which is what an address mapping nothing produces anyway. The
 * four reasons are not listed here and do not need to be.
 *
 * <p><b>What it deliberately does NOT touch, and this is the whole reason it lives here
 * rather than in an {@code @ExceptionHandler}.</b> Two of those exception types are also
 * raised far from here, while a handler is running: a body the converters cannot read is
 * {@code HttpMediaTypeNotSupportedException} too, and a response the caller will not accept
 * is {@code HttpMediaTypeNotAcceptableException} too. Those are answers about what somebody
 * SENT, not about which addresses exist, and they must go on being 415 and 406 or the
 * portal loses the ability to tell a member what is wrong with his request. An advice
 * catching those types by name cannot tell the two apart; this cannot confuse them,
 * because it only ever sees the dispatcher's own lookup.
 *
 * <p><b>And the catch is narrow on purpose.</b> {@code ServletException} is what the
 * signature allows; anything unchecked that escaped this lookup would be a fault rather
 * than a near miss, and it goes on travelling and becomes a 500 that somebody can see. A
 * portal that answered 404 to its own failures would be a portal nobody could operate.
 */
@Configuration(proxyBeanMethods = false)
class NothingIsHereRatherThanAlmost implements WebMvcRegistrations {

	@Override
	public RequestMappingHandlerMapping getRequestMappingHandlerMapping() {
		return new Lookup();
	}

	/** The dispatcher's own lookup, with one sentence taken out of its vocabulary. */
	static final class Lookup extends RequestMappingHandlerMapping {

		@Override
		protected HandlerMethod handleNoMatch(Set<RequestMappingInfo> mappings, String path,
				HttpServletRequest request) throws ServletException {
			try {
				/* CALLED, not skipped, and that matters for one caller: this is also where
				   the dispatcher builds its own answer to OPTIONS out of the methods a path
				   maps. Skipping it would take that away from the routes anybody may read,
				   which `askingWhatAnOpenRouteTakesIsLeftAlone` measures over the whole open
				   list. Only what it THROWS is refused. */
				return super.handleNoMatch(mappings, path, request);
			} catch (ServletException almost) {
				return null;
			}
		}
	}
}
