package com.btl.portal.web;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.io.IOException;

/**
 * A METHOD AN ADDRESS DOES NOT TAKE IS AN ADDRESS THAT IS NOT THERE.
 *
 * <p>One rule and not a list of methods, because a list is a thing somebody has to
 * remember to add the next verb to. Whatever the address does not answer to, it answers
 * the way it would if it did not exist.
 *
 * <p><b>The hole this closes, measured on a running server on 13.09.2026.</b> Shutting
 * {@code OPTIONS} shut one door of five. Spring works out from the mapped methods that a
 * path exists but does not take this verb, and it does that BEFORE any handler runs - so
 * {@link RightsAtTheDoor} is never consulted and no annotation is read:
 *
 * <ul>
 * <li>{@code DELETE /api/teams} answered 405 with {@code Allow: GET}
 * <li>{@code DELETE /api/sign-in} answered 405 with {@code Allow: POST}
 * <li>{@code DELETE /api/nema-ovoga} answered 404
 * </ul>
 *
 * <p>Those are the portal's own routes, not probes, and {@code PUT}, {@code PATCH} and
 * {@code POST} all did the same. So every administrative address the portal will ever
 * have was listable one request at a time, and {@code Allow} said which verbs each of
 * them took. The CSRF token is no obstacle to it: a caller writing his own request picks
 * the value and sends it as both the cookie and the header, which the note in
 * {@link ApiSecurity} says in as many words.
 *
 * <p><b>It changes nothing for a method an address DOES take.</b> The exception this
 * reads is raised only when the verb is not mapped, so a route that answers {@code POST}
 * goes on answering it - which matters because every route that writes is still to be
 * written. {@code signingInStillTakesThePostItIsWrittenFor} is the case that says so, and
 * it would go red on a rule that shut verbs by name.
 *
 * <p><b>Why it is not narrowed to {@code /api}, and this is a decision rather than an
 * oversight.</b> A test of the path would be a branch, and outside {@code /api} this
 * application serves the health probe and nothing else - so the branch could only ever be
 * taken by a request nothing makes, and a branch nothing reaches is a branch nothing
 * measures. The rule is therefore the whole application's, which is also the safer of the
 * two directions, and where it reaches is measured rather than assumed:
 * {@code aMethodAnAddressOutsideTheApiDoesNotTakeAnswersTheSameWay}.
 *
 * <p><b>And it answers through {@code sendError}</b>, for the same reason
 * {@link RightsAtTheDoor} does: that is the road an address which is not there already
 * travels, so the body, the headers and the length come out identical because they are
 * written by the same code, rather than because somebody kept two shapes equal by hand.
 */
@RestControllerAdvice
class AMethodTheAddressDoesNotTake {

	/**
	 * @param notTaken never read, and declared so that this answers only the case it is
	 *                 about; a handler written without it would take every exception the
	 *                 portal can raise and answer 404 to all of them
	 */
	@ExceptionHandler(HttpRequestMethodNotSupportedException.class)
	void nothingIsHere(HttpRequestMethodNotSupportedException notTaken,
			HttpServletResponse response) throws IOException {
		response.sendError(HttpStatus.NOT_FOUND.value());
	}
}
