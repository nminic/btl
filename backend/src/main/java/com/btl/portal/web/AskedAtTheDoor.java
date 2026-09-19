package com.btl.portal.web;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * THE MARK AN ANNOTATION CARRIES WHEN {@link RightsAtTheDoor} ASKS ABOUT IT.
 *
 * <p>It goes on ANNOTATIONS and never on a route. {@link RightIsNeeded} carries it and
 * so does {@link OnlyTheSuperadmin}, and it says one thing about both: a route wearing
 * either of them is a route the door decides, so a route wearing neither is a route
 * that answers every signed in account.
 *
 * <p><b>Why this exists at all, which is a question about the FLOOR and not about the
 * door.</b> {@code RightsAtTheDoorTest.everyRouteTheControllersMapEitherNeedsARightOrIsNamedHere}
 * takes every route the dispatcher maps, throws away the ones that are guarded, and
 * demands that whatever is left be named in a snapshot of routes that answer WITHOUT a
 * guard, each with its reason. Until 14.09.2026 "guarded" and "carries
 * {@link RightIsNeeded}" were the same sentence, because there was one kind of guard.
 * {@code /api/moderators} is the second kind - no tick opens it (PDL P28a, 13.08.2026,
 * „Moderatori nemaju kolonu"), so it carries no right - and written against the old floor it
 * would have had to be listed as a route that answers without a guard, which is the exact
 * opposite of the truth and would be a lie sitting inside the floor.
 *
 * <p><b>And why a mark rather than a list of the two annotation types.</b> A list is a
 * thing somebody has to remember to extend, and the day a third kind of guard is written
 * the floor would go on passing while quietly demanding that its routes be declared
 * unguarded. That is the repo's rule of 05.09.2026 - „Pod koji i sam nosi spisak nije
 * pod" - and the shape it asks for: bind the floor to something the LANGUAGE already
 * says. Java says it here. A guard annotation that carries this mark is found by asking
 * the annotation about itself, so there is no list anywhere, in the floor or beside it,
 * and a third kind is covered on the day it is written rather than on the day somebody
 * remembers.
 *
 * <p><b>What this mark does NOT do, said out loud because a mark is easy to read as
 * more than it is.</b> It does not enforce anything. Carrying it does not make the door
 * ask a question; the door asks the two questions it knows how to ask, by name. So an
 * annotation marked here and not wired into {@link RightsAtTheDoor#preHandle} would be
 * a guard that guards nothing - which is the gap this mark could otherwise open, and it
 * is closed by measurement rather than by care:
 * {@code everyRouteTheDoorDecidesIsShutToACompetitorAlthoughHeIsSignedIn} asks every
 * route carrying any marked annotation, as a plain competitor, and fails on anything but
 * a refusal. That case is derived from the dispatcher, so it has no list either.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.ANNOTATION_TYPE)
@interface AskedAtTheDoor {
}
