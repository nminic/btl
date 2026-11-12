package com.btl.portal.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * EVERY MEMBER'S DUCATS ARE BROUGHT INTO LINE WITH HIS RESULTS ONCE A NIGHT, AND ONCE MORE BEFORE THE FREEZE.
 *
 * <p>Step three of seven of „Dukate dodeljuje verifikacija rezultata”. PDL, owner, 08.11.2026: „Pozadinski
 * posao koji ponovo računa dukate svih članova radi jednom noću (03:00) i još jednom 1. januara u 15:00,
 * pre zamrzavanja; normalan put je računanje odmah posle svakog odobrenja, ispravke ili brisanja." The
 * pass is a net under the normal road, not the road: it writes what a result entered some other way left
 * unwritten and takes away what a deletion left standing.
 *
 * <p><b>WHAT IT WRITES OF THE HISTORY IS SILENT, AND WHAT IT WRITES OF A RESULT APPROVED SINCE THE START OF
 * AWARDING IS TOLD.</b> Owner, 12.11.2026: „Kad dukat koji donese rezultat odobren od sada upiše noćni
 * prolaz (jer je korak posle odobrenja pao), član dobija poruku isto kao da ga je upisao korak posle
 * odobrenja. Tiho ostaje samo ono što dolazi iz rezultata odobrenih pre početka dodele." Which of the two a
 * ducat is, and the message, are {@link AwardingDucats#forMember}'s, in the transaction that writes it, so
 * this class sends nothing of its own and could not tell a ducat differently from the step after an
 * approval. Until 12.11.2026 this said the pass sent nothing at all, the outcome the owner refused that day.
 *
 * <p><b>IT DOES NOT RUN AT START, and that is the decision, not an omission</b> (a technical one, the
 * author's): the jobs beside it ({@link OldPicturesAreCleaned}, {@code ASeasonFreezes}) try at start, and a
 * job that did here would run in the context of every Spring test class, over the one database they share,
 * and write ducats to the members other classes have committed. Both triggers are therefore cron
 * expressions, which Spring never fires before the first matching minute, and the case that asks the
 * scheduler for them also asks that nothing else of this class is scheduled.
 *
 * <p><b>EVERY COMPETITOR, with nothing asked of him</b>: no account is needed (a member who has never signed
 * in has results and ducats), and no membership of the current season (he won what he won in the seasons he
 * was a member, and a ducat of all time stands whether he is one now or not). So the list is the table
 * of competitors and has no join.
 *
 * <p><b>ONE MEMBER THAT FAILS DOES NOT STOP THE REST</b>, the road {@link OldPicturesAreCleaned} takes for a
 * row: the fault is logged under the member's key and the pass goes on. Each member is in a transaction of
 * his own already ({@link AwardingDucats#forMember}), so a failure leaves the others written.
 *
 * <p><b>THE PASS OF 1 JANUARY AT 15:00 SAYS SO WHEN A MEMBER FAILS</b>, and in words that name why: the
 * season freezes at 16:00 ({@code ASeasonFreezes}), and there is no run between the two. Owner's journal,
 * 08.11.2026, derived and not dictated: a ducat of a month or a season of the freezing year can then stay
 * or stay missing against the frozen table, only if the step after the approval also failed, and the
 * freeze does not reconcile ducats. That is the recorded boundary, and the warning is what makes it
 * visible.
 *
 * <p><b>WHAT HOLDS IT.</b> {@code DucatsAreReconciledAtNightTest}.
 */
@Component
class DucatsAreReconciledAtNight {

	private static final Logger LOG = LoggerFactory.getLogger(DucatsAreReconciledAtNight.class);

	private final JdbcClient db;

	private final AwardingDucats ducats;

	DucatsAreReconciledAtNight(JdbcClient db, AwardingDucats ducats) {
		this.db = db;
		this.ducats = ducats;
	}

	/** At 03:00 by the league's clock, every day. */
	@Scheduled(cron = "0 0 3 * * *", zone = "Europe/Belgrade")
	void atNight() {
		reconcileEveryone("it is tried again tonight");
	}

	/** At 15:00 on 1 January, an hour before {@code ASeasonFreezes} freezes the season that has just ended. */
	@Scheduled(cron = "0 0 15 1 1 *", zone = "Europe/Belgrade")
	void beforeTheFreeze() {
		reconcileEveryone("this was the last pass before the season freezes at 16:00, and the freeze does not"
				+ " reconcile ducats");
	}

	private void reconcileEveryone(String whatFollowsAFailure) {
		List<Long> everyone = db.sql("select id from competitor order by id").query(Long.class).list();
		int failed = 0;

		for (long member : everyone) {
			try {
				ducats.forMember(member);
			} catch (RuntimeException fault) {
				failed++;
				LOG.warn("ducats of member {} could not be reconciled, {}: {}", member, whatFollowsAFailure,
						fault.toString());
			}
		}

		LOG.info("ducats of {} members reconciled, {} failed", everyone.size(), failed);
	}
}
