package com.btl.portal.domain.rights;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHO THE SERVER'S SETTINGS CALL A SUPERADMIN, measured without a database.
 *
 * <p>The owner's sentence has two halves - „Nalog sa tom adresom, <b>kad je adresa
 * potvrdjena</b>, nosi ulogu superadmina" (PDL P21, 14.09.2026, „Superadmin se ne pravi
 * kroz portal") - and each half is its own case here, because a reading that dropped
 * either would still pass a suite that only ever asked about one account.
 *
 * <p><b>The addresses below are made up, and the reason is NOT that the owner's own is a
 * secret.</b> It is not one: an address is an identity, his stands in the author header
 * of every commit this public repository carries, and an address on its own opens
 * nothing. What opens everything is the password beside it, which is the cost PDL P21
 * writes down where it abolishes the second factor - „superadminski nalog vidi spisak
 * prava svih administratora i sve licne podatke, pa ko dodje do te lozinke dolazi do
 * svega" (14.09.2026). What these cases need of an address is its SHAPE, and that two of
 * them differ; a real one would add nothing and would read as a fixture about one person
 * rather than about the rule.
 */
class TheNamedSuperadminTest {

	private static final String NAMED = "imenovani@primer.rs";

	private static final String ALSO_NAMED = "drugi@primer.rs";

	private static final String SOMEBODY_ELSE = "neimenovani@primer.rs";

	/** The whole of the owner's sentence, both halves satisfied. */
	@Test
	void theNamedAndConfirmedAccountIsTheSuperadmin() {
		assertThat(new TheNamedSuperadmin(NAMED).covers(NAMED, true))
				.as("the account the settings name, with its address confirmed, was not the"
						+ " superadmin")
				.isTrue();
	}

	/**
	 * AND THE SECOND HALF IS LOAD BEARING: a claimed address is not a confirmed one.
	 *
	 * <p>This is the case the decision was written around. Anybody may type anybody's
	 * address into the registration form, so a portal that read the address alone would
	 * hand every right there is to whoever got to a named address first - without ever
	 * opening the mail, which is the only thing that proves it is his.
	 */
	@Test
	void anUnconfirmedAddressHoldsNothing() {
		assertThat(new TheNamedSuperadmin(NAMED).covers(NAMED, false))
				.as("an account that merely CLAIMS the named address was made superadmin, so"
						+ " registering with it is enough to take the portal")
				.isFalse();
	}

	/** And an account that is not a named one holds nothing, confirmed or not. */
	@Test
	void anotherAccountIsNotTheSuperadmin() {
		TheNamedSuperadmin named = new TheNamedSuperadmin(NAMED);

		assertThat(named.covers(SOMEBODY_ELSE, true))
				.as("an account at a different address was made superadmin")
				.isFalse();
	}

	/**
	 * TWO NAMED ADDRESSES ARE TWO SUPERADMINS, which is the decision this setting carries
	 * out rather than a capability nobody asked for.
	 *
	 * <p>„Odluka od istog dana da superadminskih naloga <b>sme da bude vise</b> ostaje
	 * tacna i sprovodi se <b>brojem adresa u podesavanjima</b>, ne kucicama u portalu",
	 * and „danas je u podesavanjima jedna adresa. <b>Portal to ne ogranicava</b>" (PDL
	 * P21, 14.09.2026). ADL says the same from the schema's side: one ROLE holds every
	 * right, while „broj naloga sa tom ulogom nije njime ogranicen <b>i ne sme da bude</b>".
	 *
	 * <p><b>BOTH are asked, and a third that is named by neither.</b> Asking only the
	 * first would be satisfied by a reading that took the first member and dropped the
	 * rest; asking only the two named ones would be satisfied by one that made everybody
	 * a superadmin the moment the setting held more than one name.
	 *
	 * <p>What this class cannot measure is that the LINE the operator writes is cut into
	 * these members, because the cutting is the property binder's and not this class's.
	 * {@code SuperadminIsNamedByAnAddressTest#twoNamedAddressesAreTwoSuperadmins} carries
	 * one comma-separated line through the real binder and asks the same question of a
	 * real request.
	 */
	@Test
	void everyNamedAddressIsASuperadminAndNoOtherIs() {
		TheNamedSuperadmin named = new TheNamedSuperadmin(NAMED, ALSO_NAMED);

		assertThat(named.covers(NAMED, true))
				.as("the first of two named addresses was not the superadmin")
				.isTrue();

		assertThat(named.covers(ALSO_NAMED, true))
				.as("a second address was named in the settings and the portal refused it the"
						+ " role, which limits by code a number the settings are meant to decide")
				.isTrue();

		assertThat(named.covers(SOMEBODY_ELSE, true))
				.as("naming two addresses made a third account superadmin as well")
				.isFalse();
	}

