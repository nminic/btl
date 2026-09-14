package com.btl.portal.web;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * THE RIGHT A ROUTE NEEDS, written on the route itself.
 *
 * <p>ADL A8, 30.07.2026: rights are enforced on the ROUTE and not inside the screen.
 * That decision was written for the front end, where a route table applies it, and
 * the reason given was that the fifteenth screen must not be added by forgetting the
 * check. The same reason holds on this side and rather harder: a screen that forgets
 * shows something it should not, an endpoint that forgets hands it over.
 *
 * <p><b>Why an annotation and not a table of paths.</b> A table is a second place
 * where a route is spelt, and the two can disagree - a path renamed in one and not
 * the other leaves a door with no rule in front of it and nothing that says so. The
 * annotation cannot come apart from the method it guards, and it is a thing rather
 * than a string, so {@code RightsAtTheDoorTest} asks the dispatcher for it instead
 * of reading source text and guessing at how it was written (the rule of
 * 07.09.2026: a guard that has to recognise how something is spelt has no floor).
 *
 * <p><b>The value is the code as {@code admin_right.code} generates it</b>, {@code
 * entity:members} or {@code queue:results}, and that is checked rather than trusted:
 * a misspelt right would be refused to every moderator and ALLOWED to the superadmin,
 * whose mode answers yes to any string at all. So it would be a door that looks shut
 * in every test somebody thought to write with a moderator, and stands open for the
 * one account that can do the most damage. {@code everyRightARouteAsksForIsOneTheMatrixHolds}
 * compares what the routes ask for with what the matrix holds, read off the database.
 *
 * <p><b>And it is no longer the only kind of guard, which is what {@link AskedAtTheDoor}
 * is for.</b> {@link OnlyTheSuperadmin} guards the one entity no tick opens. Both wear
 * that mark, so the floor that counts guarded routes asks the annotation about itself
 * rather than holding a list of two names that a third kind would quietly fall out of.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
@AskedAtTheDoor
@interface RightIsNeeded {

	/** The code of the box the superadmin ticks, {@code scope:target}. */
	String value();
}
