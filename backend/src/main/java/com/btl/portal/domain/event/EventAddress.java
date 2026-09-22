package com.btl.portal.domain.event;

import java.text.Normalizer;
import java.time.LocalDate;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * THE ADDRESS AN EVENT ANSWERS AT: its name, then the year it is run in.
 *
 * <p><b>Owner, 10.08.2026</b> (PDL: „Adresa dogadjaja je naziv i godina"):
 * {@code beogradski-maraton-2027}, without the day. An event put off a week keeps
 * its address and everything joined to it stays joined - results are merged by
 * address - and the same name twice in one year is a collision the portal refuses
 * in as many words rather than quietly writing a second event.
 *
 * <p><b>Why the year and not the whole day.</b> The same race is run every year and
 * the name on its own would collide with itself: there are three events called
 * Resolution Run in the shipped calendar and they are three different mornings. An
 * address is read and typed by people, and the day in it is exactly the part that
 * changes when a race is put off.
 *
 * <p><b>THIS IS A SECOND HOME FOR A RULE THE PORTAL ALREADY SPELLS, AND THAT IS
 * SAID HERE RATHER THAN LEFT TO BE FOUND.</b> {@code frontend/src/pages/rulebookToc.ts}
 * carries {@code slugify} and {@code entityForms.ts} carries {@code eventSlug}, and
 * they are what built the addresses in the file the portal served until
 * 21.09.2026. Two homes for one rule is the thing this repository refuses
 * everywhere else, and it was accepted here for one increment for one reason: ADL
 * A50 said the prototype's {@code /mock} would switch off all at once and at the
 * end, so until that day the screen built addresses and this server built them
 * too. <b>PR 340 was that day</b>: {@code BASE} moved from {@code /mock} to
 * {@code /api}, and {@code entityForms.ts} and {@code rulebookToc.ts} were not
 * touched by it, so the second home this paragraph excused is still standing
 * rather than closed - a question for the owner this class does not decide on its
 * own. What keeps the two from drifting is not this sentence but
 * {@code EventAddressTest}, which takes all 1167 events of {@code mock/events.json}
 * - the shipped calendar's own frozen copy now, rather than anything {@code BASE}
 * still points at - and demands this class rebuild the address each one was
 * shipped with. A rule that disagrees with the portal fails on the shipped data
 * rather than on somebody noticing.
 *
 * <p><b>The Cyrillic table is forty letters and the five Latin ones are written out,
 * which is the shape {@code slugify} argues for on its own side.</b> A table says
 * nothing about which keys are in it, so a letter it has nothing to say about is
 * better dropped than looked up; and {@code ž} and {@code đ} have no decomposed form,
 * so stripping accents through Unicode alone loses them. Both sides of that argument
 * are copied here deliberately: a cleverer rewrite would be a rule that no longer
 * matches the one the portal runs.
 */
public final class EventAddress {

	/**
	 * The Cyrillic block, one letter at a time.
	 *
	 * <p>Whole and FIRST, before anything is decomposed. Normalised first, {@code ѓ}
	 * comes apart into {@code г} and a mark, the mark is dropped, and the table then
	 * spells it {@code g} rather than {@code gj} - so Ѓорче and Горче would be one
	 * address, which is the collision the table exists to prevent.
	 */
	private static final Pattern CYRILLIC_LETTER = Pattern.compile("[\\u0400-\\u04FF]");

	/** The marks Unicode decomposition leaves behind once a letter has come apart. */
	private static final Pattern A_MARK = Pattern.compile("[\\u0300-\\u036F]");

	/** Everything an address cannot carry, however much of it stands together. */
	private static final Pattern NOT_ADDRESSABLE = Pattern.compile("[^a-z0-9]+");

	private static final Pattern EDGE_DASHES = Pattern.compile("^-+|-+$");

	/**
	 * Forty letters, spelt the way the region writes them in Latin.
	 *
	 * <p>{@code ђ} and {@code ћ} go to {@code d} and {@code c} rather than to
	 * {@code dj} and {@code ch}, because the Latin side turns {@code đ} into
	 * {@code d}: written otherwise, Đerdap and Ђердап would be two addresses for one
	 * name, which is precisely what an address is compared for. Macedonian
	 * {@code ѓ} and {@code ќ} go the other way for the same reason - in Latin they
	 * are written "gj" and "kj" and those survive the pass below unchanged.
	 */
	private static final Map<Character, String> CYRILLIC = Map.ofEntries(
			Map.entry('а', "a"), Map.entry('б', "b"), Map.entry('в', "v"), Map.entry('г', "g"),
			Map.entry('д', "d"), Map.entry('ђ', "d"), Map.entry('е', "e"), Map.entry('ж', "z"),
			Map.entry('з', "z"), Map.entry('и', "i"), Map.entry('ј', "j"), Map.entry('к', "k"),
			Map.entry('л', "l"), Map.entry('љ', "lj"), Map.entry('м', "m"), Map.entry('н', "n"),
			Map.entry('њ', "nj"), Map.entry('о', "o"), Map.entry('п', "p"), Map.entry('р', "r"),
			Map.entry('с', "s"), Map.entry('т', "t"), Map.entry('ћ', "c"), Map.entry('у', "u"),
			Map.entry('ф', "f"), Map.entry('х', "h"), Map.entry('ц', "c"), Map.entry('ч', "c"),
			Map.entry('џ', "dz"), Map.entry('ш', "s"),
			/* Macedonian. */
			Map.entry('ѓ', "gj"), Map.entry('ќ', "kj"), Map.entry('ѕ', "dz"), Map.entry('ѐ', "e"),
			Map.entry('ѝ', "i"),
			/* Bulgarian. */
			Map.entry('й', "j"), Map.entry('щ', "st"), Map.entry('ъ', "a"), Map.entry('ь', "j"),
			Map.entry('ю', "ju"), Map.entry('я', "ja"),
			/* And the alphabets the league does not run in, so that "a letter of Cyrillic"
			   is true of every one in use rather than of three. Without these, Ігор and Гор
			   were one address and the second was refused as the first. */
			Map.entry('ё', "jo"), Map.entry('ы', "y"), Map.entry('э', "e"), Map.entry('і', "i"),
			Map.entry('ї', "ji"), Map.entry('є', "je"), Map.entry('ґ', "g"), Map.entry('ў', "u"));

	private EventAddress() {
	}

	/**
	 * A name turned into something an address can carry, or the empty string.
	 *
	 * <p>Empty is a real answer and not a failure: the calendar carries Greek races
	 * (Υψηλάντειος Αγώνας Δρόμου) and this table spells Latin and Cyrillic.
	 * {@link #of} says what happens then.
	 */
	public static String written(String name) {
		String lowered = name.toLowerCase(java.util.Locale.ROOT);

		StringBuilder latin = new StringBuilder(lowered.length());

		for (int at = 0; at < lowered.length(); at++) {
			char letter = lowered.charAt(at);

			if (CYRILLIC_LETTER.matcher(String.valueOf(letter)).matches()) {
				/* A letter of the block the table has nothing to say about is dropped,
				   which is the same answer `slugify` gives it. */
				latin.append(CYRILLIC.getOrDefault(letter, ""));
			} else {
				latin.append(letter);
			}
		}

		/* THE FIVE LATIN LETTERS BY HAND, because two of them cannot be done any other
		   way: ž and đ have no decomposed form, so they would survive the strip below
		   untouched and then be turned into a dash by the pass after it. Measured on
		   the portal's own side: without this, "Bartina Teljesítménytúra" came out as
		   "bartina-teljes-tm-nyt-ra". */
		String spelled = latin.toString()
				.replace("č", "c").replace("ć", "c")
				.replace("š", "s")
				.replace("ž", "z")
				.replace("đ", "d");

		String stripped = A_MARK.matcher(Normalizer.normalize(spelled, Normalizer.Form.NFD))
				.replaceAll("");

		return EDGE_DASHES.matcher(NOT_ADDRESSABLE.matcher(stripped).replaceAll("-"))
				.replaceAll("");
	}

	/**
	 * THE ADDRESS THIS NAME AND THIS DAY BUILD.
	 *
	 * <p><b>The whole day where the name cannot be spelt at all.</b> With the name
	 * gone the address would be the year and nothing else, so two Greek races in one
	 * season would answer at one address and the refusal would say the name is taken,
	 * which is not what is wrong. The day is still a shape {@code btl_event_slug_shape}
	 * accepts, since {@code 2027-05-08} is digits and dashes.
	 */
	public static String of(String name, LocalDate day) {
		String written = written(name);

		/* The year read off the written day rather than off `getYear`, so a year is
		   always the four characters an ISO day carries and never three. */
		String iso = day.toString();

		return written.isEmpty() ? iso : written + "-" + iso.substring(0, 4);
	}

	/**
	 * AND THE ADDRESS AN EDIT LEAVES BEHIND, WHICH IS NOT ALWAYS THE ONE THE RULE
	 * WOULD BUILD.
	 *
	 * <p><b>An address that carries more than the rule can build is kept.</b> The
	 * shipped calendar has fourteen groups where one name ran twice in one year - the
	 * Gradska liga is run several times a season - and those carry the month as well
	 * ({@code gradska-liga-usce-2017-05}), which no rule here produces. Asked for the
	 * rule's answer instead, an edit that changed only the town would rewrite such an
	 * address and take everything joined to it away.
	 *
	 * <p><b>So the question is whether the two things the address is MADE of moved.</b>
	 * Rebuild the address the old name and the old day would give; if that is what the
	 * new ones give too, nothing that decides an address has changed and the stored one
	 * stands, whatever it is. That is the owner's sentence of 10.08.2026 in code: an
	 * event moved inside its season keeps its address.
	 */
	public static String keptOrRebuilt(String name, LocalDate day, String nameBefore,
			LocalDate dayBefore, String addressBefore) {

		String wanted = of(name, day);

		return of(nameBefore, dayBefore).equals(wanted) ? addressBefore : wanted;
	}
}
