package com.btl.portal.web;

import org.springframework.context.annotation.Configuration;
import org.springframework.format.FormatterRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.regex.Pattern;

/**
 * THE KEY AN ADDRESS NAMES, AND WHERE IT NAMES NONE, THE ONE KEY NO ROW HAS.
 *
 * <p><b>Why a word in a key's place has to be answered like a number that matches no row.</b>
 * ADL A8, owner, 13.09.2026: the server need not give away even that an address exists. Taken as a
 * {@code long}, a path variable is bound by Spring BEFORE the handler runs, and a word in its
 * place was answered 400 to every signed in asker while a number that matches no row was answered
 * 404. One request with a word in it, and a plain member knows an action lives at that address.
 * 02.10.2026 closed it for the three writes on the verification queue with a check inside the
 * handler; this type is the one home of that check, and every route no right guards at the door
 * takes it, those three included.
 *
 * <p><b>What it does.</b> Digits, and at most eighteen of them - eighteen nines is smaller than
 * the largest {@code long}, so everything this accepts can be parsed and nothing longer names a row
 * any sequence has reached - are a key. Anything else, a word, a plus sign, {@code 0x1}, nineteen
 * digits, is {@link #NONE}. Asked about the SHAPE and not by trying to parse, so there is no
 * exception to turn into an answer. What Spring itself used to accept - {@code +5}, {@code 0x10} -
 * is no key any more, on every route that takes this type.
 *
 * <p><b>Why a key and not a check at the door, an advice or a pattern in the mapping.</b> All
 * three answer BEFORE the handler, and several handlers ask about the FORM before they ask about
 * the row: a member who sends a body without the field is told 400 about the form, to a number
 * that matches no row and to nothing else. A word refused earlier than that would be 404 where the
 * number is 400, and the difference is the oracle again, one step along. A word that BECOMES a key
 * no row has travels the very same road as a number that matches no row - the same checks in the
 * same order, for every caller, every verb and every body - so nothing is kept equal by hand.
 *
 * <p><b>{@link #NONE} is minus one, and nothing may be able to produce it.</b> A key is a
 * sequence's value and a sequence starts at one, so no row has it. That is not left to a sentence:
 * {@code AKeyTest} reads {@code pg_sequences} - the start, the bounds and the step of every
 * sequence there is, and not a list of sequences - and fails if any of them can reach it.
 *
 * <p><b>The routes a right guards at the door keep {@code long}, on purpose.</b>
 * {@code RightsAtTheDoorTest} sweeps them with a word in the key's place and reads a 400 as the
 * proof that the door is what answered: the door runs before any variable is bound, so a plain
 * member is told 404 by it, while anything downstream is told 400. This type would make downstream
 * a 404 too, and a door knocked out for one of those routes would go on looking shut. What it costs
 * is known and accepted: somebody who HOLDS the right is told 400 for a word there, and he is
 * entitled to know the route exists. {@code RightsAtTheDoorTest} holds both halves of the line -
 * no route a right guards takes this type, and no other route takes a key that is not one.
 *
 * <p>Read off the address by the one converter below. It never fails, which is the point of it.
 *
 * @param value the key, or {@code -1} where the address named none
 */
record AKey(long value) {

	/** The key nobody has. */
	static final AKey NONE = new AKey(-1);

	private static final Pattern DIGITS = Pattern.compile("[0-9]{1,18}");

	/**
	 * What an address spells, read as a key or as the one nobody has.
	 *
	 * <p>Not called {@code of} or {@code valueOf}, which Spring's generic conversion looks for by name
	 * and would use without being told, so that the registration below is what makes the type
	 * readable and the case that asks for it is not satisfied by a naming convention.
	 */
	static AKey read(String spelt) {
		return DIGITS.matcher(spelt).matches() ? new AKey(Long.parseLong(spelt)) : NONE;
	}

	/** The one place Spring is told how to read the type, so that no route has to remember to. */
	@Configuration(proxyBeanMethods = false)
	static class Reading implements WebMvcConfigurer {

		@Override
		public void addFormatters(FormatterRegistry registry) {
			registry.addConverter(String.class, AKey.class, AKey::read);
		}
	}
}
