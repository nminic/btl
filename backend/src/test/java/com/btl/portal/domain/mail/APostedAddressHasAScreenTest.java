package com.btl.portal.domain.mail;

import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE ADDRESS IN A POSTED MESSAGE HAS TWO HOMES, AND THIS IS THE FLOOR BETWEEN THEM.
 *
 * <p>{@link Message} hangs a path on the portal's own address and posts it, so every message
 * already in somebody's mailbox carries that exact path. The screen answering on it lives in
 * the frontend's route table. Neither side reads the other, and the comment beside those
 * routes says only that they are "not ours to rename" - a sentence, not a guard.
 *
 * <p><b>Measured on review of PR 317:</b> renaming {@code SET_A_NEW_PASSWORD} to a path the
 * portal does not serve left {@code WhatTheMessageSaysTest}, {@code HowLongALinkLastsMatchesTheSchemaTest},
 * {@code PasswordResetApiTest}, {@code ModeratorWriteApiTest} and {@code EmailConfirmationApiTest}
 * green - {@code Tests run: 124, Failures: 0}. The mail still goes out, the reader still
 * clicks, and an address with no screen lands on the FRONT PAGE saying nothing.
 *
 * <h2>Why this lives in Java and not beside the screens</h2>
 *
 * <p>The first draft of this floor was a TypeScript case reading this file as TEXT, with a
 * regular expression over the enum declaration. Review measured what that costs: move one
 * path into a {@code static final String} and the case stops seeing it, silently, while the
 * whole frontend stays green - 2843 cases, exit 0 - with messages pointing at an address the
 * portal does not serve. A floor that reads how a value is WRITTEN has no bottom; the number
 * of ways to write the same string is not finite from where the reader stands.
 *
 * <p>So the question changed instead of the reading. {@link Message#path()} is a method, and
 * {@code Message.values()} is a list the compiler keeps. Asking them RUNS the code: a path
 * built from a constant, a concatenation or a method call answers the same as a literal,
 * because by then it is a value rather than syntax.
 *
 * <p>What is still read as text is the frontend route table, and that direction is the safe
 * one: if its shape ever changes, the count collapses and the floor below fails loudly
 * instead of passing on an empty list.
 *
 * <p><b>What this claims</b> is only that a route with that path EXISTS. Whether that screen
 * does the right thing with the token is measured by {@code newPassword.test.tsx} and
 * {@code confirmAddress.test.tsx}, and they stay the place for it.
 */
class APostedAddressHasAScreenTest {

	/** Every {@code path: 'something'} the frontend declares, across both route files. */
	private static final Pattern ROUTE = Pattern.compile("path:\\s*'([^']+)'");

	/**
	 * Both files, because the router serves more than one list: {@code routes.ts} carries the
	 * navigation, account, footer and unlisted routes, while {@code routeObjects.tsx} adds the
	 * detail screens and the verification queues. Naming only the first missed seven addresses.
	 */
	private static final String[] ROUTE_FILES = {
			"frontend/src/app/routes.ts",
			"frontend/src/app/routeObjects.tsx",
	};

	private static Set<String> everyPathTheFrontendServes() throws IOException {
		Set<String> paths = new LinkedHashSet<>();
		for (String file : ROUTE_FILES) {
			Matcher found = ROUTE.matcher(Files.readString(Path.of("..", file), StandardCharsets.UTF_8));
			while (found.find()) {
				paths.add("/" + found.group(1));
			}
		}
		return paths;
	}

	@Test
	void theRouteTableIsStillShapedTheWayThisReadsIt() throws IOException {
		assertThat(everyPathTheFrontendServes())
				.as("no `path: '...'` was found in either route file, so the comparison below"
						+ " would have passed against an empty list and held nothing at all")
				.hasSizeGreaterThan(20);
	}

	@Test
	void everyAddressThePortalPostsInAMessageHasAScreen() throws IOException {
		Set<String> served = everyPathTheFrontendServes();

		assertThat(Message.values())
				.as("the portal posts no message at all, so this compared nothing")
				.isNotEmpty();

		for (Message message : Message.values()) {
			assertThat(served)
					.as("%s posts %s, and no route on this portal answers there. Every message"
							+ " already sent carries that address; a reader who clicks it lands on"
							+ " the front page with nothing said, so the invitation is dead and"
							+ " silent", message, message.path())
					.contains(message.path());
		}
	}
}
