package com.btl.portal.web;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * ONE MEMBER'S FAILURE IS NOT THE NEXT ONE'S, WHATEVER IT IS: {@link DucatsFollowTheResults} logs any
 * {@link RuntimeException} of a member and reconciles the members after him, the road
 * {@code DucatsAreReconciledAtNight} takes. Review of PR 709 (low): until then only a fault of the database
 * or of a transaction was caught, so anything else ended the loop and the members after him were left for
 * the night. Here the first member fails with a plain {@link IllegalStateException}, which is neither.
 */
class DucatsFollowTheResultsOneFailureTest {

	@Test
	void aMemberWhoseReconciliationThrowsAnythingStopsNobodyAndIsLogged() {
		AwardingDucats ducats = mock(AwardingDucats.class);

		when(ducats.forMember(7L)).thenThrow(new IllegalStateException("not a fault of the database"));
		when(ducats.forMember(9L)).thenReturn(List.of());

		Logger logger = (Logger) LoggerFactory.getLogger(DucatsFollowTheResults.class);
		ListAppender<ILoggingEvent> caught = new ListAppender<>();

		caught.start();
		logger.addAppender(caught);

		try {
			new DucatsFollowTheResults(ducats).follow(List.of(9L, 7L));
		}
		finally {
			logger.detachAppender(caught);
		}

		var order = inOrder(ducats);

		order.verify(ducats).forMember(7L);
		order.verify(ducats).forMember(9L);
		assertThat(caught.list).singleElement().satisfies(one -> {
			assertThat(one.getLevel()).isEqualTo(Level.WARN);
			assertThat(one.getFormattedMessage()).contains("member 7");
		});
	}
}
