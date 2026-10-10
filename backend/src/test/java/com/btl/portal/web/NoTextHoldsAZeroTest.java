package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.core.MethodParameter;
import org.springframework.util.ClassUtils;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.lang.reflect.ParameterizedType;
import java.lang.reflect.RecordComponent;
import java.lang.reflect.Type;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.SortedMap;
import java.util.SortedSet;
import java.util.TreeMap;
import java.util.TreeSet;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

/**
 * NO TEXT HOLDS A ZERO CHARACTER, ASKED OF EVERY TEXT OF EVERY BODY THE DISPATCHER KNOWS AND
 * OF EVERY OTHER TEXT IT BINDS.
 *
 * <p>The reader this is about is {@link NoTextHoldsAZero}, and the HTTP answers it ends in are
 * {@code ATextWithAZeroIsRefusedOnEveryKindOfRouteTest}'s. This class is the floor under the
 * word „every": the sweep is DERIVED from the dispatcher, so a route written tomorrow is asked
 * without having been named, and nothing in it is a list that has to be remembered.
 *
 * <p><b>What the sweep is made of.</b> For every body type a handler takes ({@link TheBodyOf}
 * reads both spellings, the argument and {@link WhatWasSent}) the type is walked reflectively -
 * through nested records, through the rows of a list, through a list of texts - and every
 * {@code String} it finds is a leaf. A leaf is then given a zero at its start, in its middle,
 * at its end and as its whole value, in a document that is otherwise one the type would accept,
 * and the document is read the two ways this portal reads one: straight from the bytes, which
 * is what an argument, {@link WhatWasSent} and three of the four hand-read routes do, and
 * through a tree, which is what {@code PUT /api/me} does. A type this walk does not know how to
 * walk FAILS the walk; it does not get a guess.
 *
 * <p><b>The control is half of it.</b> A reader that refused every text would pass the sweep
 * above, and so would one that refused every control character, so each leaf is also given
 * what a person could really type - a box left empty, ordinary words, a tab, a line feed, Cyrillic,
 * an emoji, the low control characters, the no-break space, a zero width space - and every one of
 * those has to be read. Each of them was chosen to be a character a plausible wrong rule would turn away.
 *
 * <p><b>The refusal must be this reader's, and not some other error that looks the same.</b> A
 * raw zero inside a JSON string is a syntax error, and a number field holding a zero is a
 * coercion error; both are a {@code JacksonException} and neither is what is being measured. So
 * the zero is always written as the escape the portal's own forms would produce, and the
 * exception must carry the sentence the reader gives it.
 *
 * <p><b>The four routes that read their own body are not visible to the dispatcher</b>, because
 * they take the request and not a type (the reason {@link WhatWasSent} exists for the rest). They
 * are named in a table here, and the table has its own floor: the controllers that hold an
 * {@link ObjectMapper} are asked of the dispatcher, and the table must be exactly those. A fifth
 * route that reads by hand is a controller holding a mapper, so it fails until it is in the table
 * - and while it is in the table it is swept like any other.
 *
 * <p><b>And the texts that are not a body.</b> A path variable, a request parameter and a cookie
 * can each carry text, and the reader above does not see them. Each one the dispatcher binds is
 * listed with what becomes of a zero in it, so a new one fails until somebody has said. The one
 * parameter that reaches a statement as it was typed, {@code search}, asks the same
 * {@link NoTextHoldsAZero#holdsAZero} question itself.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class NoTextHoldsAZeroTest {

	/** The character itself, never written as an escape in this source. */
	private static final String ZERO = String.valueOf((char) 0);

	/**
	 * The four routes that read the request by hand, by controller, with the record each one
	 * reads. {@code MeCategoryWriteApi.Wish} holds no text at all, and it is here because a text
	 * added to it tomorrow is swept the day it is added.
	 */
	private static final Map<String, String> READ_BY_HAND = Map.of(
			"InboxWriteApi", "Written",
			"MeCategoryWriteApi", "Wish",
			"MeWriteApi", "Change",
			"VerificationWriteApi", "Answered");

	/**
	 * EVERY TEXT THE DISPATCHER BINDS THAT IS NOT A BODY, and what becomes of a zero in it. The
	 * key is the controller, the handler and the parameter; the value is why a zero there does no
	 * harm, or what refuses it.
	 */
	private static final Map<String, String> THE_OTHER_TEXTS = Map.ofEntries(
			Map.entry("CompetitorWriteApi#remove:memberNumber (path)",
					"a zero in a path is a 400 before any handler is reached"),
			Map.entry("PhotoApi#photo:name (path)",
					"a zero in a path is a 400 before any handler is reached"),
			Map.entry("PhotoApi#mineThatWaits:digest (path)",
					"a zero in a path is a 400 before any handler is reached"),
			Map.entry("PricingWriteApi#change:key (path)",
					"a zero in a path is a 400 before any handler is reached"),
			Map.entry("CompetitorWriteApi#remove:account (parameter)",
					"compared with the two words it may be, and never put into a statement"),
			Map.entry("MePhotoApi#send:cropX (parameter)", "parsed as a number"),
			Map.entry("MePhotoApi#send:cropY (parameter)", "parsed as a number"),
			Map.entry("MePhotoApi#send:cropSize (parameter)", "parsed as a number"),
			Map.entry("PageApi#pages:lang (parameter)",
					"matched against the shape of a language tag, which has no room for a zero"),
			Map.entry("PaymentsDueApi#due:search (parameter)",
					"REFUSED: it asks NoTextHoldsAZero.holdsAZero itself and answers 400"),
			Map.entry("MePasswordApi#change:" + SessionCookie.NAME + " (cookie)",
					"hashed before it is used"),
			Map.entry("SignOutApi#signOut:" + SessionCookie.NAME + " (cookie)",
					"hashed before it is used"));

	@Autowired
	private ObjectMapper mapper;

	/** The dispatcher, asked which routes exist rather than told. */
	@Autowired
	@Qualifier("requestMappingHandlerMapping")
	private RequestMappingHandlerMapping mappings;

	/* ------------------------------------------------------------------------------------------
	   WHAT IS SWEPT
	   ------------------------------------------------------------------------------------------ */

	/** One text of one body: the way down to it from the root, a name for an object and a 0 for a list. */
	private record Leaf(String type, List<Object> path) {

		@Override
		public String toString() {
			StringBuilder way = new StringBuilder(type);

			for (Object step : path) {
				way.append(step instanceof Integer ? "[]" : "." + step);
			}

			return way.toString();
		}
	}

	private static String nameOf(Class<?> type) {
		return type.getName().substring(type.getPackageName().length() + 1).replace('$', '.');
	}

	/** Every body type a handler takes, as the dispatcher says, with the handlers that take it. */
	private SortedMap<Class<?>, SortedSet<String>> bodiesTheDispatcherSees() {
		SortedMap<Class<?>, SortedSet<String>> found = new TreeMap<>(
				Comparator.comparing(NoTextHoldsAZeroTest::nameOf));

		for (HandlerMethod handler : mappings.getHandlerMethods().values()) {
			Optional<Class<?>> body = TheBodyOf.type(handler);

			body.ifPresent(type -> found.computeIfAbsent(type, one -> new TreeSet<>())
					.add(ClassUtils.getUserClass(handler.getBeanType()).getSimpleName() + "#"
							+ handler.getMethod().getName()));
		}

		return found;
	}

	/** The record each hand-read route reads, by the table above. */
	private SortedMap<Class<?>, SortedSet<String>> bodiesTheTableNames() throws ClassNotFoundException {
		SortedMap<Class<?>, SortedSet<String>> found = new TreeMap<>(
				Comparator.comparing(NoTextHoldsAZeroTest::nameOf));

		for (Map.Entry<String, String> one : READ_BY_HAND.entrySet()) {
			Class<?> type = Class.forName(NoTextHoldsAZeroTest.class.getPackageName() + "."
					+ one.getKey() + "$" + one.getValue());

			found.computeIfAbsent(type, t -> new TreeSet<>()).add(one.getKey() + " (by hand)");
		}

		return found;
	}

	private SortedMap<Class<?>, SortedSet<String>> everyBody() throws ClassNotFoundException {
		SortedMap<Class<?>, SortedSet<String>> all = bodiesTheDispatcherSees();

		bodiesTheTableNames().forEach((type, who) ->
				all.computeIfAbsent(type, one -> new TreeSet<>()).addAll(who));

		return all;
	}

	private static Class<?> rawOf(Type type) {
		return type instanceof ParameterizedType parameterized
				? (Class<?>) parameterized.getRawType()
				: (Class<?>) type;
	}

	private static boolean aNumberOrAnythingElseNoTextCanBeIn(Class<?> raw) {
		return raw.isPrimitive() || Number.class.isAssignableFrom(raw) || raw == Boolean.class
				|| raw == LocalDate.class || raw.isEnum();
	}

	private static Type elementOf(Type list) {
		return ((ParameterizedType) list).getActualTypeArguments()[0];
	}

	/** Every {@code String} of a type, in the order it is declared. */
	private static void leavesOf(Type type, List<Object> path, List<List<Object>> found) {
		Class<?> raw = rawOf(type);

		if (raw == String.class) {
			found.add(List.copyOf(path));
		}
		else if (aNumberOrAnythingElseNoTextCanBeIn(raw)) {
			return;
		}
		else if (Collection.class.isAssignableFrom(raw)) {
			path.add(0);
			leavesOf(elementOf(type), path, found);
			path.remove(path.size() - 1);
		}
		else if (raw.isRecord()) {
			for (RecordComponent component : raw.getRecordComponents()) {
				path.add(component.getName());
				leavesOf(component.getGenericType(), path, found);
				path.remove(path.size() - 1);
			}
		}
		else {
			throw new AssertionError("a body holds " + type.getTypeName() + ", which this walk does not"
					+ " know how to look inside. Teach it here, in the open, rather than let a text that"
					+ " type could hold go unasked.");
		}
	}

	private List<Leaf> leavesOfEvery(Collection<Class<?>> types) {
		List<Leaf> found = new ArrayList<>();

		for (Class<?> type : types) {
			List<List<Object>> paths = new ArrayList<>();

			leavesOf(type, new ArrayList<>(), paths);
			paths.forEach(path -> found.add(new Leaf(nameOf(type), path)));
		}

		return found;
	}

	/** A document the type would accept, with one of everything. */
	private JsonNode documentOf(Type type) {
		Class<?> raw = rawOf(type);

		if (raw == String.class) {
			return mapper.valueToTree("x");
		}
		if (raw == Boolean.class || raw == boolean.class) {
			return mapper.valueToTree(true);
		}
		if (raw == BigDecimal.class) {
			return mapper.valueToTree(new BigDecimal("1"));
		}
		if (raw == LocalDate.class) {
			return mapper.valueToTree("2026-01-01");
		}
		if (raw.isPrimitive() || Number.class.isAssignableFrom(raw)) {
			return mapper.valueToTree(1);
		}
		if (Collection.class.isAssignableFrom(raw)) {
			ArrayNode list = mapper.createArrayNode();

			list.add(documentOf(elementOf(type)));

			return list;
		}
		if (raw.isRecord()) {
			ObjectNode object = mapper.createObjectNode();

			for (RecordComponent component : raw.getRecordComponents()) {
				object.set(component.getName(), documentOf(component.getGenericType()));
			}

			return object;
		}

		throw new AssertionError("no document can be made of " + type.getTypeName());
	}

	/** The same document with this text where the leaf stands, and nothing else changed. */
	private String documentWith(Class<?> type, List<Object> path, String text) {
		JsonNode copy = documentOf(type).deepCopy();
		JsonNode at = copy;

		for (Object step : path.subList(0, path.size() - 1)) {
			at = step instanceof Integer index ? at.get(index) : at.get((String) step);
		}

		Object last = path.get(path.size() - 1);

		if (last instanceof Integer index) {
			((ArrayNode) at).set(index, mapper.valueToTree(text));
		}
		else {
			((ObjectNode) at).put((String) last, text);
		}

		return mapper.writeValueAsString(copy);
	}

	private Class<?> typeNamed(Leaf leaf, Collection<Class<?>> types) {
		return types.stream().filter(one -> nameOf(one).equals(leaf.type())).findFirst().orElseThrow();
	}

	private static boolean refusedAsAZero(Throwable thrown) {
		return thrown instanceof JacksonException && thrown.getMessage() != null
				&& thrown.getMessage().contains("zero character");
	}

	/* ------------------------------------------------------------------------------------------
	   THE SWEEP IS NOT EMPTY
	   ------------------------------------------------------------------------------------------ */

	/**
	 * THE DERIVATION FINDS A PORTAL, NOT A HANDFUL.
	 *
	 * <p>Asserted before anything is compared, because a walk that found nothing would make every
	 * comparison below true while asking about no text at all. The numbers are floors and not
	 * counts: measured on 09.10.2026 as 111 texts on 29 routes that take one, and a count written
	 * here would be a number with a date on it.
	 */
	@Test
	void theWalkFindsTheBodiesAndTheTextsOfAPortalAndNotAHandful() throws Exception {
		SortedMap<Class<?>, SortedSet<String>> bodies = everyBody();
		List<Leaf> leaves = leavesOfEvery(bodies.keySet());

		assertThat(bodiesTheDispatcherSees())
				.as("the dispatcher gave up no body type, so the sweep is made of the four hand-read"
						+ " routes alone")
				.hasSizeGreaterThan(20);
		assertThat(leaves)
				.as("the walk found no texts to ask about, so every comparison below is empty")
				.hasSizeGreaterThan(90);
		assertThat(leaves.stream().anyMatch(leaf -> leaf.path().contains(0)))
				.as("no text stands inside a list, so the element of a list and the row of a group are"
						+ " never asked about")
				.isTrue();
		assertThat(leaves.stream().anyMatch(leaf -> leaf.path().size() > 2
				&& leaf.path().get(0) instanceof String && leaf.path().contains(0)
				&& leaf.path().indexOf(0) < leaf.path().size() - 1))
				.as("no text stands in a record inside a list, which is the row of a group")
				.isTrue();
		assertThat(bodies.values().stream().anyMatch(who -> who.stream().anyMatch(one -> one.endsWith(" (by hand)"))))
				.as("the four routes that read their body by hand are not part of the sweep")
				.isTrue();
	}

	/* ------------------------------------------------------------------------------------------
	   THE SWEEP
	   ------------------------------------------------------------------------------------------ */

	/**
	 * A ZERO ANYWHERE IN ANY TEXT OF ANY BODY IS REFUSED, WHEREVER IN THE TEXT IT STANDS AND
	 * HOWEVER THE BODY IS READ.
	 *
	 * <p>Four places in the text, and each is a different way for a reader to be wrong: one that
	 * looks only at the start (or the end) of a text misses the middle, and one that compares the
	 * whole text with a zero misses all three. Two ways of reading, because {@code readTree} makes
	 * its own text nodes before any deserializer is asked and the portal reads one route that way.
	 * Every text that is not refused is named, with the way it was read, so that one run names every
	 * place that is wrong.
	 */
	@Test
	void aZeroAnywhereInAnyTextOfAnyBodyIsRefused() throws Exception {
		SortedMap<Class<?>, SortedSet<String>> bodies = everyBody();
		List<String> notRefused = new ArrayList<>();

		for (Leaf leaf : leavesOfEvery(bodies.keySet())) {
			Class<?> type = typeNamed(leaf, bodies.keySet());

			for (Map.Entry<String, String> place : Map.of(
					"on its own", ZERO,
					"at the start", ZERO + "ab",
					"in the middle", "ab" + ZERO + "cd",
					"at the end", "ab" + ZERO).entrySet()) {

				String document = documentWith(type, leaf.path(), place.getValue());

				Throwable fromBytes = catchThrowable(
						() -> mapper.readValue(document.getBytes(StandardCharsets.UTF_8), type));
				Throwable fromTree = catchThrowable(
						() -> mapper.treeToValue(mapper.readTree(document), type));

				if (!refusedAsAZero(fromBytes)) {
					notRefused.add(leaf + " " + place.getKey() + ", read from the bytes: " + fromBytes);
				}
				if (!refusedAsAZero(fromTree)) {
					notRefused.add(leaf + " " + place.getKey() + ", read through a tree: " + fromTree);
				}
			}
		}

		assertThat(notRefused)
				.as("a text holding a zero character was read, or was refused for some other reason"
						+ " than the zero")
				.isEmpty();
	}

	/**
	 * EVERYTHING ELSE A PERSON COULD TYPE IS LEFT ALONE.
	 *
	 * <p>The control for the sweep above, and the half that catches a rule that is too wide: every
	 * control character (a reader asking {@code isISOControl} instead of „is it zero"), a tab and a
	 * line feed, which a text box of this portal really sends, a letter outside the Latin alphabet,
	 * a character outside the first plane (two UTF-16 units), and the spaces that are not a space.
	 * The document without any of them is read as well, because it is what tells a type that cannot
	 * be read for its own reasons from a text that was turned away.
	 */
	@Test
	void everythingElseInAnyTextOfAnyBodyIsRead() throws Exception {
		SortedMap<Class<?>, SortedSet<String>> bodies = everyBody();
		List<String> turnedAway = new ArrayList<>();

		for (Class<?> type : bodies.keySet()) {
			String plain = mapper.writeValueAsString(documentOf(type));

			if (!readsFromBytes(plain, type)) {
				turnedAway.add(nameOf(type) + ": the document of ordinary words was not read");
			}
		}

		for (Leaf leaf : leavesOfEvery(bodies.keySet())) {
			Class<?> type = typeNamed(leaf, bodies.keySet());

			for (String text : List.of("", "Ordinary words.", "tab\there", "line\nfeed", "\u0001\u001f\u007f\u0085",
					"Đorđe Џј", "run 🏃 run", "   ​ ﻿")) {

				String document = documentWith(type, leaf.path(), text);

				if (!readsFromBytes(document, type)) {
					turnedAway.add(leaf + " was turned away for [" + escaped(text) + "] read from the bytes");
				}
				if (!readsThroughATree(document, type)) {
					turnedAway.add(leaf + " was turned away for [" + escaped(text) + "] read through a tree");
				}
			}
		}

		assertThat(turnedAway)
				.as("a text without a zero in it was refused, so the rule is wider than the one"
						+ " character it is about")
				.isEmpty();
	}

	private boolean readsFromBytes(String document, Class<?> type) {
		return catchThrowable(() -> mapper.readValue(document.getBytes(StandardCharsets.UTF_8), type)) == null;
	}

	private boolean readsThroughATree(String document, Class<?> type) {
		return catchThrowable(() -> mapper.treeToValue(mapper.readTree(document), type)) == null;
	}

	private static String escaped(String text) {
		StringBuilder shown = new StringBuilder();

		for (char one : text.toCharArray()) {
			shown.append(one < 0x20 || one > 0x7e ? String.format("U+%04X ", (int) one) : String.valueOf(one));
		}

		return shown.toString().strip();
	}

	/**
	 * THE QUESTION ITSELF, WITHOUT A READER: absent is no text, and a zero anywhere is a zero.
	 */
	@Test
	void absentIsNoTextAndAZeroAnywhereIsAZero() {
		assertThat(NoTextHoldsAZero.holdsAZero(null)).as("no text at all").isFalse();
		assertThat(NoTextHoldsAZero.holdsAZero("")).as("an empty text").isFalse();
		assertThat(NoTextHoldsAZero.holdsAZero("ab")).as("ordinary words").isFalse();
		assertThat(NoTextHoldsAZero.holdsAZero("0")).as("the digit, which is not the character").isFalse();
		assertThat(NoTextHoldsAZero.holdsAZero(ZERO)).as("the character alone").isTrue();
		assertThat(NoTextHoldsAZero.holdsAZero(ZERO + "ab")).as("at the start").isTrue();
		assertThat(NoTextHoldsAZero.holdsAZero("ab" + ZERO + "cd")).as("in the middle").isTrue();
		assertThat(NoTextHoldsAZero.holdsAZero("ab" + ZERO)).as("at the end").isTrue();
	}

	/* ------------------------------------------------------------------------------------------
	   THE FLOORS UNDER THE SWEEP
	   ------------------------------------------------------------------------------------------ */

	/**
	 * THE ROUTES THAT READ THEIR BODY BY HAND ARE THE ONES THE TABLE NAMES, IN BOTH DIRECTIONS.
	 *
	 * <p>The dispatcher cannot say which type such a route reads, because it takes the request, but
	 * the type system can say that a controller reads one at all: it holds the application's
	 * {@link ObjectMapper}, which is the only way a controller can turn bytes into a record. The
	 * controllers that do are asked of the dispatcher and compared with the table, so a fifth route
	 * written the same way fails here until it is named, and a route that stops reading by hand
	 * fails until it is taken out.
	 */
	@Test
	void theRoutesThatReadTheirBodyByHandAreTheOnesTheTableNames() {
		SortedSet<String> controllersHoldingAMapper = new TreeSet<>();

		for (HandlerMethod handler : mappings.getHandlerMethods().values()) {
			Class<?> controller = ClassUtils.getUserClass(handler.getBeanType());

			for (var field : controller.getDeclaredFields()) {
				if (field.getType() == ObjectMapper.class) {
					controllersHoldingAMapper.add(controller.getSimpleName());
				}
			}
		}

		assertThat(controllersHoldingAMapper)
				.as("the controllers that hold the application's mapper are not the controllers that"
						+ " read their body by hand according to the table of this class")
				.containsExactlyInAnyOrderElementsOf(READ_BY_HAND.keySet());
	}

	/**
	 * EVERY TEXT THE DISPATCHER BINDS OUTSIDE A BODY IS ACCOUNTED FOR, AND A NEW ONE IS NOT UNTIL
	 * SOMEBODY SAYS WHAT BECOMES OF A ZERO IN IT.
	 *
	 * <p>A path variable, a request parameter and a cookie are each a text, and none of them goes
	 * through the reader this class is about. Derived from the handlers' parameters: a
	 * {@code String} that is not the body, the principal or a request object is one of the three.
	 * The table above is the other side, and it is compared in both directions.
	 */
	@Test
	void everyTextTheDispatcherBindsOutsideABodyIsAccountedFor() {
		SortedSet<String> found = new TreeSet<>();

		for (HandlerMethod handler : mappings.getHandlerMethods().values()) {
			for (MethodParameter parameter : handler.getMethodParameters()) {
				if (parameter.getParameterType() != String.class
						|| parameter.hasParameterAnnotation(RequestBody.class)
						|| parameter.hasParameterAnnotation(RequestHeader.class)) {
					continue;
				}

				String where = ClassUtils.getUserClass(handler.getBeanType()).getSimpleName() + "#"
						+ handler.getMethod().getName() + ":";
				String how;
				String name;

				if (parameter.hasParameterAnnotation(PathVariable.class)) {
					how = "path";
					name = parameter.getParameterAnnotation(PathVariable.class).name();
				}
				else if (parameter.hasParameterAnnotation(CookieValue.class)) {
					how = "cookie";
					name = parameter.getParameterAnnotation(CookieValue.class).name();
				}
				else if (parameter.hasParameterAnnotation(RequestParam.class)) {
					how = "parameter";
					name = parameter.getParameterAnnotation(RequestParam.class).name();
				}
				else {
					how = "parameter";
					name = "(unnamed)";
				}

				found.add(where + (name.isEmpty() ? nameOfTheParameter(parameter) : name) + " (" + how + ")");
			}
		}

		assertThat(found)
				.as("the texts the dispatcher binds outside a body are not the ones this class says"
						+ " what becomes of a zero in. Say it in THE_OTHER_TEXTS, or take the entry out")
				.containsExactlyInAnyOrderElementsOf(THE_OTHER_TEXTS.keySet());
		assertThat(THE_OTHER_TEXTS.get("PaymentsDueApi#due:search (parameter)"))
				.as("the one parameter that reaches a statement as typed is refused where it is read")
				.startsWith("REFUSED");
		assertThat(found.stream().map(one -> one.substring(one.lastIndexOf('(')))
				.distinct().toList())
				.as("all three ways a text arrives are among the texts this class accounts for")
				.containsExactlyInAnyOrder("(path)", "(parameter)", "(cookie)");
	}

	private static String nameOfTheParameter(MethodParameter parameter) {
		String name = parameter.getParameterName();

		return name == null ? "(unnamed)" : name;
	}
}
