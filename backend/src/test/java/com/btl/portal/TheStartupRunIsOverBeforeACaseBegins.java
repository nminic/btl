package com.btl.portal;

import org.springframework.context.ApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.test.context.TestContext;
import org.springframework.test.context.support.AbstractTestExecutionListener;

import javax.sql.DataSource;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.WeakHashMap;
import java.util.concurrent.TimeUnit;

/**
 * THE RUN THE SERVER MAKES BY ITSELF AT START IS OVER BEFORE THE FIRST CASE OF A CONTEXT BEGINS, AND NO CLASS
 * LEAVES A FROZEN SEASON BEHIND IT.
 *
 * <p>Registered for every Spring test in {@code META-INF/spring.factories} of the test sources, so it holds
 * the classes that exist and the ones that will, and nothing here is a list of them. It answers two
 * findings of the review of PR 674 (PENDING, „SREDNJI 3 (krug 2), ROK PRE 1.1.2028" and „SREDNJI 4 (krug 2)"),
 * both about {@code ASeasonFreezes}, whose first run is AT START and not an hour after it (PDL, owner,
 * 05.11.2026), so that every context a test class builds runs it once.
 *
 * <p><b>THE RACE.</b> That run is on the scheduler's thread and a case moves the clock on the thread of the
 * test. A run late by a few hundred milliseconds read a clock a case had already moved past 1 January 2028
 * and froze 2027 for real, in the database every later class shares; measured with a delay of 700 ms in
 * {@code freeze()}, two of twelve cases of {@code MeCategoryApiTest} failed. Before a case the scheduler is
 * asked for one more task, and the answer is awaited: Boot builds one scheduler thread, so that task runs
 * after the run at start has finished, and what the run did is visible to the thread of the test, which is
 * the guarantee the clocks of the cases (a field that is not {@code volatile}) were counting on without
 * having it. Registered before the transaction a case runs in begins, so nothing here is rolled back with it.
 *
 * <p><b>THE DATE.</b> From 16:00 on 1 January 2028 by the real clock the run at start freezes 2027 in the
 * database of every context whose clock is the system's, committed, before any case, and a class that
 * expects no freeze fails on it (measured with the clock fixed at 2 January 2028: {@code ASeasonFreezesTest}
 * 6 of 9, {@code TheTablesOfASeasonTest} 16 of 19). The first case of a context finds the database as the run
 * at start left it, and what is in the tables of a frozen season then can only be its doing, since no case
 * has run: they are emptied, and every class begins on the database a month before the date would have
 * given it. The tables are asked of the catalog ({@code season_%}), not named here.
 *
 * <p><b>THE RULE ASeasonFreezes WRITES DOWN AND NOTHING HELD.</b> „A case that moves the clock past it freezes
 * the seasons behind it and must leave the rows it wrote as it found them." After each class the record of
 * the freeze is read, and a class that left a row fails with its own name, instead of the next class in the
 * same context failing on a season it never froze.
 */
public class TheStartupRunIsOverBeforeACaseBegins extends AbstractTestExecutionListener {

	/** The contexts whose tables of a frozen season have been emptied once, by identity. */
	private static final Set<ApplicationContext> EMPTIED = Collections.synchronizedSet(
			Collections.newSetFromMap(new WeakHashMap<>()));

	/** After the dependency injection loaded the context and before the transaction of a case begins. */
	@Override
	public int getOrder() {
		return 3000;
	}

	@Override
	public void beforeTestMethod(TestContext testContext) throws Exception {
		ApplicationContext context = testContext.getApplicationContext();
		ThreadPoolTaskScheduler scheduler = context.getBeanProvider(ThreadPoolTaskScheduler.class).getIfUnique();

		if (scheduler != null) {
			scheduler.submit(() -> {
			}).get(1, TimeUnit.MINUTES);
		}

		DataSource data = context.getBeanProvider(DataSource.class).getIfUnique();

		if (data != null && EMPTIED.add(context)) {
			emptyTheTablesOfAFrozenSeason(new JdbcTemplate(data));
		}
	}

	@Override
	public void afterTestClass(TestContext testContext) {
		if (!testContext.hasApplicationContext()) {
			return;
		}

		DataSource data = testContext.getApplicationContext().getBeanProvider(DataSource.class).getIfUnique();

		if (data == null) {
			return;
		}

		Long left = new JdbcTemplate(data).queryForObject("select count(*) from season_frozen", Long.class);

		if (left != null && left > 0) {
			throw new IllegalStateException(testContext.getTestClass().getName() + " left " + left
					+ " frozen season(s) in the database it shares: a case that freezes must leave the rows as it"
					+ " found them (ASeasonFreezes)");
		}
	}

	private static void emptyTheTablesOfAFrozenSeason(JdbcTemplate db) {
		Long frozen = db.queryForObject("select count(*) from season_frozen", Long.class);

		if (frozen == null || frozen == 0) {
			return;
		}

		List<String> tables = db.queryForList("select table_name from information_schema.tables"
				+ " where table_schema = current_schema() and table_name like 'season\\_%' and table_type = 'BASE TABLE'",
				String.class);

		db.execute("truncate table " + String.join(", ", tables));
	}
}