	/**
	 * AND A MEMBER THAT IS BLANK NAMES NOBODY, rather than naming the empty address.
	 *
	 * <p>A trailing comma and a doubled one are what a person editing a list by hand
	 * actually leaves behind, and the binder hands both on as an empty member. Kept, it
	 * would be an address in the set that no row can ever equal - harmless today and a
	 * trap on the day anything else reads this set as „how many superadmins are there".
	 * Dropped, the question does not arise.
	 */
	@Test
	void aBlankMemberNamesNobodyAndDoesNotDisturbTheOthers() {
		TheNamedSuperadmin named = new TheNamedSuperadmin(NAMED, "", "   ", ALSO_NAMED);

		assertThat(named.covers(NAMED, true))
				.as("an empty member between two named addresses swallowed the first of them")
				.isTrue();

		assertThat(named.covers(ALSO_NAMED, true))
				.as("an empty member between two named addresses swallowed the second of them")
				.isTrue();

		assertThat(named.covers("", true))
				.as("the empty string was taken for an address and made somebody a superadmin")
				.isFalse();
	}

	/**
	 * THE COMPARISON IS NEITHER CASE SENSITIVE NOR SPACE SENSITIVE, ON EITHER SIDE.
	 *
	 * <p><b>Both sides, and that is the point of the case.</b> The setting is a line a
	 * person types into a file nobody validates, and the row is written folded by
	 * registration - so a literal comparison would turn on how somebody held the shift key
	 * while editing {@code deploy/.env}, and the person it would lock out of his own
	 * portal is the owner. The four spellings below are the ones a mail client and a
	 * telephone keyboard actually produce.
	 */
	@Test
	void theSpellingOfTheSettingDoesNotDecideWhoTheSuperadminIs() {
		for (String spelling : new String[] {NAMED, "Imenovani@Primer.rs", "IMENOVANI@PRIMER.RS",
				"  imenovani@primer.rs  "}) {
			assertThat(new TheNamedSuperadmin(spelling).covers(NAMED, true))
					.as("the setting spelled `%s` did not name the account it plainly names", spelling)
					.isTrue();
		}

		/* And the same tolerance on the side that comes out of the row, which is the floor
		   under a row written by a migration or by a hand at the console rather than by
		   registration - the case `WhatAnAddressLooksLike.asItIsStored` names in its own
		   javadoc. */
		assertThat(new TheNamedSuperadmin(NAMED).covers("Imenovani@Primer.RS", true))
				.as("a stored address written unfolded was not recognised as the named one")
				.isTrue();
	}

	/**
	 * A PORTAL THAT NAMES NOBODY HAS NO SUPERADMIN, AND DOES NOT FALL OVER.
	 *
	 * <p>„Sta ako je .env prazan ili odrednice nema? Portal mora da radi normalno, bez
	 * superadmina, i bez pada." Absent, empty and blank are one case rather than three:
	 * an absent setting reaches this as no members at all, {@code compose.qa.yml} renders
	 * an empty one from an absent one, and a line of spaces is what a person leaves. A
	 * portal that told them apart would behave differently depending on which of three
	 * identical intentions an operator happened to express.
	 */
	@Test
	void aPortalThatNamesNobodyHasNoSuperadmin() {
		for (TheNamedSuperadmin nobody : new TheNamedSuperadmin[] {new TheNamedSuperadmin(),
				new TheNamedSuperadmin(""), new TheNamedSuperadmin("   ")}) {

			assertThat(nobody.covers(NAMED, true))
					.as("the settings name nobody, yet an account was made superadmin by them")
					.isFalse();

			assertThat(nobody.covers(SOMEBODY_ELSE, true))
					.as("the settings name nobody, yet another account was made superadmin")
					.isFalse();
		}
	}

	/**
	 * AND A MEMBER THAT IS NOT AN ADDRESS AT ALL COVERS NOBODY.
	 *
	 * <p>The boundary the class writes down rather than guards with a branch: a malformed
	 * member is not refused loudly, because refusing to start would trade a portal with
	 * no superadmin for a portal that does not answer. It cannot become a way in either,
	 * and this is why - {@code account_email_shape} (V6) refuses to store anything that is
	 * not an address, so a member that is not one cannot equal a row that is. The empty
	 * string is excluded above as naming nobody; these are the shapes that are present and
	 * still wrong.
	 *
	 * <p><b>The last of them is the whole of the fault this increment closes, kept here as
	 * the case that says what it looked like.</b> A WHOLE LINE, uncut - which is what
	 * every reading before 20.09.2026 was handed - is one member carrying two {@code @},
	 * so it matches no row at all: neither of the two people it plainly names was the
	 * superadmin, the portal came up, every page was served, and nothing said why.
	 */
	@Test
	void aMemberThatIsNotAnAddressCoversNobody() {
		for (String rubbish : new String[] {"imenovani", "@", "not an address",
				NAMED + "," + ALSO_NAMED}) {

			TheNamedSuperadmin named = new TheNamedSuperadmin(rubbish);

			assertThat(named.covers(NAMED, true))
					.as("the member `%s` is not an address, yet it named a superadmin", rubbish)
					.isFalse();

			assertThat(named.covers(ALSO_NAMED, true))
					.as("the member `%s` is not an address, yet it named a second superadmin",
							rubbish)
					.isFalse();
		}
	}
}
