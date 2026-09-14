package com.btl.portal.web;

import com.btl.portal.domain.rights.AdminRights;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * A ROUTE NO TICK OPENS, written on the route itself.
 *
 * <p>The second kind of guard, and it exists because of a decision rather than because
 * of a shape. {@link RightIsNeeded} names a box the superadmin ticks for one moderator;
 * this names the one thing there is no box for.
 *
 * <p><b>The owner, 13.08.2026, in as many words: „Ne treba ni da postoji kolona
 * moderatori jer samo superadmin ima ta prava" ({@code PDL.md:4403}).</b> So the matrix
 * has six entity columns against seven entities, and moderators are the seventh. ADL A8
 * says the same fact as a technical rule: „Entitet koji nijedan moderator ne sme da
 * otvori nema kolonu u matrici" ({@code ADL.md:802}), and it says what the column would
 * have been - a box the superadmin could tick, a row that then read one right more, and
 * a moderator who got the same refusal as before.
 *
 * <p><b>Which is why this could not be {@code @RightIsNeeded("entity:moderators")}.</b>
 * There is no such right and V5 does not insert one. A code the matrix does not hold is
 * not a shut door: {@link AdminRights} answers the superadmin yes to ANY string, so a
 * made up code would refuse every moderator and let through the one account that can do
 * the most damage - and every case somebody thought to write with a moderator would look
 * green. {@code RightsAtTheDoorTest.everyRightARouteAsksForIsOneTheMatrixHolds} compares
 * what the routes ask for against what {@code admin_right} really holds, off the
 * database, so the made up code would be caught. This annotation asks no code at all, so
 * that floor has nothing to compare and nothing to be loosened by.
 *
 * <p><b>What it asks instead is the MODE, and never the name of a role.</b>
 * {@code AdminRights.Mode.ALL} is V5's {@code rights_mode = 'all'}, and V5's partial
 * unique index {@code role_only_one_holds_every_right} makes at most one role carry it.
 * Read as {@code role.code = 'superadmin'} this would be a second home for a fact the
 * mode already holds, and the two could disagree; read as the mode it cannot, because
 * the schema refuses a second role that holds everything. It also keeps the whole of
 * "may he" in one place ({@link WhatHeMayDo}, ADL A8's second requirement) rather than
 * putting half of it in a string comparison here.
 *
 * <p><b>And a moderator holding EVERY box is still refused, which is the whole point.</b>
 * PDL P21: „Superadmin kreira moderatore i uređuje im prava... Van toga, Superadmin i
 * Moderator mogu isto" ({@code PDL.md:2967}) - this is that one thing, and the owner
 * gave the reason on 30.07.2026: „Bez te granice moderator bi sam sebi mogao da dodeli
 * prava, pa granularna prava ne bi značila ništa" ({@code PDL.md:4438}). A guard that
 * let a fully ticked moderator through would read as correct in every fixture that
 * happens to hold a moderator with something missing, so the case that holds it ticks
 * every row of {@code admin_right} rather than a list of twelve written by hand
 * ({@code ModeratorApiTest.aModeratorHoldingEveryTickThereIsIsStillRefused}).
 *
 * <p><b>The refusal is 404 and not 403, and it is not written here.</b> It goes down the
 * one road {@link RightsAtTheDoor} takes for both kinds of guard, for the reason the long
 * note in that file gives: an imitation of {@code sendError} comes apart at the first
 * header nobody thought of, and the difference is readable from outside as an oracle for
 * whether an address exists. Somebody not signed in still gets 401 from the chain, which
 * never reaches here at all.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
@AskedAtTheDoor
@interface OnlyTheSuperadmin {
}
