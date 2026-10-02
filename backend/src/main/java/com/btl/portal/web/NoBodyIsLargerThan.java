package com.btl.portal.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.server.ResponseStatusException;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * NO BODY IS LARGER THAN {@link #BYTES}, ASKED ONCE, AT THE FRONT, FOR EVERY ROUTE.
 *
 * <p><b>Why a limit exists at all.</b> ADL A56, 19.09.2026: a signed in member sent
 * 19,088,910 bytes to this portal and was answered an orderly 400. The whole body had been read and held
 * in memory before it was parsed, and nothing had refused it earlier: {@code application.properties}
 * sets no size for a JSON body (the multipart settings in it are for the picture and for nothing else),
 * and the one filter upstream reads a cookie. The same two words, {@code readAllBytes}, stand in
 * {@code InboxWriteApi}, {@code MeWriteApi} and {@code MeCategoryWriteApi}, and a body bound with
 * {@code @RequestBody} is read whole too.
 *
 * <p><b>One place, because a limit written into each route is a limit somebody forgets.</b> This filter
 * hands every request on with a body that cannot be read past {@link #BYTES}. It is not told which routes
 * read a body or how: {@code readAllBytes}, a parser reading off the stream, a message converter and a
 * reader all go through {@code getInputStream()} or {@code getReader()}, so a route written tomorrow is
 * bounded without having been named. It does not decide who may send what - that is the door's - and it
 * does not look at the address at all.
 *
 * <p><b>THE NUMBER IS 512 KIB, AND IT IS DERIVED FROM THE LARGEST BODY THE PORTAL CAN LEGITIMATELY SEND,
 * NOT CHOSEN.</b> That body is not a form. The longest single form, the written-page editor
 * ({@code admin-strana}), is about 25 KB with every box full of three-byte characters, and A56 derived its
 * 256 KB from that on 19.09.2026, before the route that takes a GROUP existed. {@code POST /api/competitors}
 * takes up to {@code CompetitorWriteApi.THE_MOST_IN_ONE_GROUP} rows of the registration form, and a hundred
 * full rows are 162 KiB with the Serbian alphabet (two bytes a character), 216 KiB with three-byte
 * characters and 377 KiB if every character were a pasted control character, which JSON writes as six
 * bytes and which nobody types. 512 KiB is the smallest power of two above the last of those, so no body
 * the forms and the group cap allow is refused whatever it is made of, and it is a fourteenth of what
 * nginx lets through ({@code client_max_body_size 7m}). The group route is from 26.09.2026, a week after
 * A56 was written, which is why the number there is half of this one. {@code NoBodyIsLargerThanTest}
 * derives all of that
 * from the form definitions and from the cap instead of repeating it here, and fails the day a form, a
 * field or the cap grows past it - or the day this number is raised to something that no longer bounds
 * anything.
 *
 * <p><b>It refuses only where a body is READ, and that is the whole of what it changes.</b> Nothing is
 * counted until something asks for the stream, and the stream is asked for after the door has been
 * answered, so every answer a caller got before this class existed is the answer he gets now: somebody who
 * is not signed in is told 401 whatever he sent (ADL A8), an account that names no member is turned away
 * before its body is read ({@link WhatWasSent}), and a moderator without the right is refused at the door
 * ({@link RightsAtTheDoor}) with the same bytes the twin gets. 413 goes only to somebody whose body a route
 * or a filter really reads, which is somebody who has already got past the door and is entitled to be told
 * what is wrong with his request. A refusal made earlier, for everybody, would have been a new rule about
 * who is answered what, and nothing here needs one. <b>The one body a FILTER reads before the door</b> is a
 * {@code PUT}, {@code PATCH} or {@code DELETE} that carries form content (see below), and there the 413 is
 * the same for everybody and for every address, the one that exists and the one that does not, because
 * the filter that reads it does not know which is which.
 *
 * <p><b>The body is refused in two ways, and each is the other's blind spot.</b> A body that DECLARES a
 * length above the limit is refused when it is first asked for, before a byte is read. A body that does
 * not declare one - {@code Transfer-Encoding: chunked} - is counted as it is read and refused at the byte
 * that crosses the line, so the limit holds whatever the client says about itself. The first alone leaves
 * a chunked body unbounded; the second alone reads up to the limit of a body that could have been refused
 * outright.
 *
 * <p><b>It is a {@link ResponseStatusException}, and that is measured and not a taste.</b> Jackson 3 turns
 * an {@code IOException} thrown by the stream it is reading into a {@code JacksonIOException}, which is a
 * {@code JacksonException}, which every route that reads a body by hand catches and answers as „the form
 * was not filled in": 400, where the owner's own limit says 413. A {@code RuntimeException} passes
 * through unwrapped (Jackson 3.1.4, 02.10.2026), and this one is answered by the machinery that answers
 * {@code nothingIsHere()} everywhere else - {@code sendError}, one call into what an unmapped address
 * already uses - so a body read by a message converter, by {@code readAllBytes} and by a parser off the
 * stream is refused in the same words.
 *
 * <p><b>It sits in front of Spring's own filters, and the order is the point.</b> {@code FormContentFilter}
 * reads the body of a {@code PUT}, {@code PATCH} or {@code DELETE} that carries form content, before the
 * security chain and for somebody who is not signed in. Behind it, this filter would never see that body;
 * in front, the read goes through the wrapper and a refusal that escapes from the filters behind is caught
 * here and answered 413, because nothing else would answer it and the container would say 500.
 *
 * <p><b>WHAT IT DOES NOT BOUND, written down rather than left to be found.</b> A multipart body is the
 * container's and the picture's: {@code spring.servlet.multipart.max-request-size} is six megabytes,
 * {@code WhatAPictureIs.AT_MOST_BYTES} five and nginx seven, and a limit that wrapped it would refuse
 * every photograph. It is left alone by its {@code Content-Type}, which is the very test Spring applies
 * before it parses one. A form that the CONTAINER parses itself through {@code getParameter} - a
 * {@code POST} of {@code application/x-www-form-urlencoded}, which {@code CsrfFilter} may ask for its
 * {@code _csrf} - does not pass through a stream this class can wrap, and is bounded by the connector's own
 * {@code maxPostSize}; {@code NoBodyIsLargerThanOverRealHttpTest} reads that number off the running server.
 * No write route of this portal declares form content as what it consumes, so the first of those is the
 * picture's and the second is nobody's.
 */
@Component
final class NoBodyIsLargerThan extends OncePerRequestFilter implements Ordered {

	/**
	 * The most a body may weigh: 512 KiB. See the note above for where it comes from, and
	 * {@code NoBodyIsLargerThanTest} for what keeps it there.
	 */
	static final long BYTES = 512 * 1024;

	/**
	 * Ahead of every filter Spring registers that can read a body, {@code FormContentFilter}
	 * (order -9900) first among them. Asked of the context and not trusted by
	 * {@code NoBodyIsLargerThanOverRealHttpTest}.
	 */
	static final int ORDER = Ordered.HIGHEST_PRECEDENCE + 100;

	@Override
	public int getOrder() {
		return ORDER;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
			FilterChain chain) throws ServletException, IOException {

		/* A MULTIPART BODY IS NOT THIS CLASS'S, and it is left alone by the same test Spring
		   applies before it parses one. The container has already been told how much of it to take. */
		if (isMultipart(request)) {
			chain.doFilter(request, response);

			return;
		}

		try {
			chain.doFilter(new Bounded(request), response);
		}
		catch (TooLarge tooLarge) {
			/* A REFUSAL THAT GOT OUT OF A FILTER BEHIND THIS ONE, which nothing else would answer: the
			   dispatcher answers the ones raised inside it, and a filter has no dispatcher. */
			response.sendError(tooLarge.getStatusCode().value());
		}
	}

	private static boolean isMultipart(HttpServletRequest request) {
		String type = request.getContentType();

		return type != null && type.toLowerCase(Locale.ROOT).startsWith("multipart/");
	}

	/** The body is longer than {@link #BYTES}, which is a 413 whoever reads it. */
	static final class TooLarge extends ResponseStatusException {

		TooLarge() {
			super(HttpStatus.CONTENT_TOO_LARGE);
		}
	}

	/** The request, handing out a body that cannot be read past the limit. */
	static final class Bounded extends HttpServletRequestWrapper {

		private ServletInputStream counted;

		Bounded(HttpServletRequest request) {
			super(request);
		}

		/**
		 * The same stream however often it is asked for, so what has been read is counted once.
		 * Refused here, before a byte is read, where the body says it is too long.
		 */
		@Override
		public ServletInputStream getInputStream() throws IOException {
			if (counted == null) {
				if (getContentLengthLong() > BYTES) {
					throw new TooLarge();
				}

				counted = new Counting(super.getInputStream());
			}

			return counted;
		}

		/**
		 * A reader over the counted stream and not the container's own, which would read past the limit
		 * without this class ever seeing it.
		 */
		@Override
		public BufferedReader getReader() throws IOException {
			String encoding = getCharacterEncoding();

			return new BufferedReader(new InputStreamReader(getInputStream(),
					encoding == null ? StandardCharsets.ISO_8859_1 : Charset.forName(encoding)));
		}
	}

	/** A stream that counts what it hands out and refuses the byte that crosses the line. */
	static final class Counting extends ServletInputStream {

		private final ServletInputStream inner;

		private long handedOut;

		Counting(ServletInputStream inner) {
			this.inner = inner;
		}

		@Override
		public int read() throws IOException {
			int one = inner.read();

			if (one >= 0) {
				count(1);
			}

			return one;
		}

		@Override
		public int read(byte[] into, int from, int length) throws IOException {
			int got = inner.read(into, from, length);

			if (got > 0) {
				count(got);
			}

			return got;
		}

		private void count(int more) {
			handedOut += more;

			if (handedOut > BYTES) {
				throw new TooLarge();
			}
		}

		@Override
		public int available() throws IOException {
			return inner.available();
		}

		@Override
		public void close() throws IOException {
			inner.close();
		}

		@Override
		public boolean isFinished() {
			return inner.isFinished();
		}

		@Override
		public boolean isReady() {
			return inner.isReady();
		}

		@Override
		public void setReadListener(ReadListener listener) {
			inner.setReadListener(listener);
		}
	}
}
