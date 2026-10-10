package com.btl.portal.web;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.core.JsonParser;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.JacksonModule;
import tools.jackson.databind.deser.jdk.StringDeserializer;
import tools.jackson.databind.exc.MismatchedInputException;
import tools.jackson.databind.module.SimpleModule;

/**
 * NO TEXT HOLDS A ZERO CHARACTER, ASKED ONCE, WHERE A TEXT IS READ, FOR EVERY ROUTE.
 *
 * <p><b>Why a zero is the one character with a rule of its own.</b> PostgreSQL's {@code text}
 * cannot hold {@code U+0000}: it is a property of the type and not of any constraint somebody
 * could drop, and {@code WhatTextCannotHoldIsWhatTheReaderRefusesTest} asks the database about
 * every code point there is instead of believing this sentence. A string carrying one that
 * reached a bound parameter was answered {@code invalid byte sequence for encoding "UTF8":
 * 0x00} by the driver, which the portal turned into a 500. Measured on 09.10.2026 over a
 * running server, route by route and field by field: 73 pairs of a route and a text, on 24 of
 * the 29 write routes that take a text, and four of those 24 are open to somebody who is not
 * signed in (sign-in, the two requests that send a link, and registration). What did not fail
 * was never a rule, only luck of the road a text took: a token is hashed, a kind is looked up
 * in a set, an address is matched by a pattern that happens to have no room for a control
 * character.
 *
 * <p><b>Three floors stand under it, and each asks a different question.</b>
 * {@code NoTextHoldsAZeroTest} asks the reader about every text of every body the dispatcher
 * knows, without a server, and about every other text the dispatcher binds;
 * {@code WhatTextCannotHoldIsWhatTheReaderRefusesTest} asks the database and the reader about
 * every character there is and compares the two answers; and
 * {@code ATextWithAZeroIsRefusedOnEveryKindOfRouteTest} sends one request of each kind of route
 * through the whole chain and reads the answer, including what a caller turned away at the door is
 * told.
 *
 * <p><b>This is my reading of {@code btl/CLAUDE.md}, „Sav korisnički unos se validira na
 * backendu", and not a decision of the owner.</b> The sentence says every input is validated
 * on the server; a text the database cannot hold is an input the server did not validate, and
 * the answer to such an input on this portal is a 400 and never a 500.
 *
 * <p><b>Why it is asked while the text is READ and not in each route.</b> {@code NoBodyIsLargerThan}
 * gives the reason for a limit on a body, and it holds word for word: a rule written into each
 * route is a rule somebody forgets, and here there are 111 texts on 29 routes to forget it
 * in. A route written tomorrow is covered without having been named, which is also why the
 * sweep of {@code NoTextHoldsAZeroTest} derives its bodies from the dispatcher and not from a
 * list. The text is asked AFTER it has been decoded, so one question covers a
 * zero written as an escape sequence, any encoding the parser is willing to detect, an element
 * of a list ({@code rights}) and a row of a group; a filter over the bytes would have had to
 * follow all of those and could have been wrong about each of them.
 *
 * <p><b>Why it is not a filter in front of the door, and why it is not Bean Validation.</b>
 * ADL A8 (13.09.2026): the server need not give away even that an address exists. Nothing is
 * read until a handler asks for it, a handler asks after the door is answered
 * ({@link WhatWasSent}), and this runs inside that reading, so a caller who is turned away
 * before his body is read is turned away exactly as before, whatever the body carries.
 * {@code @Valid} would be the opposite: it is applied while arguments are resolved, which is
 * before the first line of the handler, and that is the very order {@link WhatWasSent} exists
 * to avoid. (The portal has no {@code @Valid} anywhere in {@code src/main}: the „Bean
 * Validation" that {@code btl/CLAUDE.md} asks for is carried out by hand in each route.)
 *
 * <p><b>What the caller is told is what he is already told about a body that cannot be read,
 * and nothing new.</b> The refusal is a {@code JacksonException}. {@link WhatWasSent} and the
 * four routes that read the body by hand turn that into their own {@code theFormIsNotComplete}
 * (or the sentence the decision route has always used for it), and a route that binds with
 * {@code @RequestBody} gets the container's 400, as it does for a body that is not JSON. No
 * constant, no sentence and no dictionary entry is added: the portal's own forms cannot send
 * a zero, so the only body this ever refuses is one that never went through them.
 *
 * <p><b>The one thing it changes besides a 500 into a 400.</b> A password carrying a zero was
 * accepted until now (BCrypt hashes the bytes it is given), and is refused like every other
 * text. The owner's decision of 11.09.2026, the four numbers of authentication, says a password
 * is „bez ostalih uslova", which is a sentence about composition (no mixing of letters, digits
 * and signs is demanded), and A62c adds that a password is not trimmed anywhere; neither says that
 * a character no keyboard types must be accepted. It is still the one place where this rule meets
 * a field the owner has spoken about, so it is said here: if he reads it the other way the
 * exception is this one place and the password fields, which
 * {@code ATextWithAZeroIsRefusedOnEveryKindOfRouteTest} names.
 *
 * <p><b>What it deliberately does not cover.</b> A request parameter is not a body: the one
 * parameter that reaches a statement as text, {@code search} on {@code GET /api/payments}, asks
 * {@link #holdsAZero} itself, and {@code NoTextHoldsAZeroTest} lists every text the dispatcher
 * binds outside a body (a path variable, a parameter, a cookie) with what becomes of a zero in
 * it, so a new one cannot join unasked. A path is refused before it gets here: {@code %00} is a
 * 400 from the container (measured over a socket on 09.10.2026), and the filter chain answers
 * it the same way, which is what {@code ATextWithAZeroIsRefusedOnEveryKindOfRouteTest} holds. A
 * text built on the server out of other parts is not a request.
 */
@Configuration(proxyBeanMethods = false)
class NoTextHoldsAZero {

	/**
	 * The module, registered on the application's own mapper by Boot, which is the mapper
	 * every route that reads a body already uses: {@link WhatWasSent} says „the application's own
	 * {@code ObjectMapper} and not one made here", and no class under {@code src/main} makes
	 * its own.
	 */
	@Bean
	JacksonModule noZeroInAnyText() {
		return new SimpleModule("noZeroInAnyText").addDeserializer(String.class, new Reading());
	}

	/**
	 * Whether a text holds {@code U+0000}, and the one place that says so: the reader below asks
	 * it of every text of a body, and a route that reads a parameter asks it of that parameter.
	 * Nothing here is told apart from „absent", which is no text and so holds nothing.
	 */
	static boolean holdsAZero(String text) {
		return text != null && text.indexOf(0) >= 0;
	}

	/**
	 * Jackson's own reader of a {@code String}, which does everything it did before - coercions,
	 * the empty value, how it is cached - and then asks one more question of what it read.
	 * Subclassed rather than rewritten so that nothing but that question can differ.
	 */
	static final class Reading extends StringDeserializer {

		@Override
		public String deserialize(JsonParser parser, DeserializationContext context) {
			String text = super.deserialize(parser, context);

			if (holdsAZero(text)) {
				/* THROWN HERE AND NOT HANDED TO `reportInputMismatch`, which throws too: a call that always
				   throws is a line the coverage tool never sees finished, and this branch is the whole of
				   what the class is for. */
				throw MismatchedInputException.from(parser, String.class, "a text holds a zero character");
			}

			return text;
		}
	}
}
