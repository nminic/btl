package com.btl.portal.web;

/**
 * WHAT THE 1 JANUARY JOB DOES AFTER THE SNAPSHOT, IN THE SAME TRANSACTION AND NEVER BEFORE IT.
 *
 * <p>ADL, 05.11.2026, „Posao od 1. januara: tri toka i jedan redosled": „Ispadanje iz timova i parova
 * radi u istoj transakciji kao snimak, posle njega: PR snimka uvodi mesto u {@code ASeasonFreezes} na
 * kom se poziva ono što sledi zamrzavanju (interfejs), a prelaz sezone ga implementira u svom razredu."
 * The order is the journal's own, PDL, derived 19.09.2026: „Redosled je zamrzavanje pa ispadanje, i ne
 * bira se: zamrznut snimak mora da zapiše sezonu onakvu kakva je proživljena."
 *
 * <p><b>WHAT AN IMPLEMENTATION IS PROMISED.</b> It is called once per season, when the row of
 * {@code season_frozen} for that season has just been taken and every table of the snapshot has been
 * written, inside that one transaction. If it throws, the snapshot and the row go with it and the whole
 * act is tried again on the next run of {@link ASeasonFreezes}, so it is never called for a season whose
 * snapshot it did not follow, and never twice for one that stands.
 */
interface WhatFollowsTheFreeze {

	/**
	 * @param season the season that has just been frozen: 2027 on 1.1.2028 at 16:00
	 */
	void followTheFreezeOf(int season);
}
