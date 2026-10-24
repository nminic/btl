package com.btl.portal;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * THE ONE PLACE WHERE THE SERVER IS ALLOWED TO DO SOMETHING WITHOUT A REQUEST.
 *
 * <p>Until the sweep of the pictures folder this backend had no {@code @Scheduled} method and no
 * switch for one, so nothing here ran unless somebody asked. Spring ignores an {@code @Scheduled}
 * annotation entirely when scheduling is not switched on, and says nothing about it, so the
 * switch is the thing that has to be in exactly one place: a job that is written and silently
 * never runs is worse than a job that is not written. It is here, beside
 * {@link WhatTimeItIs}, which is the other piece of configuration about time, and it is
 * a class of its own and not a line on that one because the two answer different questions: what
 * time it is, and what happens by itself at a given time.
 *
 * <p><b>WHAT HOLDS IT.</b> {@code ThePicturesFolderIsSweptTest} asks the scheduler the context
 * really built for the task that runs the sweep, and {@code UnconfirmedAccountsAreSweptTest} for
 * its own. With the annotation below removed there is no
 * task, and the case that asks for it fails; nothing reads this file's text.
 *
 * <p><b>THE NEXT JOB USES THIS SWITCH AND DOES NOT ADD A SECOND, and the second one did.</b>
 * {@code UnconfirmedAccountsAreSwept} (owner, 23.10.2026: an unconfirmed registration „briše se
 * sama" after seven days) is its own {@code @Scheduled} method and nothing more, and so will the
 * 1 January job the journal's P13 describes be. Boot builds one scheduler thread for all of them, so a job that
 * waits on something slow holds every other one back; each of them is short, and the day one is
 * not is the day to give the scheduler a pool.
 */
@Configuration
@EnableScheduling
class WhatRunsWithoutBeingAsked {

}
