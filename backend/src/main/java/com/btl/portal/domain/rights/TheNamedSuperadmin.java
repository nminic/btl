package com.btl.portal.domain.rights;

import com.btl.portal.domain.account.WhatAnAddressLooksLike;

/**
 * THE ONE ACCOUNT THE SERVER'S OWN SETTINGS CALL THE SUPERADMIN, answered without a
 * database.
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
 * <p><b>What it costs, said here rather than found later.</b> One column more on a
 * statement {@link com.btl.portal.web.WhoIsAsking} already makes once per request, and no
 * second round trip. Nothing is cached, which is the point: a cache would be a second
 * home for the setting and would lag it by exactly as long as it lived.
 *
 * <p><b>A setting that is not an address at all covers nobody, and does not stop the
 * portal.</b> „Sta ako je .env prazan ili odrednice nema? Portal mora da radi normalno,
 * bez superadmina, i bez pada" is the requirement, and a typed address is a human's line
 * in a file nobody validates. Refusing to start on a malformed one would trade a portal
 * with no superadmin for a portal that does not answer at all, which is the worse of the
 * two. It cannot become a way IN either: {@code account_email_shape} (V6) refuses to
 * store anything that is not an address, so a setting that is not one cannot equal a row
 * that is. {@code aSettingThatIsNotAnAddressCoversNobody} holds that, and the cost of the
 * choice is that a typo makes the owner an ordinary member until he fixes it - which he
 * sees the moment he signs in.
 */
public final class TheNamedSuperadmin {

	/**
	 * The address the settings name, folded the way a stored one is, or {@code null} when
	 * the settings name nobody.
	 */
	private final String named;

	/**
	 * Reads the setting once, at the moment the portal is put together.
	 *
	 * <p><b>Absent and empty are one case and not two.</b> A variable nobody set and one
	 * set to nothing are the same sentence from the operator - „there is no superadmin
	 * here" - and {@code deploy/compose.qa.yml} renders the second of those from the
	 * first, so a portal that told them apart would behave differently depending on which
	 * of two identical intentions an operator happened to express.
	 *
	 * @param setting {@code btl.superadmin.email} as the environment gave it, which may be
	 *                null, empty, spaces, or something that is not an address at all
	 */
	public TheNamedSuperadmin(String setting) {
		this.named = setting == null || setting.isBlank()
				? null
				: WhatAnAddressLooksLike.asItIsStored(setting);
	}

	/**
	 * Whether this account is the one the settings name.
	 *
	 * <p><b>Both halves of the owner's sentence are asked here, and neither on its own
	 * would be it.</b> „Nalog sa tom adresom" is the address, and „kad je adresa
	 * potvrdjena" is the confirmation; an account that merely CLAIMS the address holds
	 * nothing, because claiming an address is what registration does and anybody may do
	 * it. Without the second half, the first person to register with the owner's address
	 * before the owner does would hold every right there is without ever reading the
	 * mail.
	 *
	 * <p><b>The comparison is made on both sides folded</b>, through the same
	 * {@link WhatAnAddressLooksLike#asItIsStored} registration writes the row with, so
	 * {@code NMinic@Gmail.com } in the file and {@code nminic@gmail.com} in the row are
	 * one address. Done on the raw strings it would turn on how the operator happened to
	 * hold the shift key, and the person it would lock out is the owner. The stored side
	 * is folded here rather than trusted to have been written folded, which is the floor
	 * {@code asItIsStored} itself names: a row written by a migration or by a hand at the
	 * console need not be.
	 *
	 * @param address          {@code account.email} as the row carries it, never null
	 * @param addressConfirmed whether {@code account.email_confirmed_at} is set
	 */
	public boolean covers(String address, boolean addressConfirmed) {
		return named != null
				&& addressConfirmed
				&& named.equals(WhatAnAddressLooksLike.asItIsStored(address));
	}
}
