package com.btl.portal;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * WHAT TIME IT IS, as a bean rather than as a call to a static method.
 *
 * <p>No {@code java.time.Clock} appeared anywhere in this source until now, which
 * is why the class did not exist. The league's own calendar never needed one:
 * {@code SeasonClock} is written so that every one of its questions takes the
 * moment as an argument, so it has been measurable at any date since the day it
 * was written.
 *
 * <p><b>Two places do NOT come through here, and saying so is the point of this
 * paragraph.</b> {@code SignInApi} and {@code WhoIsAsking} each take their moment
 * from a static {@code Instant.now()}, so "what time it is on this server" has
 * three homes and only one of them can be replaced in a case. Bringing those two
 * onto this bean is its own change with its own guards - locking out after failed
 * attempts and the life of a session are what they decide - and it is recorded as
 * separate work rather than done in passing here. Until it happens, this javadoc
 * is not describing the whole server.
 *
 * <p><b>It is here because of what the alternative costs a guard.</b> A query
 * that works out the season it is in from the database's {@code current_date},
 * or from {@code LocalDate.now()}, cannot be measured at the one boundary it is
 * about until the year really turns: a case written for it is green on 364 days
 * whether the code is right or wrong. A bean is replaced by a clock fixed to a
 * chosen day, and then both sides of a New Year are one fixture and two
 * assertions.
 *
 * <p><b>What this hands out is an INSTANT, and the zone on it is the machine's.</b>
 * Nothing may read that zone to decide a season: the server may be anywhere and
 * the league is not, so whoever asks what season it is re-reads the instant in
 * {@code SeasonClock.ZONE}. That is the same sentence {@code SeasonClock} already
 * carries about freezing a season, and it is written down once.
 */
@Configuration
class WhatTimeItIs {

	@Bean
	Clock clock() {
		return Clock.systemDefaultZone();
	}

}
