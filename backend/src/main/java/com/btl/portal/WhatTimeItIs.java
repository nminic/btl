package com.btl.portal;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * WHAT TIME IT IS, as a bean rather than as a call to a static method.
 *
 * <p>Nothing on this server had asked until now, and that is why the class did
 * not exist: {@code java.time.Clock} appeared nowhere in the source, and
 * everything that needed a moment was handed one by whoever called it.
 * {@code SeasonClock} is written that way on purpose - every one of its
 * questions takes the moment as an argument - so the whole of the league's
 * calendar has been measurable at any date since the day it was written.
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
