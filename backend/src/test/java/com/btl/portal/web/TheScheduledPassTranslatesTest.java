package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.config.ScheduledTaskHolder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.annotation.DirtiesContext;

import java.io.IOException;
import java.io.UncheckedIOException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE TASK THE SCHEDULER HOLDS TRANSLATES, in a context whose translator is switched on and speaks to a server of
 * its own on this machine ({@link ATranslatorOfItsOwn}), so nothing leaves it.
 *
 * <p>Its own class because its own context: every other one is built from the settings every installation reads,
 * which carry no key, and there the task can only be shown to do nothing. Here the runnable is taken out of the
 * scheduler and run, which ties „it is scheduled" to „what is scheduled translates" (the shape of
 * {@code ThePicturesFolderIsSweptTest.theTaskTheSchedulerHoldsDoesTheSweep}).
 *
 * <p><b>The context is closed after the class</b>, and that is not tidiness: left in the cache, its scheduler would
 * run the pass five minutes later, over every description the suite has written by then and against a server that
 * is gone, and stamp rows another case's order is measured by.
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class TheScheduledPassTranslatesTest {

	private static final ATranslatorOfItsOwn SERVICE = started();

	private static ATranslatorOfItsOwn started() {
		try {
			return new ATranslatorOfItsOwn();
		} catch (IOException failed) {
			throw new UncheckedIOException(failed);
		}
	}

	@DynamicPropertySource
	static void aTranslatorThatIsOn(DynamicPropertyRegistry settings) {
		settings.add("btl.translator.key", () -> ATranslatorOfItsOwn.KEY);
		settings.add("btl.translator.region", () -> ATranslatorOfItsOwn.REGION);
		settings.add("btl.translator.address", SERVICE::address);
	}

	@AfterAll
	static void theServiceGoes() {
		SERVICE.close();
	}

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectProvider<ScheduledTaskHolder> schedulers;

	@AfterEach
	void nothingIsLeftBehind() {
		db.sql("delete from text_translation where ducat_id is null").update();
		db.sql("delete from text_translation_asked").update();
		db.sql("delete from btl_event where slug like 'prevod-%'").update();
	}

	@Test
	void theTaskTheSchedulerHoldsTranslatesWhatWaits() throws Exception {
		long mine = db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured,"
						+ " description, link) values ('prevod-zakazan', 'Zakazan', date '2027-05-01',"
						+ " (select id from place where rank = 1), null, null, 'race', false, 'Kroz grad', '')"
						+ " returning id")
				.query(Long.class)
				.single();
		String thePass = TextsAreTranslated.class.getName() + ".pass";

		schedulers.stream()
				.flatMap(each -> each.getScheduledTasks().stream())
				.filter(task -> task.getTask().getRunnable().toString().equals(thePass))
				.findFirst()
				.orElseThrow()
				.getTask()
				.getRunnable()
				.run();

		/* The answer is written by the request's own thread after the pass returns, so it is waited for, and a case
		   that waits too long fails on this assertion and not on a clock. */
		int written = 0;

		for (int tries = 0; tries < 100 && written < 2; tries++) {
			Thread.sleep(50);
			written = db.sql("select count(*) from text_translation where event_id = ?").param(mine)
					.query(Integer.class).single();
		}

		assertThat(SERVICE.textsAsked()).contains("Kroz grad");
		assertThat(written).as("the translations of the description were not written").isEqualTo(2);
	}
}
