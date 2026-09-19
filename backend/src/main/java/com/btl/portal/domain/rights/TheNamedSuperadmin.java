package com.btl.portal.domain.rights;

import com.btl.portal.domain.account.WhatAnAddressLooksLike;

import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * THE ACCOUNTS THE SERVER'S OWN SETTINGS CALL SUPERADMINS, answered without a database.
 *
 * <p><b>The owner, 14.09.2026, choosing between three offered outcomes</b> (PDL P21,
 * 14.09.2026, „Superadmin se ne pravi kroz portal"): „Superadmin se ne pravi kroz portal
 * nego se imenuje adresom u podesavanjima servera." He was offered naming an address,
 * editing the database by hand, and a screen; he took the first. How it works is the
 * next sentence of the same decision: „adresa stoji u {@code deploy/.env}... Nalog sa tom
 * adresom, <b>kad je adresa potvrdjena</b>, nosi ulogu superadmina."
 *
 * <p><b>Why this is asked on every request rather than written into a row once.</b> The
 * same decision says what the role IS: „posto uloga <b>ne stoji kao zapis koji se
 * dodeljuje</b>, nego se izvodi iz podesavanja, superadmin ne moze da se obrise ni
 * razvlasti kroz portal uopste" (PDL P21), and ADL says it again from the technical side
 * (ADL 19.09.2026, „uloga superadmina se izvodi iz adrese u podesavanjima servera a ne
 * stoji kao zapis koji se dodeljuje"). A written {@code account.role_id} would be exactly
 * the record that decision says does not exist, and it would be wrong in the one
 * direction that matters: on the day the address in {@code deploy/.env} changes, the
 * account named by the OLD one would go on holding every right there is, and by that same
 * decision there is no screen anywhere that could take it away. Derived, the setting is
 * the whole truth at every moment - change it and restart, and the role moves with it.
 *
 * <p><b>THE SETTING NAMES A LIST AND NOT ONE PERSON, because what it carries out is a
 * decision about a NUMBER.</b> „Odluka od istog dana da superadminskih naloga <b>sme da
 * bude vise</b> ostaje tacna i sprovodi se <b>brojem adresa u podesavanjima</b>, ne
 * kucicama u portalu", and „danas je u podesavanjima <b>jedna</b> adresa. <b>Portal to ne
 * ogranicava</b>, ali ni ne nudi ekran za dodavanje" (PDL P21, 14.09.2026). ADL says the
 * same from the schema's side: {@code role_only_one_holds_every_right} fixes that exactly
 * one ROLE carries {@code rights_mode = 'all'}, while „broj <b>naloga</b> sa tom ulogom
 * nije njime ogranicen <b>i ne sme da bude</b>". Read as a single address the portal
 * would be the thing doing the limiting, and it would do it in the worst shape there is:
 * measured 20.09.2026 against the reading that took one address, an operator who wrote
 * two of them - comma, semicolon or space, all four spellings tried - got a portal with
 * NO superadmin at all, neither the new one nor the one who administered it yesterday,
 * while every page went on being served and nothing anywhere said why.
 *
 * <p><b>The separator is the comma, and that is not a choice this class made.</b> The
 * question „how is a list written here" already has an owner: Spring's property binder
 * splits a list-valued property on commas and strips each member, and it does so
 * identically whether the value arrives from {@code application.properties}, from a
 * {@code -Dbtl.superadmin.email=...} on the command line, or from the environment
 * variable {@code BTL_SUPERADMIN_EMAIL} that {@code deploy/compose.prod.yml} and
 * {@code deploy/compose.qa.yml} hand the container. So this is given the members rather
 * than a line to cut up, which is why no separator is written anywhere below; that the
 * whole path really behaves that way is measured through the real binder by
 * {@code SuperadminIsNamedByAnAddressTest#twoNamedAddressesAreTwoSuperadmins} rather than
 * assumed from this paragraph.
 *
 * <p><b>Where the list ends, written down here rather than left to be found.</b>
 *
 * <ol>
 * <li><b>A member that is blank names nobody</b>, so a trailing comma or a doubled one
 *     adds no superadmin instead of adding an account whose address is the empty string.
 *     Absent, empty and blank are therefore one case and not three, which matters because
 *     {@code deploy/compose.qa.yml} renders the second of those from the first: a portal
 *     that told them apart would behave differently depending on which of two identical
 *     intentions an operator happened to express.
 * <li><b>Spaces around a member are not part of it</b>, and neither is the case it is
 *     written in - both sides are folded through {@link WhatAnAddressLooksLike}, the way
 *     {@link #covers} describes.
 * <li><b>The same address written twice is one superadmin and not two</b>, because what
 *     is kept is a set. Nothing downstream counts these, so this costs nothing; it is
 *     said because a reader may otherwise expect a list.
 * <li><b>A member that is not an address at all covers nobody, and does not stop the
 *     portal.</b> „Sta ako je .env prazan ili odrednice nema? Portal mora da radi
 *     normalno, bez superadmina, i bez pada" is the requirement, and a typed address is a
 *     human's line in a file nobody validates. Refusing to start on a malformed one would
 *     trade a portal with no superadmin for a portal that does not answer at all, which
 *     is the worse of the two. It cannot become a way IN either:
 *     {@code account_email_shape} (V6) refuses to store anything that is not an address,
 *     so a setting that is not one cannot equal a row that is.
 *     {@code aMemberThatIsNotAnAddressCoversNobody} holds that, and the cost of the
 *     choice is that a typo makes the owner an ordinary member until he fixes it - which
 *     he sees the moment he signs in.
 * <li><b>And an address that itself carries a comma can never be named here, and the way
 *     it fails is NOT harmless.</b> That is the price of the separator, written down
 *     because nothing else would say it: a comma is {@code 0x2C}, inside the range
 *     {@code account_email_shape} permits, so {@code ime,novani@primer.rs} is a row this
 *     portal would store, while the setting naming it is cut into {@code ime} and
 *     {@code novani@primer.rs}. The first half covers nobody by the line above. <b>The
 *     second half is itself a well formed address</b>, so if somebody else holds it
 *     confirmed, that somebody is made a superadmin instead - which is the one direction
 *     this class otherwise never fails in. It is a boundary and not a hole only because
 *     of who writes the line and what is on the other side of it: {@code deploy/.env} is
 *     the owner's own file on his own host, no provider issues an address with a comma
 *     in it, and both of those would have to be untrue at once. The day one of them is,
 *     this paragraph is the decision to revisit rather than a gap to discover.
 * </ol>
 *
 * <p><b>What it costs, said here rather than found later.</b> One column more on a
 * statement {@link com.btl.portal.web.WhoIsAsking} already makes once per request, and no
 * second round trip. Nothing is cached, which is the point: a cache would be a second
 * home for the setting and would lag it by exactly as long as it lived.
 */
public final class TheNamedSuperadmin {

	/**
	 * The addresses the settings name, each folded the way a stored one is, and empty when
	 * the settings name nobody.
	 */
	private final Set<String> named;

	/**
	 * Reads the setting once, at the moment the portal is put together.
	 *
	 * @param settings the members of {@code btl.superadmin.email} as the property binder
	 *                 split them, which may be none at all, and any of which may be empty,
	 *                 spaces, or something that is not an address. Never null and never
	 *                 carrying a null: the binder converts every member it produces, and a
	 *                 caller that passed one would be told so here rather than quietly
	 *                 naming nobody
	 */
	public TheNamedSuperadmin(String... settings) {
		this.named = Stream.of(settings)
				.filter(one -> !one.isBlank())
				.map(WhatAnAddressLooksLike::asItIsStored)
				.collect(Collectors.toUnmodifiableSet());
	}

	/**
	 * Whether this account is one of the accounts the settings name.
	 *
	 * <p><b>Both halves of the owner's sentence are asked here, and neither on its own
	 * would be it.</b> „Nalog sa tom adresom" is the address, and „kad je adresa
	 * potvrdjena" is the confirmation; an account that merely CLAIMS a named address holds
	 * nothing, because claiming an address is what registration does and anybody may do
	 * it. Without the second half, the first person to register with a named address
	 * before its owner does would hold every right there is without ever reading the mail.
	 *
	 * <p><b>The comparison is made on both sides folded</b>, through the same
	 * {@link WhatAnAddressLooksLike#asItIsStored} registration writes the row with, so
	 * {@code Imenovani@Primer.rs } in the file and {@code imenovani@primer.rs} in the row
	 * are one address. Done on the raw strings it would turn on how the operator happened
	 * to hold the shift key, and the person it would lock out is the owner. The stored
	 * side is folded here rather than trusted to have been written folded, which is the
	 * floor {@code asItIsStored} itself names: a row written by a migration or by a hand at
	 * the console need not be.
	 *
	 * @param address          {@code account.email} as the row carries it, never null
	 * @param addressConfirmed whether {@code account.email_confirmed_at} is set
	 */
	public boolean covers(String address, boolean addressConfirmed) {
		return addressConfirmed && named.contains(WhatAnAddressLooksLike.asItIsStored(address));
	}
}
