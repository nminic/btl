package com.btl.portal.web;

import com.icegreen.greenmail.util.ServerSetup;
import com.icegreen.greenmail.util.ServerSetupTest;

/**
 * A MAIL SERVER FOR ONE TEST CLASS, ON ITS OWN PORT AND WITH TIME TO COME UP.
 *
 * <p><b>It exists because of a measurement and not because a helper looked tidy.</b>
 * Running the mutation list on 14.09.2026 - twenty-one builds back to back on one
 * machine - {@code RegistrationApiTest} came back with twenty-nine errors, every one of
 * them {@code Could not start mail server smtp:127.0.0.1:3025, try to set server startup
 * timeout > 2000}. The mutation under test was caught, and it was caught by the wrong
 * thing entirely: not one case had run. An unrun suite and a caught mutation are the
 * same non-zero exit, and the only reason this was seen at all is that the run before it
 * had printed one error where this one printed twenty-nine.
 *
 * <p><b>Two things are wrong with the default and this fixes both.</b>
 *
 * <ul>
 * <li><b>Two seconds to come up is not enough on a loaded machine.</b> GreenMail waits
 *     {@link ServerSetup#SERVER_STARTUP_TIMEOUT} for its own thread to report ready, and
 *     the JUnit extension starts and stops the server around EVERY test method - so a
 *     class of thirty cases binds and unbinds thirty times, and one slow bind out of
 *     thirty fails the whole class. The wait is raised rather than the lifecycle changed,
 *     because per-method is what keeps one case's messages out of the next one's.
 * <li><b>Three classes were sharing one port.</b> {@code PostmanTest} used
 *     {@code ServerSetupTest.SMTP} from the day it was written, and the increment that
 *     wrote this helper put two more classes on the same 3025. Surefire runs them one
 *     after another in one JVM, so they do not overlap by design - but a socket that has
 *     not finished letting go when the next class starts is a failure nobody could
 *     reproduce, and a port apiece costs nothing.
 * </ul>
 *
 * <p>The port is handed in rather than counted here, so that the class using it says
 * which one it is and two classes cannot silently agree on the same number.
 *
 * <p><b>Every class in this repo that starts a mail server comes through here, since
 * 20.09.2026.</b> Until that day {@code PostmanTest} was the one left outside, still on
 * the raw default and its two seconds, and the sentence that stood in the item above said
 * so. Ten full builds of a clean main on 19.09.2026 are why it no longer is: the sixth
 * exited 1 with ten errors, every one of them that same failure to bind 3025, and not one
 * case of that class had run while the other nine builds reported 2286 green.
 *
 * <p>What keeps it from drifting back is in {@code PostmanTest} rather than here, because
 * the question is about a server that is up: the case there reads the wait and the port off
 * the RUNNING extension, so a class put back on the raw default goes red on the wait rather
 * than one loaded machine in ten.
 */
/* Public rather than package private since 20.09.2026: PostmanTest lives in
 * com.btl.portal.mail and this is the last class it had to reach. The shape is
 * TestcontainersConfiguration's, public since 08.09.2026 for the same reason and
 * saying so in its own comment. Unlike that one the method below is public too,
 * because a test class calls it by name rather than Spring by reflection. */
public final class MailServerForACase {

	/**
	 * Ten seconds, which is a wait and not a delay: nothing waits for it when the server
	 * comes up at once, and what it buys is that a machine running twenty-one builds does
	 * not report an untested class as a tested one.
	 */
	private static final long LONG_ENOUGH_TO_COME_UP = 10_000;

	private MailServerForACase() {
	}

	/** SMTP on this port, on the loopback address, with time to come up. */
	public static ServerSetup on(int port) {
		ServerSetup setup = ServerSetupTest.SMTP.createCopy(port, "127.0.0.1",
				ServerSetup.PROTOCOL_SMTP);

		setup.setServerStartupTimeout(LONG_ENOUGH_TO_COME_UP);

		return setup;
	}
}
