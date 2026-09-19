package com.btl.portal.domain.rights;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHO THE SERVER'S SETTINGS CALL THE SUPERADMIN, measured without a database.
 *
 * <p>The owner's sentence has two halves - „Nalog sa tom adresom, <b>kad je adresa
 * potvrdjena</b>, nosi ulogu superadmina" (PDL P21, 14.09.2026, „Superadmin se ne pravi
 * kroz portal") - and each half is its own case here, because a reading that dropped
 * either would still pass a suite that only ever asked about the owner himself.
 *
 * <p><b>The address used throughout is not the owner's.</b> His lives in
 * {@code deploy/.env} and in no file this repository carries; what these cases need is
 * only that two addresses differ.
 */
class TheNamedSuperadminTest {

	private static final String NAMED = "imenovani@primer.rs";

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
	 * hand every right there is to whoever got to the owner's address first - without ever
	 * opening the mail, which is the only thing that proves it is his.
	 */
	@Test
	void anUnconfirmedAddressHoldsNothing() {
		assertThat(new TheNamedSuperadmin(NAMED).covers(NAMED, false))
				.as("an account that merely CLAIMS the named address was made superadmin, so"
						+ " registering with it is enough to take the portal")
				.isFalse();
	}

	/** And an account that is not the named one holds nothing, confirmed or not. */
	@Test
	void anotherAccountIsNotTheSuperadmin() {
		TheNamedSuperadmin named = new TheNamedSuperadmin(NAMED);

		assertThat(named.covers(SOMEBODY_ELSE, true))
				.as("an account at a different address was made superadmin")
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
	 * {@code compose.qa.yml} renders the second from the first, so a portal that told them
	 * apart would behave differently depending on which of two identical intentions an
	 * operator happened to express.
	 */
	@Test
	void aPortalThatNamesNobodyHasNoSuperadmin() {
		for (String nobody : new String[] {null, "", "   "}) {
			TheNamedSuperadmin named = new TheNamedSuperadmin(nobody);

			assertThat(named.covers(NAMED, true))
					.as("the setting `%s` names nobody, yet an account was made superadmin by it",
							nobody)
					.isFalse();

			assertThat(named.covers(SOMEBODY_ELSE, true))
					.as("the setting `%s` names nobody, yet another account was made superadmin",
							nobody)
					.isFalse();
		}
	}

	/**
	 * AND A SETTING THAT IS NOT AN ADDRESS AT ALL COVERS NOBODY.
	 *
	 * <p>The boundary the class writes down rather than guards with a branch: a malformed
	 * setting is not refused loudly, because refusing to start would trade a portal with
	 * no superadmin for a portal that does not answer. It cannot become a way in either,
	 * and this is why - {@code account_email_shape} (V6) refuses to store anything that is
	 * not an address, so a setting that is not one cannot equal a row that is. The empty
	 * string is excluded above as naming nobody; these are the shapes that are present and
	 * still wrong.
	 */
	@Test
	void aSettingThatIsNotAnAddressCoversNobody() {
		for (String rubbish : new String[] {"nminic", "@", "nminic@gmail,com", "not an address"}) {
			assertThat(new TheNamedSuperadmin(rubbish).covers(NAMED, true))
					.as("the setting `%s` is not an address, yet it named a superadmin", rubbish)
					.isFalse();
		}
	}
}
