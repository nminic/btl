package com.btl.portal.domain.mail;

import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.TreeSet;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE ADDRESS IN A POSTED MESSAGE HAS TWO HOMES IN TWO LANGUAGES, AND THIS IS HALF THE FLOOR.
 *
 * <p>{@link Message} hangs a path on the portal's own address and posts it, so every message
 * already in somebody's mailbox carries that exact path. The screen answering on it is a row
 * in the router's table, on the other side of the repository, in TypeScript.
 *
 * <p><b>Measured, not argued:</b> renaming {@code CONFIRM_THE_ADDRESS} to a path the portal
 * does not serve leaves {@code WhatTheMessageSaysTest} at 31/31,
 * {@code HowLongALinkLastsMatchesTheSchemaTest} at 6/6 and {@code EmailConfirmationApiTest} at
 * 16/16, all green, and this case is the only one that falls. The mail still goes out, the
 * reader still clicks, and an address with no screen lands on the FRONT PAGE saying nothing.
 *
 * <p>The member matters in that sentence: the same rename of {@code SET_A_NEW_PASSWORD} is
 * caught anyway, by {@code HowLongALinkLastsMatchesTheSchemaTest}, because that message shares
 * a {@code password_reset_token} row with {@code INVITED_AS_A_MODERATOR} and must therefore
 * share its path. {@code CONFIRM_THE_ADDRESS} shares its row with nobody, so nothing else
 * looks.
 *
 * <h2>Why the floor is in two pieces</h2>
 *
 * <p>Two drafts of this were single cases and both were blind, each in the half it could not
 * execute. The first read this Java file as TEXT and missed a path moved into a constant. The
 * second executed {@link Message#path()} but read the router's table as text, so a route
 * commented out, or moved to the table of names that is deliberately NOT routes, left it green
 * while the portal mailed links nobody was served. Reading how a value is WRITTEN has no
 * bottom: the number of ways to write one string is not finite from where a reader of source
 * stands.
 *
 * <p>Neither half can execute the other, because they are in two languages. So each half
 * executes its own side and they meet on {@code frontend/src/app/postedAddresses.json}:
 *
 * <ul>
 *   <li><b>this case</b> asks {@code Message.values()} what the portal posts and requires that
 *       file to say exactly that, no more and no less;</li>
 *   <li><b>{@code routes.test.ts}</b> imports that same file and requires every address in it
 *       to be among the paths the ROUTER OBJECT itself serves, read off {@code routeObjects}.</li>
 * </ul>
 *
 * <p>The file is the only thing written by hand, and it is pinned from both ends: change a path
 * here and this case fails, edit the file to agree and the other one fails, because no route
 * answers there. There is no third state.
 *
 * <p><b>What this claims</b> is only which addresses go out in messages. Whether the screen
 * behind one does the right thing with its token is measured by {@code newPassword.test.tsx}
 * and {@code confirmAddress.test.tsx}, and they stay the place for it.
 */
class APostedAddressHasAScreenTest {

	/**
	 * Where the two halves meet. It lives beside the router table rather than beside this
	 * case because the frontend has to IMPORT it, and a test reads a file from anywhere.
	 */
	private static final Path POSTED = Path.of("..", "frontend", "src", "app",
			"postedAddresses.json");

	/** Every distinct path a message can carry, asked of the enum rather than of its text. */
	private static List<String> whatTheseMessagesCarry() {
		return List.copyOf(new TreeSet<>(Arrays.stream(Message.values())
				.map(Message::path)
				.toList()));
	}

	private static List<String> whatTheFrontendIsToldToServe() {
		try {
			JsonNode listed = new ObjectMapper().readTree(
					Files.readString(POSTED, StandardCharsets.UTF_8));
			List<String> addresses = new ArrayList<>();

			listed.forEach(one -> addresses.add(one.asText()));

			return List.copyOf(new TreeSet<>(addresses));
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	@Test
	void theFileTheFrontendChecksSaysExactlyWhatTheseMessagesCarry() {
		List<String> carried = whatTheseMessagesCarry();

		assertThat(carried)
				.as("the portal posts no message at all, so this compared nothing")
				.isNotEmpty();

		assertThat(whatTheFrontendIsToldToServe())
				.as("%s is what routes.test.ts checks the router against, and it no longer says"
						+ " what these messages carry. Whichever side moved, one of the two is now"
						+ " unmeasured: either the portal posts an address nobody promised to"
						+ " serve, or the frontend is holding a screen for an address nothing"
						+ " sends", POSTED)
				.isEqualTo(carried);
	}
}
