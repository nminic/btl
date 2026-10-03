package com.btl.portal.web;

import com.btl.portal.web.NoBodyIsLargerThan.Bounded;
import com.btl.portal.web.NoBodyIsLargerThan.Counting;
import com.btl.portal.web.NoBodyIsLargerThan.TooLarge;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.lang.reflect.RecordComponent;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * THE LIMIT ON A BODY, AND THE STREAM THAT ENFORCES IT, WITHOUT A SERVER.
 *
 * <p>What a refusal looks like on a socket is {@code NoBodyIsLargerThanOverRealHttpTest}'s; this class
 * holds what a server cannot be asked cheaply: every way of reading a stream is counted, the line is
 * exactly where the constant says, the wrapper hands out one stream however often it is asked, a reader
 * is a reader over the counted stream, and the filter leaves a multipart body alone and answers a
 * refusal that escapes from a filter behind it.
 *
 * <p><b>And the floor under the number.</b> {@link NoBodyIsLargerThan#BYTES} is derived, and a derived
 * number with no test over its source is a number with a date on it. The largest body the portal can
 * legitimately send is worked out here from the form definitions and from the cap on a group, and the
 * limit has to be the smallest power of two above it - which fails the day a field, a form or the cap
 * grows past it, and fails the day it falls so far that the limit bounds nothing it was meant to.
 */
class NoBodyIsLargerThanTest {

	private static final int LINE = (int) NoBodyIsLargerThan.BYTES;

	/** A stream of this many bytes, which remembers what it was asked. */
	private static final class Fake extends ServletInputStream {

		private final int length;

		private int at;

		private final List<String> asked = new ArrayList<>();

		Fake(int length) {
			this.length = length;
		}

		@Override
		public int read() {
			asked.add("read");

			return at < length ? at++ & 0x7f : -1;
		}

		@Override
		public int read(byte[] into, int from, int count) {
			asked.add("read[]");

			if (at >= length) {
				return -1;
			}

			int got = Math.min(count, length - at);

			Arrays.fill(into, from, from + got, (byte) 'a');
			at += got;

			return got;
		}

		@Override
		public int available() {
			asked.add("available");

			return length - at;
		}

		@Override
		public void close() {
			asked.add("close");
		}

		@Override
		public boolean isFinished() {
			asked.add("isFinished");

			return at >= length;
		}

		@Override
		public boolean isReady() {
			asked.add("isReady");

			return true;
		}

		@Override
		public void setReadListener(ReadListener listener) {
			asked.add("setReadListener");
		}
	}

	/** A request that declares no length and hands out a stream of its own, which is a chunked one. */
	private static final class Chunked extends MockHttpServletRequest {

		private final Fake stream;

		Chunked(int length) {
			this.stream = new Fake(length);
		}

		@Override
		public long getContentLengthLong() {
			return -1;
		}

		@Override
		public ServletInputStream getInputStream() {
			return stream;
		}
	}

	/** A request that remembers whether anybody asked for its stream. */
	private static final class Watched extends MockHttpServletRequest {

		private boolean touched;

		@Override
		public ServletInputStream getInputStream() {
			touched = true;

			return super.getInputStream();
		}
	}

	/* ------------------------------------------------------------------------------------------
	   THE STREAM
	   ------------------------------------------------------------------------------------------ */

	/** The line, in both directions. */
	@Test
	void exactlyTheLimitIsReadAndOneByteMoreIsRefused() throws IOException {
		assertThat(new Counting(new Fake(LINE)).readAllBytes())
				.as("a body of exactly the limit was not read to the end")
				.hasSize(LINE);

		assertThatThrownBy(() -> new Counting(new Fake(LINE + 1)).readAllBytes())
				.as("a body one byte over the limit was read to the end")
				.isInstanceOf(TooLarge.class);
	}

	/** Every way of reading is counted, and none is a way round. */
	@Test
	void everyWayOfReadingIsCounted() {
		Counting oneByteAtATime = new Counting(new Fake(LINE + 1));

		assertThatThrownBy(() -> {
			for (int one = 0; one <= LINE; one++) {
				oneByteAtATime.read();
			}
		}).as("reading a byte at a time went past the limit").isInstanceOf(TooLarge.class);

		assertThatThrownBy(() -> new Counting(new Fake(LINE + 1)).skipNBytes(LINE + 1))
				.as("skipping went past the limit without counting").isInstanceOf(TooLarge.class);

		assertThatThrownBy(() -> new Counting(new Fake(LINE + 1)).transferTo(java.io.OutputStream.nullOutputStream()))
				.as("copying the stream somewhere went past the limit").isInstanceOf(TooLarge.class);
	}

	/** The end of the stream and a read of nothing cost nothing, so a body is never refused for them. */
	@Test
	void theEndOfTheStreamAndAReadOfNothingCostNothing() throws IOException {
		Counting stream = new Counting(new Fake(3));

		assertThat(stream.read(new byte[0], 0, 0)).as("a read of nothing returned something").isZero();
		assertThat(stream.readAllBytes()).hasSize(3);
		assertThat(stream.read()).as("the end of the stream, a byte at a time").isEqualTo(-1);
		assertThat(stream.read(new byte[4], 0, 4)).as("the end of the stream, in bulk").isEqualTo(-1);
	}

	/** Everything that is not reading is the container's own stream's answer. */
	@Test
	void everythingElseIsHandedToTheStreamItWraps() throws IOException {
		Fake inner = new Fake(5);
		Counting stream = new Counting(inner);

		assertThat(stream.available()).isEqualTo(5);
		assertThat(stream.isFinished()).isFalse();
		assertThat(stream.isReady()).isTrue();
		stream.setReadListener(null);
		stream.close();

		assertThat(inner.asked)
				.as("what the wrapper did not hand to the stream it wraps")
				.containsExactly("available", "isFinished", "isReady", "setReadListener", "close");
	}

	/* ------------------------------------------------------------------------------------------
	   THE REQUEST
	   ------------------------------------------------------------------------------------------ */

	/** A body that says it is too long is refused when it is asked for, before a byte is read. */
	@Test
	void aBodyThatSaysItIsTooLongIsRefusedBeforeAByteIsRead() {
		Watched request = new Watched();

		request.setContent(new byte[LINE + 1]);

		assertThatThrownBy(() -> new Bounded(request).getInputStream())
				.as("a body that declares more than the limit was handed out").isInstanceOf(TooLarge.class);
		assertThat(request.touched)
				.as("the container's own stream was asked for although the body had already said it was"
						+ " too long").isFalse();
	}

	/** And one that says it is exactly the limit is handed out, because nothing says it is too long. */
	@Test
	void aBodyThatSaysItIsExactlyTheLimitIsHandedOut() throws IOException {
		MockHttpServletRequest request = new MockHttpServletRequest();

		request.setContent(new byte[LINE]);

		assertThat(new Bounded(request).getInputStream().readAllBytes()).hasSize(LINE);
	}

	/**
	 * THE SAME STREAM EVERY TIME, so that what is read is counted once however often it is asked for.
	 * A body that declares no length is the one this matters for: nothing else would stop a second
	 * call from starting the count again.
	 */
	@Test
	void theSameStreamIsHandedOutEveryTimeSoWhatIsReadIsCountedOnce() throws IOException {
		Bounded request = new Bounded(new Chunked(LINE + 10));
		ServletInputStream first = request.getInputStream();

		assertThat(request.getInputStream()).isSameAs(first);
		assertThat(first.readNBytes(LINE - 5)).hasSize(LINE - 5);

		assertThatThrownBy(() -> request.getInputStream().readNBytes(10))
				.as("what was read through the first call was not counted against the second")
				.isInstanceOf(TooLarge.class);
	}

	/** A reader is a reader over the counted stream, and reads what the encoding says. */
	@Test
	void aReaderIsOverTheCountedStreamAndReadsWhatTheEncodingSays() throws IOException {
		MockHttpServletRequest utf8 = new MockHttpServletRequest();

		utf8.setContent("ž".getBytes(StandardCharsets.UTF_8));
		utf8.setCharacterEncoding("UTF-8");

		assertThat(new Bounded(utf8).getReader().readLine()).isEqualTo("ž");

		MockHttpServletRequest unsaid = new MockHttpServletRequest();

		unsaid.setContent(new byte[] {(byte) 0xE9});

		assertThat(new Bounded(unsaid).getReader().readLine())
				.as("a request that says nothing about its encoding is read as the Servlet specification"
						+ " says, which is ISO-8859-1")
				.isEqualTo("é");
	}

	/** A reader does not read past the limit either, which the container's own would. */
	@Test
	void aReaderDoesNotReadPastTheLimitEither() throws IOException {
		Reader reader = new Bounded(new Chunked(LINE + 10)).getReader();

		assertThatThrownBy(() -> reader.transferTo(Writer.nullWriter()))
				.as("a reader read past the limit").isInstanceOf(TooLarge.class);
	}

	/* ------------------------------------------------------------------------------------------
	   THE FILTER
	   ------------------------------------------------------------------------------------------ */

	private static MockFilterChain handOn(MockHttpServletRequest request) throws Exception {
		MockFilterChain chain = new MockFilterChain();

		new NoBodyIsLargerThan().doFilter(request, new MockHttpServletResponse(), chain);

		return chain;
	}

	/** A multipart body is the container's and the picture's, and is handed on as it is. */
	@Test
	void aMultipartBodyIsHandedOnAsItIs() throws Exception {
		MockHttpServletRequest request = new MockHttpServletRequest();

		request.setContentType("multipart/form-data; boundary=x");

		assertThat(handOn(request).getRequest()).isSameAs(request);
	}

	/** The type is read the way Spring reads it, in any case. */
	@Test
	void aMultipartTypeIsRecognisedInAnyCase() throws Exception {
		MockHttpServletRequest request = new MockHttpServletRequest();

		request.setContentType("MULTIPART/FORM-DATA; boundary=x");

		assertThat(handOn(request).getRequest()).isSameAs(request);
	}

	/** Every other body is handed on bounded: JSON, a form, and one that names no type at all. */
	@Test
	void everyOtherBodyIsHandedOnBounded() throws Exception {
		for (String type : new String[] {"application/json", "application/x-www-form-urlencoded", null,
				"application/json; x=\"multipart/form-data\""}) {
			MockHttpServletRequest request = new MockHttpServletRequest();

			if (type != null) {
				request.setContentType(type);
			}

			assertThat(handOn(request).getRequest())
					.as("a body of type [%s] was not handed on bounded", type)
					.isInstanceOf(Bounded.class);
		}
	}

	/** A refusal that gets out of a filter behind this one is answered, because nothing else would. */
	@Test
	void aRefusalThatGetsOutOfAFilterBehindIsAnswered413() throws Exception {
		MockHttpServletResponse response = new MockHttpServletResponse();
		FilterChain refusing = (request, answer) -> {
			throw new TooLarge();
		};

		new NoBodyIsLargerThan().doFilter(new MockHttpServletRequest(), response, refusing);

		assertThat(response.getStatus()).isEqualTo(413);
		assertThat(response.isCommitted())
				.as("the refusal was written onto the response and not sent as an error, which is the"
						+ " other road to an answer that is not the container's own")
				.isTrue();
	}

	/** And anything else that gets out is not this filter's to answer. */
	@Test
	void anythingElseThatGetsOutIsLeftToTheContainer() {
		FilterChain failing = (request, answer) -> {
			throw new IllegalStateException("not a body that was too long");
		};

		assertThatThrownBy(() -> new NoBodyIsLargerThan().doFilter(new MockHttpServletRequest(),
				new MockHttpServletResponse(), failing))
				.as("a fault that is not about a body was turned into a 413")
				.isInstanceOf(IllegalStateException.class);
	}

	@Test
	void itIsOrderedWhereTheConstantSaysItIs() {
		assertThat(new NoBodyIsLargerThan().getOrder()).isEqualTo(NoBodyIsLargerThan.ORDER);
	}

	/* ------------------------------------------------------------------------------------------
	   THE FLOOR UNDER THE NUMBER
	   ------------------------------------------------------------------------------------------ */

	private static final Path DEFINITIONS = Path.of("..", "frontend", "src", "forms", "definitions");

	/**
	 * What one character of free text costs in the worst case JSON has: a control character, which
	 * {@code JSON.stringify} writes as six bytes ({@code \}{@code u0001}). Nobody types one, and it is
	 * the ceiling that makes the number independent of the alphabet. A character of the Serbian
	 * alphabet costs two, and one outside it costs three.
	 */
	private static final int THE_MOST_A_TYPED_CHARACTER_COSTS = 6;

	/**
	 * THE LIMIT IS THE SMALLEST POWER OF TWO ABOVE THE LARGEST BODY THE PORTAL CAN LEGITIMATELY SEND.
	 *
	 * <p><b>What is legitimate is what the owner's own forms and the group cap allow</b>: every text
	 * field full to its {@code maxLength}, every character the worst a character can be, and the one
	 * body that grows with a list - {@code POST /api/competitors}, up to
	 * {@code THE_MOST_IN_ONE_GROUP} rows of the registration form - a hundred times. The longest single
	 * form is an eighth of that, and a limit derived from forms alone (ADL A56, 19.09.2026, a week
	 * before the group route existed) was 256 KB: enough for a full group at three bytes a character
	 * and short of one at the worst a character can be.
	 *
	 * <p><b>Both directions.</b> A limit under the largest legitimate body refuses somebody doing what
	 * the portal asked of him; one more than a power of two above it bounds less than it was written to.
	 * Neither is a decision this class takes: it fails and asks for one.
	 */
	@Test
	void theLimitIsTheSmallestPowerOfTwoAboveTheLargestBodyThePortalMayLegitimatelySend()
			throws Exception {

		long largestForm = 0;
		int forms = 0;

		try (Stream<Path> files = Files.list(DEFINITIONS)) {
			for (Path file : files.filter(one -> one.toString().endsWith(".form.json")).toList()) {
				Map<String, JsonNode> fields = fieldsOf(file);

				largestForm = Math.max(largestForm, objectOf(fields.values().stream()
						.map(NoBodyIsLargerThanTest::aFieldAtItsLongest).toList()));
				forms++;
			}
		}

		assertThat(forms).as("the form definitions are not where this test looks, so the largest form is"
				+ " the largest of none").isGreaterThan(10);

		long theGroup = theLargestGroup();
		long theLargestBody = Math.max(largestForm, theGroup);

		assertThat(theGroup)
				.as("a group of the most rows the route takes is not the largest body there is, so this"
						+ " test is about forms again and the cap on a group is not what sets the limit")
				.isGreaterThan(largestForm);
		assertThat(NoBodyIsLargerThan.BYTES)
				.as("the limit is not the smallest power of two at or above %d bytes, which is the"
						+ " largest body the forms and the cap on a group allow with every box full of the"
						+ " worst character", theLargestBody)
				.isEqualTo(Long.highestOneBit(theLargestBody - 1) << 1);
	}

	private static Map<String, JsonNode> fieldsOf(Path file) throws IOException {
		Map<String, JsonNode> fields = new LinkedHashMap<>();
		JsonNode fieldList = new ObjectMapper().readTree(Files.readString(file, StandardCharsets.UTF_8))
				.path("fields");

		for (int at = 0; at < fieldList.size(); at++) {
			fields.put(fieldList.get(at).get("name").asString(), fieldList.get(at));
		}

		return fields;
	}

	/**
	 * One field as it is written into a body, key and value, at its longest.
	 *
	 * <p>Typed by what the box is, because a box with a FORMAT has a worst case of its own: free text
	 * is full of the costliest character, an address of electronic mail is ASCII by protocol and is
	 * bounded by it (no form and no route states a bound, and 254 is RFC 5321's), a date is ten
	 * characters, a choice is its longest option, a tick is {@code false}. A password has no bound in the
	 * form or on the server and is given an allowance, which only a form can reach - never the group.
	 */
	private static long aFieldAtItsLongest(JsonNode field) {
		String name = field.get("name").asString();
		String type = field.path("type").asString("");

		return name.length() + 3 + switch (type) {
			case "email" -> 2 + 254;
			case "date" -> 2 + 10;
			case "checkbox" -> 5;
			case "password" -> 2 + 128 * THE_MOST_A_TYPED_CHARACTER_COSTS;
			case "choice", "select" -> 2 + longestOption(field);
			default -> 2 + field.path("maxLength").asInt(1024) * THE_MOST_A_TYPED_CHARACTER_COSTS;
		};
	}

	private static long longestOption(JsonNode field) {
		JsonNode options = field.path("options");
		long longest = 0;

		for (int at = 0; at < options.size(); at++) {
			longest = Math.max(longest, options.get(at).path("value").asString().length());
		}

		return longest;
	}

	/** An object of these members, braces and commas counted. */
	private static long objectOf(List<Long> members) {
		return 2 + members.stream().mapToLong(Long::longValue).sum() + Math.max(0, members.size() - 1);
	}

	/**
	 * THE LARGEST GROUP {@code POST /api/competitors} TAKES: the most rows it allows, each a row of
	 * {@code CompetitorWriteApi.Invited} with every box full.
	 *
	 * <p>The row is read off the record the route declares and not off the registration form, so a
	 * component somebody adds to the record is a component this counts; and each component has to be
	 * ACCOUNTED FOR - by a box of the registration form, by the town a {@code place} box stands for, or
	 * by its own type - and one that is not fails here and does not get a guess. A town is three keys,
	 * the name the person typed, its country's code and the codebook's number for it.
	 */
	private static long theLargestGroup() throws IOException {
		Map<String, JsonNode> boxes = fieldsOf(DEFINITIONS.resolve("registracija.form.json"));
		List<Long> row = new ArrayList<>();

		for (RecordComponent component : CompetitorWriteApi.Invited.class.getRecordComponents()) {
			String name = component.getName();
			Class<?> type = component.getType();
			long value;

			if (type == Boolean.class) {
				value = 5;
			}
			else if (type == Long.class) {
				value = 20;
			}
			else if (boxes.containsKey(name)) {
				value = aFieldAtItsLongest(boxes.get(name)) - name.length() - 3;
			}
			else if (name.equals("country")) {
				value = 2 + 2;
			}
			else {
				throw new AssertionError("a component of CompetitorWriteApi.Invited that the registration"
						+ " form does not account for: " + name + ". Say what it costs here rather than"
						+ " let the largest group be a guess.");
			}

			row.add(name.length() + 3 + value);
		}

		long members = CompetitorWriteApi.THE_MOST_IN_ONE_GROUP;

		return "{\"members\":[".length() + members * objectOf(row) + (members - 1) + "]}".length();
	}
}
