package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.category.Category;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.method.HandlerMethod;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** Who runs in the league, and the one thing that must never leave with them. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class CompetitorApiTest {

	/** Named here with the reason, because a lost field and a withheld one look alike. */
	/*
	 * THE YEAR OF BIRTH IS NO LONGER NAMED HERE, because the portal no longer serves it
	 * (B52, 13.09.2026). `Answers` refuses a name the file does not carry, and rightly:
	 * leaving `birthYear` in this list would excuse nothing and quietly stand in for a
	 * field that went missing for some other reason. What the file carries in its place
	 * is the age band, below.
	 *
	 * The claim itself has not gone anywhere. The year cannot leave a server that is
	 * never asked for it, and `noYearOfBirthLeavesTheServer` asks the whole answer as
	 * text rather than by field name.
	 */
	/**
	 * AND THIS ONE IS ANSWERED, SINCE 21.09.2026, WHICH IS WHY IT IS NO LONGER IN THE
	 * LIST BELOW.
	 *
	 * <p><b>It stood there as a DEBT rather than a refusal</b>, worded „served but not
	 * answered yet": the one name in that list that Article 74 makes public („Javna je
	 * samo kategorija koja iz njega proizlazi") rather than keeps off a public answer
	 * for ever. The portal began serving it on 13.09.2026 (B52) and this resource owed
	 * it.
	 *
	 * <p><b>The debt cleared itself exactly as it was written to.</b> {@code Answers}
	 * asserts both halves of a withheld name - that the portal really serves it, and
	 * that the answer really leaves it out - so the four cases that named it began
	 * failing the moment the field was answered, and the name had to come out of all
	 * four. Nothing had to remember it.
	 *
	 * <p>What holds it now is the opposite claim, and it is stronger than a name in a
	 * list: the same four cases require every name the portal serves and is not
	 * withheld to be ANSWERED, so removing the field fails them again from the other
	 * side. The band cannot quietly go away any more than it could quietly stay missing.
	 */
	private static final String THE_AGE_BAND = "ageBand";
	private static final String THE_REFERRAL_CODE = "referralCode";
	private static final String WHO_HANDED_OUT_THE_CODE = "referredBy";
	private static final String HOW_THE_MEMBERSHIP_IS_HELD = "membershipBasis";
	private static final String WHETHER_THE_FEE_IS_STANDING = "active";

	/**
	 * WHAT {@code referredBy} IS ANSWERED AS, once the resource knows who is asking.
	 *
	 * <p>Not the column: PDL, 06.09.2026, „`referredBy` cita ekran Clanarine da
	 * prebroji koga je clan doveo, a to je upit nad SVIMA, ne nad sobom". A count is
	 * that query answered where the data is; the column answered to whoever signs in
	 * would be every member's referrer beside his name, and the referrer is a code.
	 *
	 * <p>It is a name the portal does not serve, so {@code Answers} refuses it unless
	 * it is named as something answered on purpose.
	 */
	private static final String THE_COUNT_SHE_BROUGHT_IN = "referredCount";

	/** Where a member's portrait is asked for, which the served file does not carry yet. */
	private static final String THE_PORTRAIT = "photo";

	/** And which circle of it is drawn, the other half of the same fact. */
	private static final String THE_SQUARE_OF_IT = "crop";

	/**
	 * WHERE A PICTURE IS ASKED FOR, written out here rather than taken from
	 * {@link CompetitorApi}.
	 *
	 * <p>Taken from the constant, a rename would rename both and every case below would go on
	 * passing while the portal asked for an address nothing answers - one value in two roles,
	 * which is the shape that makes right and wrong read alike. What proves the two equal is
	 * {@code thePortraitIsTheAddressOfThatMembersOwnPicture}, which hands the address to the
	 * dispatcher instead of comparing spellings.
	 */
	private static final String A_PICTURE_IS_ASKED_FOR_AT = "/api/photos/";

	/**
	 * THE DIGESTS IN THIS FIXTURE ARE SPELT IN LETTERS ALONE, AND THAT IS A MEASUREMENT.
	 *
	 * <p>A digest is sixty four characters of {@code [0-9a-f]} (V8,
	 * {@code photo_digest_shape}), so one carrying digits may spell a four digit year by
	 * accident - and {@link #noYearOfBirthLeavesTheServer} reads the WHOLE answer as text and
	 * asks it for every year of birth in the database. A digest holding {@code 1991} would
	 * fail that case for a reason that has nothing to do with a date of birth, and whoever
	 * met the failure would be looking for a leak that was not there. Letters cannot spell a
	 * year, so the two cases cannot collide.
	 *
	 * <p>Each pair is a different pair, so no two pictures here share a digest and „this
	 * member's portrait" is never satisfied by another member's.
	 */
	private static String aDigestOf(String pair) {
		return pair.repeat(32);
	}

	/** Her portrait, on a member who is NOT hiding her profile. */
	private static final String HER_PORTRAIT = aDigestOf("ab");

	/** And the portrait of the one member in this fixture who DOES hide his profile. */
	private static final String THE_PORTRAIT_OF_THE_ONE_WHO_HIDES = aDigestOf("cd");

	/** And of the one whose fee has lapsed, who is on no answer this resource gives. */
	private static final String THE_PORTRAIT_OF_THE_ONE_WHO_HAS_NOT_PAID = aDigestOf("ef");

	/**
	 * A PICTURE SHE HAS SENT AND NOBODY HAS DECIDED ON, standing beside the portrait she
	 * already has.
	 *
	 * <p>It is the second source of the value {@code photo} answers: a query joining
	 * {@code verification.photo_id} rather than {@code competitor.photo_id} answers THIS
	 * where her portrait belongs, and no case could tell the two apart if she had only one
	 * picture in the fixture.
	 */
	private static final String THE_PICTURE_SHE_IS_HAVING_MODERATED = aDigestOf("ba");

	/**
	 * AND A PICTURE SENT BY SOMEBODY WHO HAS NO PORTRAIT AT ALL, which is the half the case
	 * above cannot measure.
	 *
	 * <p>With her alone, {@code coalesce(c.photo_id, v.photo_id)} answers her own portrait
	 * and passes. This member has nothing to fall back on, so the same {@code coalesce}
	 * hands out a picture waiting for a moderator - which is what ADL A60 refuses in as many
	 * words.
	 */
	private static final String THE_PICTURE_THE_OTHER_IS_HAVING_MODERATED = aDigestOf("dc");

	/**
	 * AND THE MARKS OF THE TWO TEAMS, so that {@code photo} holds pictures that are not
	 * portraits.
	 *
	 * <p>{@code TeamApi} keeps the mirror of this ({@code
	 * noPartOfAnybodysProfilePictureLeavesWithATeam}); without a mark in the table at all,
	 * „no team's mark leaves with a member" would be a sentence about an empty set.
	 */
	private static final String THE_MARK_OF_ONE_TEAM = aDigestOf("fa");

	private static final String THE_MARK_OF_THE_OTHER_TEAM = aDigestOf("af");

	/** The one asking, and on purpose NOT the first record of the answer. */
	private static final String HER_OWN_ACCOUNT = "milica@primer.rs";

	/** A second member, who brought in nobody and is in no team. */
	private static final String THE_OTHER_MEMBER = "strahinja@primer.rs";

	/**
	 * Signed in, no member behind the account at all, AND A MODERATOR WHO HOLDS
	 * NOTHING OVER THE MEMBERS.
	 *
	 * <p>He is the state of „who is asking" that is easiest to miss and the one the
	 * rule is really about: PDL P8 gives the basis to „Superadmin i moderatori sa
	 * pravom nad clanovima", so a moderator WITHOUT that tick is on the far side of
	 * the line while looking like somebody on the near one. He is deliberately ticked
	 * for something else, so what refuses him is the right this resource asks for and
	 * not the absence of any right at all - {@code AdminRights.mayDoAnything} would
	 * answer yes about him.
	 */
	private static final String RACES_FOR_NOBODY = "moderator@primer.rs";

	/**
	 * AND THE MODERATOR WHO DOES HOLD IT, who is also a member, and whose own
	 * membership is held on a basis the rows he looks at do not all share.
	 *
	 * <p><b>He is 000031, whose fee has lapsed, and that is the point of choosing
	 * him.</b> He is not on the list at all (the resource answers only the members
	 * whose fee is standing), so for HIM „his own row" and „a row he is looking at" are
	 * never the same record - which is what makes the substitution measurable: served
	 * his own basis instead of each row's, every record would read {@code payment} and
	 * 000012 is {@code feeExempt}. Served on the caller's own row the way the referral
	 * code is, he would be answered nothing at all.
	 *
	 * <p><b>That is one state of „whose row is this" and not the whole axis, which is
	 * the finding of 21.09.2026 and why the account below exists.</b> Read as a property
	 * of the administration rather than of this one account, the sentence above excused
	 * a resource that answers everybody but the caller: the caller's own row is the one
	 * row no case here was looking at.
	 */
	private static final String THE_MODERATOR_OVER_THE_MEMBERS = "clanovi@primer.rs";

	/**
	 * AND THE SECOND STATE OF „WHOSE ROW IS THIS", WHICH THE TWO ABOVE DO NOT CARRY.
	 *
	 * <p><b>He holds the same right and he IS on the list, which is the half that was
	 * missing until 21.09.2026.</b> The moderator above has a member whose fee has
	 * lapsed and the superadmin has no member at all, so „the administration looks at
	 * its own row" did not happen in any case of this class - and two of them are about
	 * the word „every". Measured then: a condition that cut the caller's own row out of
	 * the basis (`c.id is distinct from :me`) left all 21 cases green, while a moderator
	 * over the members who races would have seen his own row, and his alone, without the
	 * basis on it.
	 *
	 * <p>He is 000023, whose number sorts third of the four on the list, so „his own
	 * row" is neither the first record nor the last. His basis is {@code feeExempt},
	 * which two of the three rows he looks at do NOT share, so serving him his own basis
	 * across the answer changes two records rather than none; and his own referral count
	 * is nought while 000012's is one, so a count arriving from the wrong row is a
	 * different number.
	 */
	private static final String THE_ADMINISTRATOR_ON_THE_LIST = "clanovi-i-trci@primer.rs";

	/** And the other half of „Superadmin i moderatori sa pravom", who races for nobody. */
	private static final String THE_SUPERADMIN = "superadmin@primer.rs";

	/**
	 * THE SIX STATES OF „WHO IS ASKING", SPLIT BY THE ONE LINE PDL P8 DRAWS.
	 *
	 * <p>Written out rather than derived, because what each account IS is the thing the
	 * fixture decides and nothing can read back. What IS derived is that the split is
	 * complete: {@code everyAccountInTheFixtureIsOnOneSideOfTheLineOrTheOther} reads
	 * every address out of {@code account} and requires these two lists to be exactly
	 * that set, so a seventh account added tomorrow has to be put on a side rather than
	 * quietly measured by nothing. The visitor is the {@code null} below, which is the
	 * same request without the cookie and is not an account.
	 */
	private static final List<String> NOBODY_WHO_MAY_READ_THE_BASIS =
			java.util.Arrays.asList(null, HER_OWN_ACCOUNT, THE_OTHER_MEMBER, RACES_FOR_NOBODY);

	/**
	 * And the PDL P8 names, „Superadmin i moderatori sa pravom nad clanovima".
	 *
	 * <p><b>Three and not two, because „whose row is this" has two states and the
	 * administration must stand on both.</b> One of them looks at his own row (000023),
	 * one has a member who is off the list because his fee has lapsed (000031), and one
	 * has no member at all (V23's ordinary case). A list of the first two only is a list
	 * on which the word „every" is never asked about the caller himself.
	 */
	private static final List<String> THE_ADMINISTRATION = List.of(
			THE_MODERATOR_OVER_THE_MEMBERS, THE_ADMINISTRATOR_ON_THE_LIST, THE_SUPERADMIN);

	private final Map<String, SecretToken> sessions = new HashMap<>();

	/**
	 * AUTUMN 2026, WHICH IS A DAY WITH NO SEASON RUNNING AT ALL, and that is why the
	 * cases stand on it by default.
	 *
	 * <p>The league begins in 2027 (PDL P2), so the calendar answer on this day names a
	 * season the portal does not have. Every band in this file is therefore answered
	 * through the floor rather than around it, and a server that dropped the floor would
	 * fail the ordinary cases rather than only the one written about it.
	 */
	private static final Instant AUTUMN_2026 = Instant.parse("2026-09-21T10:00:00Z");

	/** The first season the league has, while it is running. */
	private static final Instant DURING_2027 = Instant.parse("2027-06-15T12:00:00Z");

	/**
	 * AND THE NEXT ONE, HALF AN HOUR PAST MIDNIGHT IN BELGRADE AND HALF AN HOUR BEFORE
	 * IT IN UTC, which is the half of „the season that is running" that moves.
	 *
	 * <p><b>It is the boundary rather than a day in June, and that is the second thing
	 * it measures.</b> {@code ResultApiTest.NEW_YEARS_NIGHT} is the same instant for the
	 * same reason: the clock this fixture hands the server reports {@link ZoneOffset#UTC},
	 * as a container's does, so a resource that reads the server's own zone instead of the
	 * league's calls this night 2027 while Belgrade is already in 2028.
	 *
	 * <p><b>It was a day in June until 21.09.2026 and the zone was not measured at all</b>:
	 * review dropped {@code clock.withZone(SeasonClock.ZONE)} from
	 * {@code CompetitorApi.theBandsSeason} and all thirty cases stayed green. The sentence
	 * on {@link AClockTheCaseMoves} had been copied from {@code ResultApiTest} without the
	 * moment that makes it true. {@code theBandMovesWithTheSeasonThatIsRunning} now stands
	 * here and asks the clock itself whether the two zones still disagree.
	 */
	private static final Instant NEW_YEARS_NIGHT_INTO_2028 =
			Instant.parse("2027-12-31T23:30:00Z");

	/**
	 * MID OCTOBER OF 2027, the one kind of moment where „which season" has two answers.
	 *
	 * <p>From 1 October the transfer window is open and {@code seasonBeingPaidFor}
	 * answers with NEXT year while the season being RUN is still this one. The other
	 * three moments above lie outside that window, where the two agree, so a case that
	 * wants to tell them apart has to stand here. Its own floor asks
	 * {@link SeasonClock} whether they still disagree at this instant rather than
	 * remembering that they once did.
	 */
	private static final Instant MID_OCTOBER_2027 = Instant.parse("2027-10-15T12:00:00Z");

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	/**
	 * And it stands where no season is running, so the floor is load bearing in every
	 * case rather than in one.
	 */
	@BeforeEach
	void theClockStandsInTheAutumnOf2026() {
		clock.moveTo(AUTUMN_2026);
	}

	/**
	 * Five members, four of them on the list, and no two alike in what the answer
	 * carries.
	 *
	 * <p>Three take their town from the codebook, each a different one, and one has it
	 * typed, which are the two shapes V7 allows. One is in a team and three are not, two
	 * were brought in by another and three were not, one hides his profile, and all three
	 * answers the birthday question allows are in the list. A field that is the same in
	 * every record is a field the server could answer with a constant, and `Answers`
	 * refuses that.
	 *
	 * <p><b>AND NO TWO OF THEM SHARE AN ORDER OR A FLAG</b>, because a fixture where
	 * two behaviours give the same list measures neither of them. Every axis below is
	 * separated on purpose and each line says which wrong answer it refuses:
	 *
	 * <ul>
	 * <li><b>The order.</b> They are written 000012, 000045, 000007, 000023, so the row
	 * order is not the number order and neither is its reverse. Surname, given name, day
	 * of birth, first season and referral code each sort them differently again, so
	 * ordering by any of those is a different list.</li>
	 * <li><b>The three flags on the row.</b> Hidden is 000007, not active is 000031,
	 * first season 2027 is 000045. Each is exactly one member and never the same one,
	 * so answering with the wrong column answers with the wrong member.</li>
	 * <li><b>The team.</b> The member in a team is 000012, who is neither the hidden
	 * one nor the inactive one. He ran for one team in 2027, left it, and joined the
	 * other in 2028, and 000007 left a team in 2027 and is in none now. So dropping
	 * the condition that the membership has not ended does two visible things at once:
	 * it gives 000007 a team he left, and it gives 000012 a second row.</li>
	 * <li><b>The season the membership started in</b> is 2028, which is neither the
	 * season the team started in (2027) nor either end of the membership he left.</li>
	 * <li><b>Who brought whom in, on BOTH sides of „whose fee is standing".</b> 000012
	 * brought in two people and they are 000007, who is on the list, and 000031, whose
	 * fee has lapsed and who is not. So the count this resource answers him with is
	 * ONE, and every wrong way of arriving at it is a different number: counting
	 * everybody gives five, counting the members whose fee stands gives four,
	 * counting everybody with a referrer at all gives two, and counting nothing gives
	 * nought. 000045 and 000023 brought in nobody, so the same field asked of either is
	 * nought and a constant cannot answer both.</li>
	 * <li><b>Whose row the caller is looking at.</b> 000023 is the member behind an
	 * account that may read the basis, and his number sorts third of the four on the
	 * list, so „the administration's own row" is a record in the middle of the answer
	 * rather than an absence. 000031 is the member behind the other such account and he
	 * is off the list, and the superadmin has no member at all. Written the other way
	 * round - every administration account off the list - a resource that answers
	 * everybody EXCEPT the caller passes every case here, which is what it did until
	 * 21.09.2026.</li>
	 * </ul>
	 *
	 * <p>What is deliberately NOT separated: sex lines up with the inactive member, and
	 * two members answer the birthday question the same way. Neither is a substitution a
	 * wrong query could make, and five members cannot keep every set of them distinct at
	 * once.
	 */
	@BeforeEach
	void fiveMembers() {
		member("000012", "Milica", "Djurisic", "F", "1968-03-11",
				"(select id from place where rank = 1)", "null", "null",
				2014, false, true, "feeExempt", "Trcim od 2014.", "0a2b4c6d8e0f1102", "null",
				false, "none");
		member("000045", "Strahinja", "Vukicevic", "M", "2007-01-30",
				"(select id from place where rank = 2)", "null", "null",
				2027, true, true, "payment", "Prva sezona.", "5f4e3d2c1b0a9903", "null",
				false, "full");
		member("000007", "Milos", "Pavlovic", "M", "1991-07-02",
				"null", "'Krusevac'", "(select id from country where code = 'RS')",
				2020, false, true, "payment", "", "b7f3a1c2d4e50601",
				"(select id from competitor where member_number = '000012')", true, "year");

		/* AND THE ONE WHOSE ACCOUNT MAY READ THE BASIS AND WHOSE ROW IS ON THE LIST,
		   which is the state the other two administration accounts cannot carry: one has
		   a member whose fee has lapsed and the other has no member at all.

		   HIS NUMBER SORTS THIRD OF THE FOUR, so „his own row" is neither the first
		   record nor the last, the same care 000012 is placed with. He is in no team and
		   he is not hidden, so he adds no second member to either of those two axes; he
		   brought in nobody, so his own count is nought while 000012's is one. His basis
		   is `feeExempt`, which the two members who pay do not share, so his own basis
		   written across the answer changes two records. */
		member("000023", "Jovana", "Markovic", "F", "1985-11-24",
				"(select id from place where rank = 3)", "null", "null",
				2019, false, true, "feeExempt", "Moderiram i trcim.", "e5d4c3b2a1908805", "null",
				false, "full");

		/* AND THE FOURTH, WHOSE FEE HAS LAPSED. His number sorts BETWEEN two of the
		   three, so a list that lets him through is wrong in its order as well as in
		   its length, and everything else about him is ordinary: he is not hidden, he
		   is in no team, and he pays like two of the others. The only thing that keeps
		   him out is the one thing being measured. */
		/* AND 000012 BROUGHT HIM IN TOO, which is the second half of the referral
		   count: one of the two he brought is on the list and one is not, so the
		   count and the length of the list are different numbers. */
		member("000031", "Nenad", "Ilic", "M", "1979-05-20",
				"(select id from place where rank = 1)", "null", "null",
				2015, false, false, "payment", "Pauziram.", "c3d2e1f0a9b87704",
				"(select id from competitor where member_number = '000012')",
				false, "none");

		/* AND SEVEN PICTURES, of which THREE are portraits, TWO are waiting for a moderator
		   and TWO are teams' marks. Written before they are given to anybody, because a
		   picture is a row of its own (V8) and `competitor.photo_id` points at one.

		   WHY SEVEN AND NOT TWO. Every axis this file measures about a portrait is an axis
		   about which ROW was read, and a fixture with one portrait in it answers „the only
		   picture there is" to every wrong query there is. Three portraits means no member is
		   the only one of his kind; two waiting pictures mean „approved" and „waiting" are
		   separated on a member who has both AND on a member who has only the second; two
		   marks mean `photo` holds pictures that are not portraits at all.

		   THE FRACTIONS ARE DIFFERENT ON EVERY ROW, so a square read off the wrong picture is
		   visible, and so `noFieldOfTheAnswerIsTheSameInEveryRecord` measures the square
		   rather than a constant. Nothing here writes them into a case: a case that wants a
		   square reads it back out of `photo` by digest, which is the same discipline
		   `PhotoApiTest` keeps about a media type. */
		aPicture(HER_PORTRAIT, "0.25", "0.75", "0.40");
		aPicture(THE_PORTRAIT_OF_THE_ONE_WHO_HIDES, "0.10", "0.20", "0.30");
		aPicture(THE_PORTRAIT_OF_THE_ONE_WHO_HAS_NOT_PAID, "0.60", "0.15", "0.55");
		aPicture(THE_PICTURE_SHE_IS_HAVING_MODERATED, "0.05", "0.95", "0.85");
		aPicture(THE_PICTURE_THE_OTHER_IS_HAVING_MODERATED, "0.45", "0.35", "0.65");
		aPicture(THE_MARK_OF_ONE_TEAM, "0.50", "0.50", "1.00");
		aPicture(THE_MARK_OF_THE_OTHER_TEAM, "0.33", "0.66", "0.99");

		/* AND THE THREE PORTRAITS GO TO THREE MEMBERS WHO DIFFER IN THE ONE THING BEING
		   MEASURED: 000012 is on the list and does not hide, 000007 is on the list and DOES
		   hide, 000031 is off the list because his fee has lapsed. 000023 and 000045 have no
		   portrait at all, which is the other half of the first axis.

		   000012 IS NOT THE FIRST RECORD, which the list order makes so (000007, 000012,
		   000023, 000045): „her portrait" and „the first portrait" are two different places. */
		hisPortraitIs("000012", HER_PORTRAIT);
		hisPortraitIs("000007", THE_PORTRAIT_OF_THE_ONE_WHO_HIDES);
		hisPortraitIs("000031", THE_PORTRAIT_OF_THE_ONE_WHO_HAS_NOT_PAID);

		/* AND TWO PICTURES ARE WAITING: one beside a portrait that already stands, one with
		   nothing behind it. The note on each digest says which query each of them catches. */
		isHavingModerated("000012", THE_PICTURE_SHE_IS_HAVING_MODERATED);
		isHavingModerated("000023", THE_PICTURE_THE_OTHER_IS_HAVING_MODERATED);

		team("probni-tim", "Probni tim", "000012", THE_MARK_OF_ONE_TEAM);
		team("drugi-tim", "Drugi tim", "000045", THE_MARK_OF_THE_OTHER_TEAM);

		membership("000012", "drugi-tim", 2027, "2027", "'Presao u drugi tim'");
		membership("000012", "probni-tim", 2028, "null", "null");
		membership("000007", "probni-tim", 2027, "2027", "'Prestao da trci za tim'");

		/* AND SIX WAYS OF ASKING, because the answer now depends on who asks. 000012 is
		   deliberately NOT the first record - the list comes back 000007, 000012, 000023,
		   000045 - so „his own row" and „the first row" are two different places and a
		   resource that answered the first would be caught. The same care is taken with
		   000023, the administration's own row, which is third of the four. */
		account(HER_OWN_ACCOUNT, "competitor");
		belongsTo(HER_OWN_ACCOUNT, "000012");
		account(THE_OTHER_MEMBER, "competitor");
		belongsTo(THE_OTHER_MEMBER, "000045");
		/* Signed in and racing for nobody: V23 leaves `account.competitor_id` empty for
		   an account that does not race, which is the ordinary case for a moderator
		   (owner, 14.09.2026). He is the case that separates „signed in" from „is a
		   member". */
		account(RACES_FOR_NOBODY, "moderator");
		/* AND HE HOLDS A RIGHT, just not this one, so what refuses him is the right this
		   resource asks for rather than his holding nothing at all. */
		ticked(RACES_FOR_NOBODY, "entity:events");

		/* AND THOSE WHO MAY, which is the whole of PDL P8's „Superadmin i moderatori
		   sa pravom nad clanovima" and no third KIND - but three STATES of „whose row is
		   this", because that is the axis this field is answered along.

		   The superadmin races for nobody: the ordinary case V23 describes, and the one
		   that catches a condition written against the caller's MEMBER, since with no
		   member at all he would be answered nothing. The moderator below is a member
		   whose fee has lapsed, so a resource serving him his own basis instead of each
		   row's has something wrong to serve. And the third, further down, IS on the
		   list, which is the only state in which „every record" includes the caller's
		   own - the state that was missing until 21.09.2026. */
		account(THE_MODERATOR_OVER_THE_MEMBERS, "moderator");
		/* THE BOX IS TICKED WITH THE WORD V5 WRITES AND NOT WITH THE CONSTANT THE
		   RESOURCE ASKS BY, and that is the difference between measuring two things and
		   measuring one twice. Taken from `CompetitorApi.OVER_THE_MEMBERS`, a misspelt
		   constant would tick the misspelt box and this moderator would be answered
		   exactly the same either way - one value in two roles, so right and wrong give
		   the same list. Written out, the two are independent: a constant that drifts
		   leaves this tick where it is, the moderator is refused and the SUPERADMIN is
		   let through, and that is the leak `RightIsNeeded` describes.

		   Measured, rather than argued: with the two tied together, misspelling the
		   constant was caught by `account_admin_right_right_fk` refusing the fixture, so
		   all 21 cases errored before one of them ran. Written apart, the same mutation
		   is caught by two cases asserting behaviour. Its own floor is that same foreign
		   key, which refuses a word `admin_right` does not hold. */
		ticked(THE_MODERATOR_OVER_THE_MEMBERS, "entity:members");
		belongsTo(THE_MODERATOR_OVER_THE_MEMBERS, "000031");

		/* AND THE SAME RIGHT HELD BY SOMEBODY WHOSE ROW IS ON THE LIST. The box is ticked
		   with V5's own word for the reason written above it, and he is a separate ACCOUNT
		   rather than a second address on 000031, because `account_competitor_unique`
		   allows a member exactly one. */
		account(THE_ADMINISTRATOR_ON_THE_LIST, "moderator");
		ticked(THE_ADMINISTRATOR_ON_THE_LIST, "entity:members");
		belongsTo(THE_ADMINISTRATOR_ON_THE_LIST, "000023");

		account(THE_SUPERADMIN, "superadmin");
	}

	/** One box of the matrix, ticked for one named account (V18). */
	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	private void account(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Ime', 'Prezime', ?, (select id from role where code = ?))")
				.params(email, role).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	/** The link V23 wrote down: this account IS that member. */
	private void belongsTo(String email, String memberNumber) {
		db.sql("update account set competitor_id = (select id from competitor where member_number = ?)"
				+ " where email = ?").params(memberNumber, email).update();
	}

	private void member(String number, String first, String last, String gender, String born,
			String place, String city, String country, int firstSeason, boolean firstSeason2027,
			boolean active, String basis, String bio, String referralCode, String broughtBy,
			boolean hidden, String birthdayShown) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, ?, date '" + born + "', " + place + ", " + city + ", "
						+ country + ", ?, ?, ?, ?, ?, " + broughtBy + ", ?, ?, ?, 'Otac', 'Ulica 1',"
						+ " 'M', timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, gender, firstSeason, firstSeason2027, active, basis,
						referralCode, bio, hidden, birthdayShown)
				.update();
	}

	/** Both teams start in 2027, so the season a membership starts in is never the team's. */
	private void team(String slug, String name, String adminNumber, String mark) {
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, first_season,"
						+ " admin_id, logo_id) values (?, ?, '', '',"
						+ " (select id from place where rank = 1), null, null, 2027,"
						+ " (select id from competitor where member_number = ?), ?)")
				.params(slug, name, adminNumber, pictures.get(mark)).update();
	}

	/** The key the sequence handed each picture, which is what a holder points at. */
	private final Map<String, Long> pictures = new HashMap<>();

	/**
	 * ONE ROW IN {@code photo}, held by nobody until somebody is given it.
	 *
	 * <p>The fractions arrive as text and become {@code BigDecimal}, never a double: V21 made
	 * the three columns {@code numeric(9, 8)} because the rule is about the exact boundaries 0
	 * and 1, and a binary fraction cannot be trusted at one.
	 */
	private void aPicture(String digest, String x, String y, String size) {
		pictures.put(digest, db
				.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values ('image/png', 1024, ?, ?, ?, ?) returning id")
				.params(digest, new BigDecimal(x), new BigDecimal(y), new BigDecimal(size))
				.query(Long.class).single());
	}

	/** The picture a moderator has APPROVED, which is the column this resource reads. */
	private void hisPortraitIs(String memberNumber, String digest) {
		db.sql("update competitor set photo_id = ? where member_number = ?")
				.params(pictures.get(digest), memberNumber).update();
	}

	/**
	 * AND A PICTURE HE HAS SENT THAT NOBODY HAS DECIDED ON, which is the column this resource
	 * must never read.
	 *
	 * <p>{@code state} is written out rather than defaulted because it is the half that
	 * carries the meaning: V9's {@code verification_decided_keeps_no_photo} refuses a decided
	 * row that still holds a photograph, so {@code waiting} is the only state such a picture
	 * could be in. The queue is {@code profiles} and the subject is the member's own name,
	 * which is what {@code MePhotoApi} writes when a member really sends one.
	 */
	private void isHavingModerated(String memberNumber, String digest) {
		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id, state)"
						+ " select 'profiles', c.id, c.first_name || ' ' || c.last_name, '', ?,"
						+ " 'waiting' from competitor c where c.member_number = ?")
				.params(pictures.get(digest), memberNumber).update();
	}

	private void membership(String number, String slug, int from, String to, String leftReason) {
		db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to,"
						+ " left_reason) values ((select id from competitor where member_number = ?),"
						+ " (select id from team where slug = ?), ?, " + to + ", " + leftReason + ")")
				.params(number, slug, from).update();
	}

	private JsonNode answer() throws Exception {
		return new ObjectMapper().readTree(
				http.perform(get("/api/competitors")).andReturn().getResponse().getContentAsString());
	}

	/** @param email null for the visitor, which is the same request without the cookie */
	private MockHttpServletRequestBuilder asking(String email) {
		MockHttpServletRequestBuilder asks = get("/api/competitors");
		return email == null ? asks
				: asks.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
	}

	private String whole(String email) throws Exception {
		return http.perform(asking(email)).andReturn().getResponse()
				.getContentAsString(StandardCharsets.UTF_8);
	}

	private JsonNode answerFor(String email) throws Exception {
		return new ObjectMapper().readTree(whole(email));
	}

	/** The one record of the answer that is about this member, for a field of his own. */
	private JsonNode recordOf(String email, String memberNumber) throws Exception {
		return StreamSupport.stream(answerFor(email).spliterator(), false)
				.filter(one -> one.path("memberNumber").asString().equals(memberNumber))
				.findFirst().orElseThrow();
	}

	/**
	 * EVERY FIELD THE PORTAL READS IS ANSWERED, EXCEPT THE FOUR THAT ARE NOT ITS
	 * BUSINESS, and those are named here with the reason.
	 *
	 * <p><b>These four are the whole reason this resource exists.</b> PDL, 06.09.2026,
	 * measured and named exactly them as the fields that cannot leave the public file
	 * „dok portal nema bekend", because one file was serving the public side, the
	 * member's own screens and the administration at once. This is that backend.
	 *
	 * <ul>
	 * <li><b>How the membership is held</b>: Article 74 goes on „Isto vazi za adresu
	 * elektronske poste, adresu, sve u vezi sa clanarinom i privatne poruke", and the
	 * basis says who is exempt from paying. The year of birth stood beside it here until
	 * 13.09.2026, when the portal stopped serving it at all (B52); the constant at the
	 * head of this class says what happened to it.</li>
	 * <li><b>The age band is NOT one of them any more</b>, and it was the odd one out
	 * while it was: named here as owed rather than withheld. It is answered since
	 * 21.09.2026, so it left this list the only way it could - by failing it. See the
	 * constant that names it.</li>
	 * <li><b>The referral code</b> and <b>who handed it out</b>: Article 73 lists what
	 * is public and neither is on it. The second one hides behind its name: the portal
	 * reads `referredBy` as the CODE, not as a member number, so answering with either
	 * is wrong in its own way.</li>
	 * </ul>
	 *
	 * <p>`Answers` checks each name against the file the portal serves, so a name left
	 * here after the portal stopped serving it cannot quietly excuse a field that went
	 * missing for another reason, and it checks the answer really does leave them out.
	 *
	 * <p><b>AND TWO NAMES GO THE OTHER WAY, which is the half added on 13.09.2026:</b> the
	 * portrait and its square are answered although {@code competitors.json} carries neither,
	 * because the portal's own type has no field for a picture yet (PDL P28c, 26.09.2026, the
	 * second of the four pieces of work it names; the type is the third and is somebody
	 * else's increment). Named here rather than left silent, for the reason `Answers` writes
	 * out: a field added on purpose and a field that leaked look alike from here. The floor
	 * cuts both ways, so the day the served file grows a {@code photo} this line fails and has
	 * to be taken out.
	 *
	 * <p><b>They are read off the FIRST record, which is 000007 - the member who hides his
	 * profile.</b> That is what makes the shape matter rather than the value: both keys are
	 * answered with JSON null to a visitor and the names are still there, which is exactly the
	 * sentence {@link #aHiddenProfilesPortraitDoesNotLeaveToAVisitor} is about. Answered as
	 * ABSENT keys instead, this case would fail - and a reader would be told a field was
	 * missing when what is missing is a picture.
	 */
	@Test
	void everyFieldThePortalReadsIsOneTheServerAnswersWith() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered("/api/competitors", answer(), "competitors.json",
				Set.of(THE_PORTRAIT, THE_SQUARE_OF_IT),
				THE_REFERRAL_CODE, WHO_HANDED_OUT_THE_CODE,
				HOW_THE_MEMBERSHIP_IS_HELD, WHETHER_THE_FEE_IS_STANDING);
	}

	/**
	 * AND NOTHING IN THE ANSWER IS A REFERRAL CODE, whatever it is called.
	 *
	 * <p>Asked of the whole answer as TEXT and not of a field name, for the same reason
	 * the year of birth is: the review that found this measured that swapping the member
	 * number for the code under the name `referredBy` passed the whole suite, because the
	 * omission was guarded by that name alone. A code is sixteen hexadecimal characters
	 * and every member in the fixture carries a different one.
	 */
	@Test
	void noReferralCodeLeavesTheServer() throws Exception {
		String whole = http.perform(get("/api/competitors")).andReturn().getResponse()
				.getContentAsString();

		assertThat(whole).as("the answer carries nothing at all, so it says nothing about what it"
				+ " leaves out").contains("000007", "000012", "000045");

		List<String> codes = db.sql("select referral_code from competitor").query(String.class).list();
		assertThat(codes).as("no code was read out of the database, so the loop below asserts nothing")
				.hasSize(5);

		for (String code : codes) {
			assertThat(whole).as("a referral code (%s) left the server, which Clan 73 does not make"
					+ " public: it is the member's to hand out, not the portal's to publish", code)
					.doesNotContain(code);
		}
	}

	/**
	 * AND NOTHING IN THE ANSWER SAYS WHO PAYS AND WHO DOES NOT, TO ANYBODY BUT THE
	 * ADMINISTRATION.
	 *
	 * <p>PDL P8, 28.07.2026: „Osnov clanstva se nikad ne prikazuje javno. Ni na
	 * profilu, ni u tabelama, nigde. Vide ga samo Superadmin i moderatori sa pravom nad
	 * clanovima." Sharpened on 20.09.2026: „Clan vidi SVOJ osnov clanstva; tudji ne vidi
	 * niko osim administracije" - and his own arrives through {@code /api/me}, not here,
	 * for the reason written on {@link CompetitorApi}.
	 *
	 * <p><b>Three callers and not one, because „javno" is not „bez prijave".</b> The
	 * visitor, the member (whose OWN record is in this answer, so this is the sharpened
	 * half as well), and a signed in moderator who holds a right but not this one. The
	 * third is the state that is easiest to write as covered and hardest to cover: he
	 * reaches every line of this resource that the administration reaches, and only the
	 * answer to „may he" differs.
	 *
	 * <p>Asked of the text and not of a field name, because the basis is a short word
	 * that could arrive under any name at all.
	 *
	 * <p><b>The words are read off the schema, not written here.</b> Which words exist
	 * is a CHECK on the column, so the day a third basis is added the rule grows and this
	 * case grows with it. A list written by hand would have stayed two words long and
	 * said nothing about the third.
	 *
	 * <p><b>The boundary, measured and written down rather than left to a review:</b> it
	 * refuses the WORDS. It does not refuse the same fact answered as a boolean under a
	 * neutral name, because a boolean carries no word to look for. What refuses that is
	 * `Answers`: a name the portal does not read cannot be in the answer at all, whatever
	 * type it carries.
	 */
	@Test
	void nothingAboutTheMembershipFeeLeavesTheServer() throws Exception {
		String rule = db.sql("select pg_get_constraintdef(oid) from pg_constraint"
						+ " where conname = ?").param("competitor_membership_basis_known")
				.query(String.class).single();
		List<String> everyBasis = Pattern.compile("'([a-zA-Z]+)'").matcher(rule).results()
				.map(one -> one.group(1)).toList();
		assertThat(everyBasis).as("the schema named no basis at all, so the loops below assert"
				+ " nothing; the rule it read was: %s", rule).hasSizeGreaterThan(1);

		for (String nobody : NOBODY_WHO_MAY_READ_THE_BASIS) {
			String whole = whole(nobody);

			assertThat(whole).as("the answer to %s carries nothing at all, so it says nothing"
					+ " about what it leaves out", nobody)
					.contains("000007", "000012", "000045");

			for (String basis : everyBasis) {
				assertThat(whole).as("the basis a membership is held on (%s) left the server to"
						+ " %s, who is not the administration; Clan 74 puts everything to do with"
						+ " the fee beside the date of birth, and PDL P8 names the two who may"
						+ " read it", basis, nobody)
						.doesNotContain(basis);
			}
		}
	}

	/**
	 * AND A MEMBER WHOSE FEE HAS LAPSED IS NOT ON THE LIST AT ALL.
	 *
	 * <p>PDL P11: „Status clanarine se ne prikazuje na profilu. Prisustvo clana na sajtu
	 * u tekucoj godini samo po sebi znaci da je clanarina aktivna; ko nije platio, ne vidi
	 * se nigde osim u istorijskim godinama." Asked on 13.09.2026 which of the two shapes
	 * that takes on the server, the owner chose this one over serving the flag: off the
	 * list, rather than on it with the flag withheld.
	 *
	 * <p>His number sorts BETWEEN two of the three who are on it, so letting him through
	 * is wrong in the order as well as in the length, and two cases go red instead of one.
	 * Nothing else about him is unusual: not hidden, in no team, paying like two others.
	 */
	@Test
	void aMemberWhoseFeeHasLapsedIsNotOnTheList() throws Exception {
		assertThat(db.sql("select count(*) from competitor where not active")
				.query(Integer.class).single())
				.as("the fixture has nobody whose fee has lapsed, so this case asserts nothing")
				.isEqualTo(1);

		assertThat(StreamSupport.stream(answer().spliterator(), false)
				.map(one -> one.path("memberNumber").asString()).toList())
				.as("a member whose fee has lapsed came back on the public list of members")
				.doesNotContain("000031");
	}

	@Test
	void noFieldOfTheAnswerIsTheSameInEveryRecord() throws Exception {
		Answers.noFieldIsTheSameInEveryRecord("/api/competitors", answer());
	}

	/**
	 * AND NOTHING IN THE ANSWER IS A DATE OF BIRTH, in any spelling.
	 *
	 * <p>This is the case the resource exists for and the reason it was written before
	 * the easier ones. The portal served the year for all thirty two members until
	 * 13.09.2026, when B52 took it out of the file and put the age band there instead,
	 * ahead of the policy taking effect on 15.09.2026. That closed the public file; this
	 * closes the server, and the two are separate doors onto the same fact.
	 *
	 * <p>Asked of the whole answer as TEXT rather than of a field name, because a year
	 * is a year whatever it is called: a field renamed to `born`, or a year folded into
	 * the biography, would walk past a check that only reads names. The three years in
	 * the fixture are far apart and none of them is also a season in it, so finding one
	 * is finding a date of birth and not something else.
	 *
	 * <p><b>The boundary, written here rather than left for somebody to find:</b> this
	 * refuses the four digit year and the whole date. It does NOT refuse the age as a
	 * number, nor a two digit year, both of which name the year of birth to within a
	 * year. The next increment answers with the age CATEGORY, which is a band of fifteen
	 * years and is what Article 74 makes public in the same sentence; the difference
	 * between that band and an age is one character in a query, so whoever writes it
	 * must say which of the two they are writing.
	 */
	@Test
	void noYearOfBirthLeavesTheServer() throws Exception {
		String whole = http.perform(get("/api/competitors")).andReturn().getResponse()
				.getContentAsString();

		assertThat(whole)
				.as("the answer carries nothing at all, so it says nothing about what it leaves out")
				.contains("000007", "000012", "000045");

		/* Read out of the database rather than written here, so that a member added to the
		   fixture tomorrow is measured without anybody remembering to add their year. */
		List<String> years = db.sql("select distinct to_char(birth_date, 'YYYY') from competitor")
				.query(String.class).list();
		List<String> days = db.sql("select distinct to_char(birth_date, '-MM-DD') from competitor")
				.query(String.class).list();
		assertThat(years).as("no year was read out of the database, so the loops below assert"
				+ " nothing").hasSize(5);
		assertThat(days).as("no day was read out of the database").hasSize(5);

		for (String year : years) {
			assertThat(whole)
					.as("a year of birth (%s) left the server, which Clan 74 and the privacy policy"
							+ " both forbid in full and in short", year)
					.doesNotContain(year);
		}

		for (String day : days) {
			assertThat(whole).as("a whole date of birth (%s) left the server", day)
					.doesNotContain(day);
		}
	}

	/** In member number order, which is the one order a member is spoken of in. */
	@Test
	void theListComesBackInMemberNumberOrder() throws Exception {
		assertThat(StreamSupport.stream(answer().spliterator(), false)
				.map(one -> one.path("memberNumber").asString()).toList())
				.as("the members came back in some order other than by their number")
				.containsExactly("000007", "000012", "000023", "000045");
	}

	/**
	 * A MEMBER WHO HIDES HIS PROFILE IS STILL ON THE LIST, because the list is not the
	 * page.
	 *
	 * <p>PDL P23 hides the profile PAGE from a visitor who is not signed in. The member
	 * number, the name and the standing stay public (Article 73), and the portal needs
	 * the flag in order to know what to draw. Taking him off here would empty a league
	 * table instead of hiding a page.
	 */
	@Test
	void hidingAProfileDoesNotTakeTheMemberOffTheList() throws Exception {
		assertThat(StreamSupport.stream(answer().spliterator(), false)
				.filter(one -> one.path("profileHidden").asBoolean())
				.map(one -> one.path("memberNumber").asString()).toList())
				.as("the member who hides his profile fell off the list of members")
				.containsExactly("000007");
	}

	/** The square a picture's own row carries, read back rather than written into a case. */
	private List<BigDecimal> theSquareOf(String digest) {
		return db.sql("select crop_x, crop_y, crop_diameter from photo where digest = ?")
				.param(digest)
				.query((row, one) -> List.of(row.getBigDecimal(1), row.getBigDecimal(2),
						row.getBigDecimal(3)))
				.single();
	}

	/** The three fractions of one record's square, in the order the answer carries them. */
	private static List<BigDecimal> theSquareIn(JsonNode one) {
		return List.of(one.path(THE_SQUARE_OF_IT).path("x").decimalValue(),
				one.path(THE_SQUARE_OF_IT).path("y").decimalValue(),
				one.path(THE_SQUARE_OF_IT).path("size").decimalValue());
	}

	/**
	 * THIS RECORD'S SQUARE IS THE ONE ON THAT PICTURE'S OWN ROW.
	 *
	 * <p><b>Compared by VALUE and not by scale</b>, which is a decision rather than a
	 * looseness: V21 chose {@code numeric(9, 8)} because the rule is about the exact
	 * boundaries 0 and 1, and it is the value that must survive the journey.
	 * {@code BigDecimal.equals} answers false for {@code 0.25} beside {@code 0.25000000}, so
	 * an equality here would be measuring how many zeroes a column happens to carry and would
	 * fail the day the column's scale changed while every fraction stayed exactly what it was.
	 */
	private void theSquareIsThatPicturesOwn(JsonNode one, String digest, String who) {
		assertThat(theSquareIn(one))
				.as("the square answered to %s is not the one on that picture's row, so some"
						+ " other picture's crop was read", who)
				.usingElementComparator(BigDecimal::compareTo)
				.containsExactlyElementsOf(theSquareOf(digest));
	}

	/**
	 * A PORTRAIT AND ITS SQUARE AS THE ANSWER SPELLS THEM, in either of their two shapes.
	 *
	 * <p>The two names are always side by side and always both there, which is what lets one
	 * pattern cover both states: an address with an object beside it, and null beside null.
	 */
	private static final Pattern A_PORTRAIT_AND_ITS_SQUARE = Pattern.compile(
			"\"" + THE_PORTRAIT + "\":(?:null|\"[^\"]*\"),\"" + THE_SQUARE_OF_IT
					+ "\":(?:null|\\{[^}]*})");

	private static final String BLANKED = "\"portraitBlankedByTheCase\":true";

	/**
	 * THE ANSWER WITH EVERY PORTRAIT BLANKED, so that what is left may be compared across
	 * callers byte for byte.
	 *
	 * <p><b>Why the three cases below need it from 26.09.2026.</b> Each of them says „signing
	 * in changes exactly these fields and nothing else", and until today that was two fields.
	 * A hidden member's portrait is the third thing a session changes ([ODLUKA 26.09.2026,
	 * owner]), so left unblanked those cases would fail on a resource that is behaving exactly
	 * as decided - and loosening them into „mostly the same" would throw away the half that
	 * makes them worth having: the number of records, their order, and every other value.
	 *
	 * <p><b>What that costs, and where it is paid back.</b> Blanked here, these cases no longer
	 * say anything about a portrait at all - including that a member who does NOT hide is
	 * answered his to a visitor. That sentence is asserted where it belongs, in
	 * {@link #aHiddenProfilesPortraitDoesNotLeaveToAVisitor}, which reads both members.
	 *
	 * <p><b>On the TEXT and never through a parser</b>, which is the reason
	 * {@code TeamApiTest} writes out for the same surgery: the square is
	 * {@code numeric(9, 8)} and comes out as {@code 0.10000000}, which survives being parsed
	 * and not being written back, so a comparison of two serialisations would measure the
	 * writer.
	 *
	 * <p><b>And it counts what it blanked</b>, because a pattern that matched nothing would
	 * leave every one of those cases passing for the wrong reason - which is exactly how a
	 * normalisation stops measuring and starts hiding.
	 */
	private static String withoutAnyPortrait(String whole, int records, String who) {
		String left = A_PORTRAIT_AND_ITS_SQUARE.matcher(whole).replaceAll(BLANKED);

		assertThat(left.split(Pattern.quote(BLANKED), -1).length - 1)
				.as("the answer given to %s does not carry one portrait and one square per"
						+ " record, so blanking them hid a difference rather than a picture", who)
				.isEqualTo(records);

		return left;
	}

	/** Every value {@code photo} carries in this answer, records with none included. */
	private List<String> everyPortraitIn(JsonNode answered) {
		return StreamSupport.stream(answered.spliterator(), false)
				.map(one -> one.path(THE_PORTRAIT).isNull() ? null
						: one.path(THE_PORTRAIT).asString())
				.toList();
	}

	/**
	 * A MEMBER'S PORTRAIT IS THE ADDRESS OF HIS OWN PICTURE, AND THE SQUARE IS HIS OWN TOO.
	 *
	 * <p>PDL P28c, owner, 26.09.2026: „po odobravanju slike ona tog trenutka pocinje da se vidi
	 * na svim avatar mestima". Nothing can draw one until this route answers it, which is the
	 * second of the four pieces of work that decision names.
	 *
	 * <p><b>Both halves are read out of the DATABASE by digest and not out of a constant
	 * standing beside them.</b> Written as literals, a query that answered any fixed square
	 * would pass; read off the row, it is wrong for every member. And 000012 is not the first
	 * record of the answer - the list comes back 000007, 000012, 000023, 000045 - so „her
	 * portrait" and „the first portrait" are two different places and a query joining without
	 * naming the row would be caught.
	 */
	@Test
	void aMemberCarriesTheAddressOfHisOwnPortraitAndItsOwnSquare() throws Exception {
		JsonNode hers = recordOf(HER_OWN_ACCOUNT, "000012");

		assertThat(hers.path(THE_PORTRAIT).asString())
				.as("the portrait answered is not the address of the picture her own row holds")
				.isEqualTo(A_PICTURE_IS_ASKED_FOR_AT + HER_PORTRAIT);
		theSquareIsThatPicturesOwn(hers, HER_PORTRAIT, "000012");
	}

	/**
	 * AND THE ADDRESS IT BUILDS REALLY REACHES THE ROUTE THAT SERVES A PICTURE.
	 *
	 * <p>{@link TeamApi}'s own arrangement for the same string, and the reason is written
	 * there: a constant copied is only ever as good as what proves it equal. This hands the
	 * address back to the DISPATCHER, so a rename of {@code /api/photos/{name}} that left
	 * either copy behind is caught by the route rather than by a comparison of two spellings.
	 *
	 * <p><b>The HANDLER is asked for and not the status</b>, which is the shape
	 * {@code TeamApiTest} uses for the same question and the reason is that no file stands
	 * behind the row on this machine: the status would be a 404 either way, and a 404 says
	 * „no mapping" and „no file" in one number. The handler says which class the dispatcher
	 * would have run, and only one answer to that is right.
	 */
	@Test
	void thePortraitIsTheAddressOfThatMembersOwnPicture() throws Exception {
		String address = recordOf(HER_OWN_ACCOUNT, "000012").path(THE_PORTRAIT).asString();

		assertThat(address)
				.as("the answer carries no portrait at all, so there is no address to walk")
				.isNotEmpty();

		assertThat(http.perform(get(address)).andReturn().getHandler())
				.as("the address answered (%s) is not one the portal maps to a picture, so it is"
						+ " a circle that will never draw", address)
				.isInstanceOfSatisfying(HandlerMethod.class,
						one -> assertThat(one.getBeanType()).isEqualTo(PhotoApi.class));
	}

	/**
	 * A MEMBER WITH NO PICTURE ANSWERS NULL, AND NEVER THE EMPTY PATH.
	 *
	 * <p>{@code frontend/src/data/types.ts} refuses the empty path about a team in as many
	 * words - „a team that has none is not a team whose logo is the empty path" - and the
	 * reason is the same for a member: an empty path is an address a browser would ask for.
	 *
	 * <p><b>Both halves go, or neither does.</b> Every column of {@code photo} is NOT NULL
	 * (V8), so a record carrying a square with no picture to cut is a square of nothing. This
	 * is asked of EVERY record rather than of the two members who have no portrait, so the day
	 * a fifth member arrives it is measured without anybody remembering to add him.
	 */
	@Test
	void aPortraitAndItsSquareLeaveTogetherOrNeitherDoes() throws Exception {
		for (JsonNode one : answerFor(HER_OWN_ACCOUNT)) {
			String who = one.path("memberNumber").asString();

			assertThat(one.has(THE_PORTRAIT) && one.has(THE_SQUARE_OF_IT))
					.as("%s carries one of the two names and not the other; the portrait and its"
							+ " square are one fact", who)
					.isTrue();
			assertThat(one.path(THE_PORTRAIT).isNull())
					.as("%s answers a square and no picture, or a picture and no square", who)
					.isEqualTo(one.path(THE_SQUARE_OF_IT).isNull());

			if (!one.path(THE_PORTRAIT).isNull()) {
				assertThat(one.path(THE_PORTRAIT).asString())
						.as("%s answers the empty path, which is an address a browser would ask"
								+ " for rather than the null that says there is no picture", who)
						.isNotEmpty();
			}
		}

		assertThat(everyPortraitIn(answerFor(HER_OWN_ACCOUNT)))
				.as("either nobody or everybody in this answer has a portrait, so the two states"
						+ " of the first axis are not both in the fixture")
				.contains((String) null)
				.contains(A_PICTURE_IS_ASKED_FOR_AT + HER_PORTRAIT);
	}

	/**
	 * A PICTURE WAITING FOR A MODERATOR IS NOBODY'S PORTRAIT, WHOEVER ASKS.
	 *
	 * <p>ADL A60, owner, 20.09.2026: a picture held only by something that waits for a
	 * moderator „nije javna... Takva slika odgovara tacno isto kao slika koje nema", and PDL
	 * P28a says why - „Profilnu sliku administrator odobrava pre objave".
	 *
	 * <p><b>It is the DIGEST that must not leave and not only the bytes.</b>
	 * {@link PhotoApi} already refuses bytes no public holder points at, so this is not about
	 * a picture being served; it is about a visitor learning that this member has one in
	 * moderation, and about whoever holds the file learning that it is that one.
	 *
	 * <p><b>Read as TEXT and over every kind of caller</b>, the shape
	 * {@link #noYearOfBirthLeavesTheServer} uses: a digest folded into another field, or a
	 * field renamed, would walk past a check that reads names. Six callers, because the
	 * answer depends on who asks and a rule held for the visitor alone would be held for the
	 * one caller who was never the risk.
	 */
	@Test
	void aPictureWaitingForAModeratorIsNobodysPortrait() throws Exception {
		assertThat(db.sql("select count(*) from verification v join photo p on p.id = v.photo_id"
						+ " where v.state = 'waiting' and p.digest in (?, ?)")
						.params(THE_PICTURE_SHE_IS_HAVING_MODERATED,
								THE_PICTURE_THE_OTHER_IS_HAVING_MODERATED)
						.query(Long.class).single())
				.as("no picture in this fixture is waiting for a moderator, so the case below"
						+ " asks the answer for something that is not there anyway")
				.isEqualTo(2L);

		for (String asking : Arrays.asList(null, HER_OWN_ACCOUNT, THE_OTHER_MEMBER,
				RACES_FOR_NOBODY, THE_MODERATOR_OVER_THE_MEMBERS, THE_SUPERADMIN)) {

			assertThat(whole(asking))
					.as("the answer given to %s carries the digest of a picture a moderator has"
							+ " not decided on, so the portal published it instead of him",
							asking == null ? "a visitor" : asking)
					.doesNotContain(THE_PICTURE_SHE_IS_HAVING_MODERATED)
					.doesNotContain(THE_PICTURE_THE_OTHER_IS_HAVING_MODERATED);
		}
	}

	/**
	 * AND A MEMBER WHOSE ONLY PICTURE IS WAITING CARRIES NO PORTRAIT AT ALL.
	 *
	 * <p><b>This is the half the case above cannot measure, and it is the reason there are two
	 * waiting pictures in the fixture rather than one.</b> 000012 has a portrait standing as
	 * well, so {@code coalesce(c.photo_id, v.photo_id)} answers her own picture and every
	 * assertion above passes. 000023 has nothing to fall back on, so the same expression hands
	 * out a picture nobody has decided on - which is what makes „two sources of one value" a
	 * measurement here and not a worry.
	 */
	@Test
	void aMemberWhoseOnlyPictureIsWaitingCarriesNoPortrait() throws Exception {
		assertThat(db.sql("select photo_id from competitor where member_number = '000023'")
						.query(Long.class).optional())
				.as("000023 has a portrait of her own in this fixture, so falling back on the"
						+ " queue would be invisible here")
				.isEmpty();

		assertThat(recordOf(HER_OWN_ACCOUNT, "000023").path(THE_PORTRAIT).isNull())
				.as("a member whose only picture is waiting for a moderator was answered a"
						+ " portrait, so the queue was read where the profile should have been")
				.isTrue();
	}

	/**
	 * A HIDDEN PROFILE'S PORTRAIT DOES NOT LEAVE TO A CALLER WHO IS NOT SIGNED IN.
	 *
	 * <p><b>[ODLUKA 26.09.2026, owner]</b>, chosen between three offered. ADL A60 held this
	 * boundary open with one sentence - „otisak PORTRETA ne objavljuje nijedan resurs" - and
	 * required that „Prvi resurs koji ga objavi mora u istom potezu da donese pravilo o
	 * skrivenom profilu". This resource is that one. PDL, 06.09.2026 puts the photograph among
	 * what hiding hides.
	 *
	 * <p><b>Withheld as NULL and not as an absent key, which is the whole shape of the
	 * rule.</b> PDL, 06.09.2026: „Oba slucaja dobijaju isti ishod." A member who hides must
	 * read exactly like a member who has no picture, or the absence itself says „this one is
	 * hiding" - which is the fact being withheld. So the case asserts the null AND that the
	 * two are indistinguishable: 000007's record and 000045's are compared on both names.
	 *
	 * <p><b>And the floors say the 404 is about hiding and nothing else:</b> he really is
	 * hidden, and his row really does hold that picture. Without them a query that dropped the
	 * join altogether would pass.
	 */
	@Test
	void aHiddenProfilesPortraitDoesNotLeaveToAVisitor() throws Exception {
		assertThat(db.sql("select profile_hidden from competitor where member_number = '000007'")
						.query(Boolean.class).single())
				.as("000007 is not hiding his profile in this fixture, so the null below would be"
						+ " the answer of a member with no picture")
				.isTrue();
		assertThat(db.sql("select p.digest from competitor c join photo p on p.id = c.photo_id"
						+ " where c.member_number = '000007'").query(String.class).optional())
				.as("000007 holds no picture at all, so withholding it withholds nothing")
				.contains(THE_PORTRAIT_OF_THE_ONE_WHO_HIDES);

		JsonNode his = recordOf(null, "000007");
		JsonNode somebodyWithNoPicture = recordOf(null, "000045");

		assertThat(his.path(THE_PORTRAIT).isNull())
				.as("a visitor was answered the portrait of a member who hides his profile")
				.isTrue();
		assertThat(whole(null))
				.as("the digest of a hidden member's portrait is somewhere in the visitor's"
						+ " answer, under some other name")
				.doesNotContain(THE_PORTRAIT_OF_THE_ONE_WHO_HIDES);

		/* AND THE OTHER MEMBER'S PORTRAIT DOES REACH THE SAME VISITOR, which is what makes
		   HIDING the condition rather than the session. Without this line a resource that
		   answered no portrait at all to a visitor would pass everything above, and it is here
		   rather than anywhere else because the three cases that compare a visitor's answer
		   with a member's blank the portraits on both sides and therefore say nothing about
		   this. 000012 does not hide and holds a portrait of her own. */
		assertThat(recordOf(null, "000012").path(THE_PORTRAIT).asString())
				.as("a visitor was answered no portrait for a member who does NOT hide her"
						+ " profile, so what is being withheld is the session and not the hiding")
				.isEqualTo(A_PICTURE_IS_ASKED_FOR_AT + HER_PORTRAIT);

		assertThat(List.of(his.has(THE_PORTRAIT), his.path(THE_PORTRAIT).isNull(),
						his.has(THE_SQUARE_OF_IT), his.path(THE_SQUARE_OF_IT).isNull()))
				.as("a member who hides his profile does not read like a member who has no"
						+ " picture, so the shape of the answer says which members are hiding")
				.isEqualTo(List.of(somebodyWithNoPicture.has(THE_PORTRAIT),
						somebodyWithNoPicture.path(THE_PORTRAIT).isNull(),
						somebodyWithNoPicture.has(THE_SQUARE_OF_IT),
						somebodyWithNoPicture.path(THE_SQUARE_OF_IT).isNull()));
	}

	/**
	 * AND IT DOES LEAVE TO EVERYBODY WHO IS SIGNED IN, WHICH IS THE OTHER DIRECTION.
	 *
	 * <p>The owner's own limit on the rule: „Takmicar od ulogovanih kolega ne moze da sakrije
	 * profil" (PDL, 06.09.2026), with the reason in the published policy - „ali ne i od
	 * ostalih clanova, jer bi time nestao smisao zajednickog rangiranja". A rule written in
	 * one direction only would pass on a resource that answered nobody a portrait at all.
	 *
	 * <p><b>{@code RACES_FOR_NOBODY} is in this list and he is the reason it is a list.</b>
	 * V23 leaves {@code account.competitor_id} empty for an account that does not race, so
	 * {@code memberOfAccount} answers nothing for him: a condition written against the
	 * caller's MEMBER rather than against his account refuses him, and he is signed in, so
	 * that would be the rule applied to a reader it was never about. The superadmin is the
	 * same shape and is here for the same reason.
	 */
	@Test
	void aHiddenProfilesPortraitLeavesToEverybodyWhoIsSignedIn() throws Exception {
		for (String asking : List.of(HER_OWN_ACCOUNT, THE_OTHER_MEMBER, RACES_FOR_NOBODY,
				THE_MODERATOR_OVER_THE_MEMBERS, THE_SUPERADMIN)) {

			JsonNode his = recordOf(asking, "000007");

			assertThat(his.path(THE_PORTRAIT).asString())
					.as("%s is signed in and was not answered the portrait of a member who hides"
							+ " his profile; hiding is from a reader who is not signed in and"
							+ " from nobody else", asking)
					.isEqualTo(A_PICTURE_IS_ASKED_FOR_AT + THE_PORTRAIT_OF_THE_ONE_WHO_HIDES);
			theSquareIsThatPicturesOwn(his, THE_PORTRAIT_OF_THE_ONE_WHO_HIDES, asking);
		}
	}

	/**
	 * AND NOTHING OF A LAPSED MEMBER'S PORTRAIT LEAVES, BECAUSE HE IS ON NO ANSWER AT ALL.
	 *
	 * <p>{@link #aMemberWhoseFeeHasLapsedIsNotOnTheList} says his ROW is absent; this says
	 * that nothing of his is anywhere in the text, which is a different claim and the one that
	 * matters for a picture. PDL P11, owner 13.09.2026: „ko nije platio, ne vidi se nigde osim
	 * u istorijskim godinama", and the shape that carries it here is {@code where c.active}.
	 *
	 * <p><b>Not a decision of this increment and deliberately unchanged</b>: the note on
	 * {@link CompetitorApi} says what follows from it for the header of such a member, which
	 * draws no monogram today either.
	 */
	@Test
	void nothingOfALapsedMembersPortraitLeaves() throws Exception {
		assertThat(db.sql("select p.digest from competitor c join photo p on p.id = c.photo_id"
						+ " where c.member_number = '000031'").query(String.class).optional())
				.as("000031 holds no picture, so this case is about nothing")
				.contains(THE_PORTRAIT_OF_THE_ONE_WHO_HAS_NOT_PAID);

		for (String asking : Arrays.asList(null, HER_OWN_ACCOUNT, THE_MODERATOR_OVER_THE_MEMBERS,
				THE_SUPERADMIN)) {

			assertThat(whole(asking))
					.as("the answer given to %s carries the portrait of a member whose fee has"
							+ " lapsed", asking == null ? "a visitor" : asking)
					.doesNotContain(THE_PORTRAIT_OF_THE_ONE_WHO_HAS_NOT_PAID);
		}
	}

	/**
	 * AND NO TEAM'S MARK LEAVES AS A MEMBER'S FACE.
	 *
	 * <p>The mirror of {@code TeamApiTest.noPartOfAnybodysProfilePictureLeavesWithATeam}, and
	 * it is worth its lines because both facts are rows of one table: {@code photo} holds a
	 * portrait and a mark side by side and the only thing telling them apart is which column
	 * points at them. A join written {@code on mine.id = t.logo_id} would answer a club badge
	 * where a face belongs, and every case above about „her own portrait" would still pass for
	 * the members who have one.
	 *
	 * <p>Asked of the whole text, so a mark folded into any field is caught, and asked of the
	 * member's answer rather than the visitor's, which is the one that carries the most.
	 */
	@Test
	void noTeamsMarkLeavesAsAMembersFace() throws Exception {
		assertThat(db.sql("select count(*) from team t join photo p on p.id = t.logo_id"
						+ " where p.digest in (?, ?)")
						.params(THE_MARK_OF_ONE_TEAM, THE_MARK_OF_THE_OTHER_TEAM)
						.query(Long.class).single())
				.as("no team in this fixture has a mark, so this case compares nothing")
				.isEqualTo(2L);

		assertThat(whole(HER_OWN_ACCOUNT))
				.as("a team's mark came back in the list of members, so some picture other than"
						+ " a member's own portrait was read")
				.doesNotContain(THE_MARK_OF_ONE_TEAM)
				.doesNotContain(THE_MARK_OF_THE_OTHER_TEAM);
	}

	/**
	 * THE SQUARE CARRIES THE THREE NAMES THE PORTAL ALREADY READS, AND THE LIST IS NOT WRITTEN
	 * HERE.
	 *
	 * <p>{@code Answers.servedFields} reads the names of a record and cannot see inside one of
	 * them, which it says of itself: a nested object is a place a field can be added or
	 * renamed without the floor above noticing. Three names written into this case would be a
	 * list, and a list is what has failed on this portal six times.
	 *
	 * <p><b>So the floor is the portal's own served record of a TEAM</b>, which is the one
	 * thing the portal ships that already carries a square ({@code teams.json}). It is the
	 * same fact about a different thing and one piece of arithmetic reads both
	 * ({@code frontend/src/components/crop.ts}), so the day either side renames a fraction the
	 * two stop agreeing and this falls. {@code size} is the name that matters most:
	 * {@code cropIn} asks for it and quietly returns the whole picture for a record without
	 * it, so answering {@code diameter} would lose every crop on the portal without one error
	 * anywhere.
	 */
	@Test
	void theSquareCarriesTheThreeNamesTheServedTeamCarries() throws Exception {
		Set<String> onATeam = Answers.fieldsOf(
				Answers.servedRecord("teams.json").path(THE_SQUARE_OF_IT));

		assertThat(onATeam)
				.as("the served team carries no square at all, so this floor is comparing an"
						+ " empty set and would pass whatever a member answered")
				.isNotEmpty();

		assertThat(Answers.fieldsOf(
						recordOf(HER_OWN_ACCOUNT, "000012").path(THE_SQUARE_OF_IT)))
				.as("a member's square and a team's square are the same fact under different"
						+ " names, and one piece of arithmetic reads both")
				.containsExactlyInAnyOrderElementsOf(onATeam);
	}

	/**
	 * AND THE TEAM COMES OFF THE MEMBERSHIP THAT HAS NOT ENDED.
	 *
	 * <p>A member is in one team at a time (V11) and the season it started in is what
	 * the portal draws beside the club. Both halves are here: the one who is in a team
	 * carries it with the season, and the three who are not carry neither.
	 *
	 * <p><b>A membership that ended is in the fixture on both sides</b>, which is what
	 * makes this measure the condition rather than the join. 000045 left one team and
	 * joined another, so ignoring the condition would give him two rows and the wrong
	 * season; 000007 left a team and joined none, so it would give him a club he is not
	 * in. The list of members in no team is checked as a whole for that second half.
	 */
	@Test
	void theTeamIsTheOneTheMembershipHasNotEnded() throws Exception {
		List<JsonNode> theOneInATeam = StreamSupport.stream(answer().spliterator(), false)
				.filter(one -> one.path("memberNumber").asString().equals("000012")).toList();

		assertThat(theOneInATeam)
				.as("the member who left one team and joined another came back more than once")
				.hasSize(1);
		assertThat(theOneInATeam.getFirst().path("teamSince").asInt())
				.as("the answer names a season other than the one the standing membership began in")
				.isEqualTo(2028);
		assertThat(theOneInATeam.getFirst().path("teamId").isNull())
				.as("the member is in a team and the answer says nothing")
				.isFalse();

		assertThat(StreamSupport.stream(answer().spliterator(), false)
				.filter(one -> one.path("teamId").isNull())
				.map(one -> one.path("memberNumber").asString()).toList())
				.as("a member who is in no team came back in one")
				.containsExactly("000007", "000023", "000045");
	}

	@Test
	void nobodyHasToSignInToSeeWhoRuns() throws Exception {
		assertThat(http.perform(get("/api/competitors")).andReturn().getResponse().getStatus())
				.as("/api/competitors asked a visitor to sign in")
				.isEqualTo(200);
	}

	/**
	 * THE VISITOR'S ANSWER HAS NOT MOVED, AND THAT IS THE FIRST THING THIS INCREMENT
	 * WAS MEASURED BY.
	 *
	 * <p>This resource began to answer two fields to whoever is asking on 20.09.2026,
	 * and the whole of what that may cost is here: the answer a visitor gets must be
	 * what it was, to the byte. It is asked in the two ways that fail differently.
	 *
	 * <ul>
	 * <li><b>None of the THREE conditional names is anywhere in the visitor's answer</b>,
	 * over EVERY record and not only the first. A key carrying null would pass a check
	 * that reads the first record and would still have changed every byte after it.
	 * <b>The basis is asked here as well since 21.09.2026</b>, because
	 * {@code CompetitorApi}'s own javadoc says this case measures all three and it
	 * measured two: a resource handing the basis to everybody walked past it (2 cases
	 * green, exit 0) while the rest of the class went red with five.</li>
	 * <li><b>And the visitor's answer is the member's answer with exactly those two
	 * keys taken out.</b> Two and not three: the member is answered no basis either, so
	 * there is nothing of it to cut. That is the half a name cannot measure: it holds
	 * the number of records, their order, and every value in them, so a condition
	 * written as a join - the one shape that can give a member two rows or drop one -
	 * fails here even though every name is still right.</li>
	 * <li><b>AND SINCE 26.09.2026 THE PORTRAITS ARE BLANKED ON BOTH SIDES BEFORE THAT
	 * COMPARISON, because a session now changes a third thing.</b> A member who hides his
	 * profile is answered his portrait to anybody signed in and null to a visitor ([ODLUKA
	 * 26.09.2026, owner]), which is a difference this case would otherwise report as a
	 * fault. It is blanked rather than the comparison loosened, and the case first asserts
	 * that the two answers really DO differ before the blanking - so the normalisation
	 * cannot quietly become the thing that makes this pass. {@link #withoutAnyPortrait}
	 * counts what it blanked for the same reason.</li>
	 * </ul>
	 *
	 * <p><b>Why a golden file was measured and then not committed.</b> The answer was
	 * captured off `origin/main` before this change and again after it, and the two
	 * are the same SHA-256 on all four resources. It is not kept as a file because the
	 * keys in it are `bigserial` and a sequence does not roll back with a test, so the
	 * same fixture answers different numbers depending on what ran before it in the
	 * same container - which is a guard that fails for a reason that has nothing to do
	 * with what it is guarding.
	 *
	 * <p><b>The second half cuts the substring rather than parsing and writing back,
	 * and {@code TeamApiTest} says why it was measured that way.</b> What is cut is
	 * built out of the values the answer itself carries, so nothing in this case is a
	 * number somebody remembered.
	 */
	@Test
	void theVisitorsAnswerHasNotMoved() throws Exception {
		for (JsonNode one : answerFor(null)) {
			assertThat(Answers.fieldsOf(one))
					.as("a visitor was answered something only a signed in member or the"
							+ " administration may have, on the record of %s",
							one.path("memberNumber").asString())
					.doesNotContain(THE_REFERRAL_CODE, THE_COUNT_SHE_BROUGHT_IN,
							HOW_THE_MEMBERSHIP_IS_HELD);
		}

		JsonNode hers = recordOf(HER_OWN_ACCOUNT, "000012");
		String added = ",\"" + THE_REFERRAL_CODE + "\":\"" + hers.path(THE_REFERRAL_CODE).asString()
				+ "\",\"" + THE_COUNT_SHE_BROUGHT_IN + "\":"
				+ hers.path(THE_COUNT_SHE_BROUGHT_IN).asInt();

		int records = answerFor(null).size();

		/* AND THE THIRD THING A SESSION CHANGES IS BLANKED ON BOTH SIDES, NOT IGNORED. The
		   line below would fail without this and the resource would be behaving exactly as
		   decided, so what is said out loud is that the two answers differ in the portrait as
		   well - and then that they differ in NOTHING ELSE. */
		assertThat(whole(HER_OWN_ACCOUNT).replace(added, ""))
				.as("the member's answer and the visitor's are already the same once the two"
						+ " fields are cut, so blanking the portrait below measures nothing and a"
						+ " hidden member's picture is reaching a visitor")
				.isNotEqualTo(whole(null));

		assertThat(withoutAnyPortrait(whole(HER_OWN_ACCOUNT).replace(added, ""), records,
						HER_OWN_ACCOUNT))
				.as("signing in changed something other than the three things it was allowed to:"
						+ " the visitor's answer is no longer the member's answer with the two"
						+ " fields taken out and the portraits blanked")
				.isEqualTo(withoutAnyPortrait(whole(null), records, "a visitor"));
	}

	/**
	 * AND THE MEMBER'S OWN RECORD CARRIES NOTHING NOBODY NAMED, which is the same
	 * floor the visitor's answer stands on, moved onto the record that differs.
	 *
	 * <p>It is the SAME check and not a second one: {@code Answers} is handed the
	 * caller's own record instead of the first, so what it compares against is the
	 * file the portal serves rather than a list written here. Three of the four
	 * omissions are still omissions for him - the age band because it is owed, the
	 * referrer's code because the count replaces it, the basis because PDL P8 gives it
	 * to the administration alone and the fee flag because he is on the list at all -
	 * and the one that is no longer an omission is the one field this increment hands
	 * back. The count is named as answered on purpose, and {@code Answers} checks that
	 * the portal really does NOT serve that name, so a name listed here after the
	 * portal starts serving it cannot quietly excuse anything.
	 */
	@Test
	void theMembersOwnRecordCarriesNothingNobodyNamed() throws Exception {
		assertThat(Answers.fieldsOf(recordOf(HER_OWN_ACCOUNT, "000012")))
				.as("the caller's own record is no longer the one that differs, so the floor"
						+ " below would be asked of the wrong record")
				.contains(THE_REFERRAL_CODE);

		Answers.everyFieldThePortalReadsIsAnswered("/api/competitors asked by the member himself",
				new ObjectMapper().createArrayNode().add(recordOf(HER_OWN_ACCOUNT, "000012")),
				"competitors.json",
				Set.of(THE_COUNT_SHE_BROUGHT_IN, THE_PORTRAIT, THE_SQUARE_OF_IT),
				WHO_HANDED_OUT_THE_CODE,
				HOW_THE_MEMBERSHIP_IS_HELD, WHETHER_THE_FEE_IS_STANDING);
	}

	/**
	 * A MEMBER IS HANDED HIS OWN REFERRAL LINK AND NOBODY ELSE'S.
	 *
	 * <p>PDL, 06.09.2026: „`referralCode` je clanov sopstveni link". ADL A8 names the
	 * road it may travel: „kod preporuke ... ide iskljucivo kroz endpoint koji trazi
	 * prijavu, i nikad u odgovor koji vidi posetilac."
	 *
	 * <p><b>Three things, and the second is the one a wrong resource passes.</b> The
	 * value on his record is HIS, read out of the database rather than written here.
	 * Every OTHER code in the database is absent from the whole answer as text, which
	 * is the check that refuses a resource answering the list of codes to anybody who
	 * signs in - the exact shape PDL measured as the reason one public file could not
	 * go on serving three audiences. And no other record carries the key at all, so a
	 * code cannot arrive as null beside a name and be filled in by the next change.
	 */
	@Test
	void aMemberIsHandedHisOwnCodeAndNobodyElses() throws Exception {
		String hers = db.sql("select referral_code from competitor where member_number = '000012'")
				.query(String.class).single();

		assertThat(recordOf(HER_OWN_ACCOUNT, "000012").path(THE_REFERRAL_CODE).asString())
				.as("the member was not handed her own referral link by a resource that knows"
						+ " who is asking")
				.isEqualTo(hers);

		List<String> everybodyElses = db.sql("select referral_code from competitor"
				+ " where member_number <> '000012'").query(String.class).list();
		assertThat(everybodyElses).as("no other code was read out of the database, so the loop"
				+ " below asserts nothing").hasSize(4);

		String whole = whole(HER_OWN_ACCOUNT);

		for (String code : everybodyElses) {
			assertThat(whole).as("somebody else's referral code (%s) was handed to a member who"
					+ " merely signed in; Clan 73 does not make it public and signing in is not"
					+ " what makes it his", code).doesNotContain(code);
		}

		assertThat(StreamSupport.stream(answerFor(HER_OWN_ACCOUNT).spliterator(), false)
				.filter(one -> Answers.fieldsOf(one).contains(THE_REFERRAL_CODE))
				.map(one -> one.path("memberNumber").asString()).toList())
				.as("a record other than the caller's own carries the referral code key, whatever"
						+ " value it holds")
				.containsExactly("000012");
	}

	/**
	 * AND HE IS TOLD HOW MANY HE BROUGHT IN, WHICH IS A COUNT AND NEVER THE COLUMN.
	 *
	 * <p>PDL, 06.09.2026, measured why this field could not stay in the public file:
	 * „`referredBy` cita ekran Clanarine da prebroji koga je clan doveo, a to je upit
	 * nad SVIMA, ne nad sobom." Answered as a count by a resource that knows who is
	 * asking, the query over everybody happens where the data is and nothing about
	 * anybody else leaves.
	 *
	 * <p><b>The number is one and every wrong way of getting it is a different
	 * number</b>, which is what the fixture is arranged for: she brought in two
	 * people and one of them has let his fee lapse, so the answer is ONE while five
	 * members exist, four are on the list and two have a referrer. And the same
	 * field asked of a member who brought in nobody is nought, so nothing constant
	 * answers both.
	 */
	@Test
	void aMemberIsToldHowManyHeBroughtInAndOnlyThoseWhoseFeeStands() throws Exception {
		assertThat(db.sql("select count(*) from competitor where referred_by ="
						+ " (select id from competitor where member_number = '000012')")
				.query(Integer.class).single())
				.as("nobody in the fixture was brought in by her, so this case asserts nothing")
				.isEqualTo(2);

		assertThat(recordOf(HER_OWN_ACCOUNT, "000012").path(THE_COUNT_SHE_BROUGHT_IN).asInt())
				.as("the count is not the members she brought in whose fee is standing; counting"
						+ " everybody she brought gives two and the list itself gives three")
				.isEqualTo(1);

		assertThat(recordOf(THE_OTHER_MEMBER, "000045").path(THE_COUNT_SHE_BROUGHT_IN).asInt())
				.as("a member who brought in nobody was told he brought in somebody, so the field"
						+ " is not his own")
				.isZero();

		assertThat(StreamSupport.stream(answerFor(HER_OWN_ACCOUNT).spliterator(), false)
				.filter(one -> Answers.fieldsOf(one).contains(THE_COUNT_SHE_BROUGHT_IN))
				.map(one -> one.path("memberNumber").asString()).toList())
				.as("a record other than the caller's own carries the count key")
				.containsExactly("000012");
	}

	/**
	 * AND AN ACCOUNT THAT RACES FOR NOBODY IS ANSWERED WHAT A VISITOR IS, TO THE BYTE.
	 *
	 * <p>V23 leaves {@code account.competitor_id} empty for an account that does not
	 * race, „Empty for a moderator who does not race, which is the ordinary case and
	 * not a fault" (owner, 14.09.2026). Being signed in is therefore not the same
	 * question as being a member, and this is the case that keeps the two apart: a
	 * resource that read the ACCOUNT where it means the MEMBER would answer this
	 * caller somebody's fields, and the somebody would be whoever holds that key.
	 */
	@Test
	void anAccountThatRacesForNobodyIsAnsweredWhatAVisitorIs() throws Exception {
		assertThat(db.sql("select competitor_id from account where email = ?")
				.param(RACES_FOR_NOBODY).query(Long.class).list().get(0))
				.as("the account names a member after all, so this case measures the wrong thing")
				.isNull();

		/* AND HE HOLDS NOTHING OVER THE MEMBERS, which this case has said since the
		   basis started leaving to the administration. Without the line, ticking that
		   box for him tomorrow would turn the sentence above into a different one and
		   nothing would say so.

		   The word and not `CompetitorApi.OVER_THE_MEMBERS`, for the reason written
		   beside the tick in the fixture: this is a sentence about the FIXTURE, and
		   read through the constant it would go on passing while the constant drifted. */
		assertThat(db.sql("select count(*) from account_admin_right"
						+ " where account_id = (select id from account where email = ?)"
						+ " and right_code = ?")
				.params(RACES_FOR_NOBODY, "entity:members")
				.query(Integer.class).single())
				.as("this moderator holds the right over the members after all, so he is no longer"
						+ " answered what a visitor is for a reason that has nothing to do with"
						+ " racing for nobody")
				.isZero();

		/* AND THE PORTRAITS ARE BLANKED, WHICH IS THE ONE THING HE IS ANSWERED MORE THAN A
		   VISITOR SINCE 26.09.2026 - and it is the point rather than an exception. He has no
		   member at all, so a rule written against the caller's MEMBER would refuse him a
		   hidden member's portrait although he is signed in, and the rule is about a reader
		   with no session. `aHiddenProfilesPortraitLeavesToEverybodyWhoIsSignedIn` walks him
		   by name for exactly that reason; here what is measured is that NOTHING ELSE moved. */
		int records = answerFor(null).size();

		assertThat(withoutAnyPortrait(whole(RACES_FOR_NOBODY), records, RACES_FOR_NOBODY))
				.as("an account with no member behind it was answered more than a visitor is,"
						+ " beyond the portrait his session entitles him to")
				.isEqualTo(withoutAnyPortrait(whole(null), records, "a visitor"));
	}

	/**
	 * THE ADMINISTRATION IS THE ONLY ONE TOLD HOW A MEMBERSHIP IS HELD, AND EVERYBODY
	 * ELSE IS NOT TOLD ON ANY RECORD - THEIR OWN INCLUDED.
	 *
	 * <p>PDL P8, 28.07.2026: „Osnov clanstva se nikad ne prikazuje javno. Ni na
	 * profilu, ni u tabelama, nigde. Vide ga samo Superadmin i moderatori sa pravom nad
	 * clanovima." The owner's reason names the shape: „to je podatak o novcu, a ne o
	 * trcanju, i nikoga se ne tice ko je pocascen."
	 *
	 * <p><b>Five kinds of caller and not two, and the moderator WITHOUT the right is
	 * the one this case exists for.</b> He is signed in, he is a moderator, he holds a
	 * right - and he is on the far side of the line. A resource that asked „is he
	 * staff" instead of „may he" answers him, and nothing about that reads wrong.
	 *
	 * <p><b>Asked over EVERY record and by key rather than by value.</b> A key carrying
	 * null says „he is not exempt" to a screen that draws a tag off it, and it says it
	 * about the whole list rather than about one person; that is the difference between
	 * absent and empty, and it is the same one the referral code is held to above.
	 *
	 * <p><b>The sharpened half of P8 is the member's own record, and it is NOT answered
	 * here or anywhere else today.</b> „Clan vidi SVOJ osnov clanstva" (20.09.2026)
	 * belongs on a route that answers about one caller whether or not he is on a list,
	 * because this list is the members whose fee is STANDING and the man the sharpening
	 * was written about - the one who pays nothing - is not on it at all. Measured on
	 * 21.09.2026: {@code MeApi.WhoIAm} carries {@code role} and {@code account}, so that
	 * half leaves the server through no route. It is named rather than assumed, and it
	 * is why a member is refused here even on his own row.
	 */
	@Test
	void theAdministrationIsTheOnlyOneToldHowAMembershipIsHeld() throws Exception {
		for (String nobody : NOBODY_WHO_MAY_READ_THE_BASIS) {
			for (JsonNode one : answerFor(nobody)) {
				assertThat(Answers.fieldsOf(one))
						.as("%s was answered how a membership is held, on the record of %s; PDL P8"
								+ " names the superadmin and a moderator with the right over the"
								+ " members, and nobody else", nobody,
								one.path("memberNumber").asString())
						.doesNotContain(HOW_THE_MEMBERSHIP_IS_HELD);
			}
		}

		for (String administration : THE_ADMINISTRATION) {
			JsonNode answer = answerFor(administration);

			assertThat(StreamSupport.stream(answer.spliterator(), false)
					.filter(one -> !Answers.fieldsOf(one).contains(HOW_THE_MEMBERSHIP_IS_HELD))
					.map(one -> one.path("memberNumber").asString()).toList())
					.as("%s is the administration and a record of his answer does not say how that"
							+ " membership is held", administration)
					.isEmpty();

			assertThat(answer).as("%s was answered an empty list, so the check above compared"
					+ " nothing", administration).isNotEmpty();
		}
	}

	/**
	 * AND THE WORD HE IS TOLD IS THE ONE ON THAT MEMBER'S ROW, NOT THE ONE ON HIS OWN.
	 *
	 * <p><b>This is the substitution the referral code's own shape invites.</b> The two
	 * fields above are answered {@code case when c.id = :me}, and the same line copied
	 * onto this field would hand a moderator his own basis and nothing else - or, worse,
	 * his own basis written across every record. Both are refused here, and the fixture
	 * is arranged so that they are refused by a value and not by a length: the moderator
	 * who holds the right is 000031, whose fee has lapsed, so he is not on the list at
	 * all; his basis is {@code payment} and 000012's is {@code feeExempt}.
	 *
	 * <p><b>And the map is compared whole for the administration account that IS on the
	 * list too</b>, so the one row the condition could have cut out - the caller's own -
	 * is one of the entries. That is the half this case could not carry until
	 * 21.09.2026, and the two questions asked of 000031 above are asked of him as well:
	 * his row is really in the map, and at least one row he looks at is held on another
	 * basis, so a word taken off the wrong row is a different word.
	 *
	 * <p><b>What is compared is read out of the database</b>, so a fixture changed
	 * tomorrow is measured without anybody remembering this case - and the map is
	 * compared whole, which holds the pairing as well as the words. A resource
	 * answering the right words against the wrong members passes a check on the set and
	 * fails this one.
	 */
	@Test
	void aModeratorOverTheMembersIsToldHowEveryMembershipIsHeld() throws Exception {
		Map<String, String> onTheRows = new HashMap<>();

		for (Map.Entry<String, String> row : db.sql("select member_number, membership_basis"
						+ " from competitor where active")
				.query((one, number) -> Map.entry(one.getString(1), one.getString(2))).list()) {
			onTheRows.put(row.getKey(), row.getValue());
		}

		assertThat(onTheRows.values().stream().distinct().toList())
				.as("every member on the list is held on the same basis, so answering with a"
						+ " constant would satisfy this case")
				.hasSizeGreaterThan(1);

		String his = db.sql("select membership_basis from competitor where id ="
						+ " (select competitor_id from account where email = ?)")
				.param(THE_MODERATOR_OVER_THE_MEMBERS).query(String.class).single();

		assertThat(onTheRows.values().stream().filter(one -> !one.equals(his)).toList())
				.as("no row the moderator looks at is held on a basis other than his own (%s), so"
						+ " serving him his own across the whole answer would pass", his)
				.isNotEmpty();

		assertThat(onTheRows).as("the moderator's own basis stands on no row he looks at, so this"
						+ " case cannot tell his own from the row's").containsValue(his);

		/* AND THE SAME TWO QUESTIONS ABOUT THE ADMINISTRATION ACCOUNT THAT IS ON THE LIST,
		   because the map below is compared whole and his own row is one of its entries.
		   Without these, a resource that handed his own row the word off another row would
		   be caught only when the two words happened to differ. */
		assertThat(onTheRows).as("the administration account that is meant to be on the list is"
						+ " not on it, so the map below says nothing about the caller's own row")
				.containsKey(hisMemberNumber());

		String onTheList = db.sql("select membership_basis from competitor where member_number = ?")
				.param(hisMemberNumber()).query(String.class).single();
		assertThat(onTheRows.values().stream().filter(one -> !one.equals(onTheList)).toList())
				.as("every row the administrator on the list looks at is held on his own basis"
						+ " (%s), so his own row carrying another row's word reads the same",
						onTheList)
				.isNotEmpty();

		for (String administration : THE_ADMINISTRATION) {
			Map<String, String> answered = new HashMap<>();

			for (JsonNode one : answerFor(administration)) {
				answered.put(one.path("memberNumber").asString(),
						one.path(HOW_THE_MEMBERSHIP_IS_HELD).asString());
			}

			assertThat(answered)
					.as("%s was told a basis that is not the one standing on that member's row;"
							+ " his own is %s", administration, his)
					.isEqualTo(onTheRows);
		}
	}

	/**
	 * AND THE ADMINISTRATION'S ANSWER IS THE VISITOR'S WITH ONE KEY ADDED PER RECORD,
	 * which is the half no check on a name can measure.
	 *
	 * <p>The same sentence {@code theVisitorsAnswerHasNotMoved} holds from the other
	 * end: it keeps the number of records, their order and every other value in them,
	 * so a condition written as a join - the one shape that can give a member two rows
	 * or drop one - fails here although every name is still right. It also refuses the
	 * key arriving empty rather than absent for everybody else, because what is cut out
	 * is built from the values the answer itself carries.
	 *
	 * <p><b>All of the administration are asked, and ONE of them is on the list</b>, so
	 * his own record carries the two fields a member is answered about himself on top of
	 * the basis. Those are cut too, and only off the record that really carries them:
	 * until 21.09.2026 no administration account had a row here at all, and the sentence
	 * „neither of them races for anybody on the list" read as a convenience of the
	 * fixture when it was in fact the one state this case never entered.
	 *
	 * <p>What is cut is built out of the values the answer itself carries and the key is
	 * looked for rather than remembered, so nothing here is a number somebody wrote down.
	 * The count below says the branch really fired: without it, a resource that stopped
	 * answering the caller his own two fields would make this case pass by having less to
	 * cut.
	 */
	@Test
	void theAdministrationsAnswerIsTheVisitorsWithTheBasisAdded() throws Exception {
		int ownRecordsCut = 0;

		for (String administration : THE_ADMINISTRATION) {
			String whole = whole(administration);

			for (JsonNode one : answerFor(administration)) {
				whole = whole.replace(",\"" + HOW_THE_MEMBERSHIP_IS_HELD + "\":\""
						+ one.path(HOW_THE_MEMBERSHIP_IS_HELD).asString() + "\"", "");

				if (Answers.fieldsOf(one).contains(THE_REFERRAL_CODE)) {
					whole = whole.replace(",\"" + THE_REFERRAL_CODE + "\":\""
							+ one.path(THE_REFERRAL_CODE).asString() + "\",\""
							+ THE_COUNT_SHE_BROUGHT_IN + "\":"
							+ one.path(THE_COUNT_SHE_BROUGHT_IN).asInt(), "");
					ownRecordsCut++;
				}
			}

			/* AND THE PORTRAITS ARE BLANKED ON BOTH SIDES, because the administration is
			   signed in and a hidden member's portrait therefore reaches it (26.09.2026).
			   Blanked and not ignored: `withoutAnyPortrait` counts one per record. */
			int records = answerFor(null).size();

			assertThat(withoutAnyPortrait(whole, records, administration))
					.as("%s was answered something other than the visitor's answer with the basis"
							+ " added: the list itself moved, or a key nobody named arrived with"
							+ " it", administration)
					.isEqualTo(withoutAnyPortrait(whole(null), records, "a visitor"));
		}

		assertThat(ownRecordsCut)
				.as("no administration account was answered a record of its own, so this case"
						+ " never entered the state it was rewritten for and the branch above cut"
						+ " nothing")
				.isEqualTo(1);
	}

	/**
	 * AND THE ADMINISTRATION'S RECORD CARRIES NOTHING NOBODY NAMED EITHER.
	 *
	 * <p>The same floor the visitor's answer and the member's own record stand on,
	 * moved onto the third audience - and onto BOTH records the third audience sees,
	 * which is the half that was missing until 21.09.2026.
	 *
	 * <ul>
	 * <li><b>Somebody else's record.</b> Three of the five names are still omissions
	 * there - the age band because it is owed, the referrer's code because the count
	 * replaces it, the fee flag because he is on the list at all - and the referral
	 * code is one too, because this caller is not the member whose row it is. It is
	 * asked of the FIRST record, which {@code Answers} reads, so the case says out
	 * loud that the first record is nobody's own.</li>
	 * <li><b>His OWN record</b>, which exists because one administration account is a
	 * member whose fee is standing. There the referral code and the count are not
	 * omissions at all but the two fields his row is entitled to, exactly as
	 * {@code theMembersOwnRecordCarriesNothingNobodyNamed} holds them, and the basis
	 * is answered on top. Written the other way round - his own two fields named as
	 * left out - this case would fail the day the resource started behaving
	 * correctly.</li>
	 * </ul>
	 */
	@Test
	void theAdministrationsRecordCarriesNothingNobodyNamed() throws Exception {
		String somebodyElses = answerFor(THE_MODERATOR_OVER_THE_MEMBERS).get(0)
				.path("memberNumber").asString();

		assertThat(db.sql("select count(*) from account where competitor_id ="
						+ " (select id from competitor where member_number = ?)")
				.param(somebodyElses).query(Integer.class).single())
				.as("the first record of the answer (%s) belongs to an account after all, so the"
						+ " floor below is not asked of somebody else's record", somebodyElses)
				.isZero();

		Answers.everyFieldThePortalReadsIsAnswered(
				"/api/competitors asked by a moderator over the members",
				answerFor(THE_MODERATOR_OVER_THE_MEMBERS), "competitors.json",
				Set.of(THE_PORTRAIT, THE_SQUARE_OF_IT),
				THE_REFERRAL_CODE,
				WHO_HANDED_OUT_THE_CODE, WHETHER_THE_FEE_IS_STANDING);

		Answers.everyFieldThePortalReadsIsAnswered(
				"/api/competitors asked by a moderator over the members, on his own record",
				new ObjectMapper().createArrayNode().add(
						recordOf(THE_ADMINISTRATOR_ON_THE_LIST, hisMemberNumber())),
				"competitors.json",
				Set.of(THE_COUNT_SHE_BROUGHT_IN, THE_PORTRAIT, THE_SQUARE_OF_IT),
				WHO_HANDED_OUT_THE_CODE,
				WHETHER_THE_FEE_IS_STANDING);
	}

	/** The member behind the one administration account whose row is on the list. */
	private String hisMemberNumber() {
		return db.sql("select member_number from competitor where id ="
						+ " (select competitor_id from account where email = ?)")
				.param(THE_ADMINISTRATOR_ON_THE_LIST).query(String.class).single();
	}

	/**
	 * AND THE ADMINISTRATION'S OWN ROW CARRIES THE BASIS LIKE EVERY OTHER, WITH HIS OWN
	 * TWO FIELDS ON TOP.
	 *
	 * <p><b>This is the second state of „whose row is this" and the one that was
	 * missing.</b> PDL P8 gives the basis to the administration over „svi clanovi" and
	 * the condition in the query is the CALLER and never the row, so the caller's own row
	 * is not an exception to it. Until 21.09.2026 no case could say so: the two
	 * administration accounts were a member whose fee had lapsed and a moderator who
	 * races for nobody, so a resource written as {@code c.id is distinct from :me} - the
	 * whole list except the one asking - left all 21 cases green. A moderator over the
	 * members who is himself a member would have seen every row's basis but his own.
	 *
	 * <p><b>And his own row is a member's row as well, so it carries the referral code
	 * and the count too.</b> They are answered on the caller's own row whoever the caller
	 * is; holding the right adds a field, it does not take two away. Both are compared by
	 * VALUE against what the database holds for HIM, so a code or a count arriving from
	 * another row is a different string and a different number.
	 *
	 * <p><b>Every value this case reads is separated from a second source it could have
	 * come from</b>, and each separation is asserted rather than arranged and forgotten:
	 * his basis against a row that is held on another one, his count against a member who
	 * brought in a different number, and his record against the first and the last of the
	 * answer.
	 */
	@Test
	void theAdministratorsOwnRowCarriesTheBasisLikeEveryOther() throws Exception {
		String number = hisMemberNumber();
		List<String> list = StreamSupport.stream(answerFor(THE_ADMINISTRATOR_ON_THE_LIST)
				.spliterator(), false).map(one -> one.path("memberNumber").asString()).toList();

		assertThat(list).as("the administrator's own row is not on the list at all, so this case"
				+ " measures the same state the other two administration accounts do")
				.contains(number);
		assertThat(List.of(list.getFirst(), list.getLast()))
				.as("the administrator's own row is the first or the last record of the answer,"
						+ " so a resource answering the record at either edge would pass for his")
				.doesNotContain(number);

		String hisBasis = db.sql("select membership_basis from competitor where member_number = ?")
				.param(number).query(String.class).single();
		assertThat(db.sql("select count(*) from competitor where active and membership_basis <> ?")
				.param(hisBasis).query(Integer.class).single())
				.as("every other row on the list is held on the same basis as his (%s), so his own"
						+ " row carrying another row's word would read the same", hisBasis)
				.isGreaterThan(0);

		int hisCount = db.sql("select count(*) from competitor brought where brought.active"
						+ " and brought.referred_by = (select id from competitor"
						+ " where member_number = ?)").param(number).query(Integer.class).single();
		assertThat(db.sql("select count(*) from competitor c where c.active and ? <> (select"
						+ " count(*) from competitor brought where brought.active"
						+ " and brought.referred_by = c.id)")
				.param(hisCount).query(Integer.class).single())
				.as("every member on the list brought in as many as he did (%s), so his count"
						+ " arriving from another row would be the same number", hisCount)
				.isGreaterThan(0);

		JsonNode his = recordOf(THE_ADMINISTRATOR_ON_THE_LIST, number);

		assertThat(his.path(HOW_THE_MEMBERSHIP_IS_HELD).asString())
				.as("the administration was answered every basis but its own, or its own row was"
						+ " handed the word standing on another row")
				.isEqualTo(hisBasis);
		assertThat(his.path(THE_REFERRAL_CODE).asString())
				.as("the administration's own row lost the referral link it would have had"
						+ " without the right, or was handed a link off another row")
				.isEqualTo(db.sql("select referral_code from competitor where member_number = ?")
						.param(number).query(String.class).single());
		assertThat(his.path(THE_COUNT_SHE_BROUGHT_IN).asInt())
				.as("the administration's own row lost the count it would have had without the"
						+ " right, or was handed a count off another row")
				.isEqualTo(hisCount);

		assertThat(StreamSupport.stream(answerFor(THE_ADMINISTRATOR_ON_THE_LIST).spliterator(),
						false).filter(one -> Answers.fieldsOf(one).contains(THE_REFERRAL_CODE))
				.map(one -> one.path("memberNumber").asString()).toList())
				.as("a record other than the administration's own carries the referral code key;"
						+ " holding the right over the members is not what makes a link his")
				.containsExactly(number);
	}

	/**
	 * THE RIGHT THIS RESOURCE ASKS FOR IS ONE THE MATRIX REALLY HOLDS.
	 *
	 * <p><b>A floor and not a spelling check.</b> {@code RightIsNeeded} writes out what
	 * a misspelt right costs: every moderator is refused it and the SUPERADMIN is let
	 * through, because his mode answers yes to any string there is. So a typo here is a
	 * door that reads shut in every case written with a moderator and stands open for
	 * the one account that can do the most damage.
	 *
	 * <p><b>It is asked of {@code admin_right} because the annotations' own floor
	 * cannot see this one.</b> {@code everyRightARouteAsksForIsOneTheMatrixHolds} reads
	 * what the dispatcher declares; this route declares nothing, because it is open to
	 * everybody and only one field of its answer is guarded.
	 */
	@Test
	void theRightThisResourceAsksForIsOneTheMatrixHolds() {
		List<String> held = db.sql("select code from admin_right").query(String.class).list();

		assertThat(held).as("the matrix holds no rights at all, so anything would be in it")
				.isNotEmpty();

		assertThat(held)
				.as("this resource guards its field with a right the matrix does not hold; every"
						+ " moderator is refused it and the superadmin is let through, because his"
						+ " mode answers yes to any string there is")
				.contains(CompetitorApi.OVER_THE_MEMBERS);
	}

	/**
	 * AND EVERY ACCOUNT IN THE FIXTURE IS ON ONE SIDE OF THAT LINE OR THE OTHER.
	 *
	 * <p><b>The floor under the two lists at the head of this class</b>, and the reason
	 * they may be written by hand at all: what an account IS cannot be read back, but
	 * WHICH accounts exist can. A sixth added tomorrow has to be put on a side, and
	 * until it is, this case says so instead of the two lists quietly measuring four
	 * callers out of five.
	 */
	@Test
	void everyAccountInTheFixtureIsOnOneSideOfTheLineOrTheOther() {
		List<String> split = new java.util.ArrayList<>(THE_ADMINISTRATION);
		NOBODY_WHO_MAY_READ_THE_BASIS.stream().filter(one -> one != null).forEach(split::add);

		assertThat(db.sql("select email from account").query(String.class).list())
				.as("an account in the fixture is on neither side of the line PDL P8 draws, so"
						+ " nothing measures what this resource answers it")
				.containsExactlyInAnyOrderElementsOf(split);
	}

	/**
	 * THE BANDS THE RULEBOOK HAS, READ OFF THE RULEBOOK'S OWN LIST.
	 *
	 * <p>Derived from {@link Category.AgeBand} rather than written out again, so the two
	 * cannot drift: a fifth band added to the league arrives here without anybody
	 * remembering this file, and a band renamed breaks the cases below rather than
	 * quietly widening them.
	 */
	private static final Set<String> THE_BANDS_THE_RULEBOOK_HAS =
			Arrays.stream(Category.AgeBand.values()).map(Category.AgeBand::code)
					.collect(Collectors.toUnmodifiableSet());

	/**
	 * EVERY MEMBER IS ANSWERED THE BAND HIS OWN DATE OF BIRTH PUTS HIM IN.
	 *
	 * <p><b>The four expected values are written out rather than worked out</b>, and
	 * that is the whole point of the case. Asking {@code Category.ageBandFor} for the
	 * expectation would compare the server's arithmetic with itself and pass whatever
	 * that arithmetic became; these four are read off the rulebook by hand, against the
	 * dates the fixture writes, and they are what makes the case able to disagree.
	 *
	 * <p><b>And no two of them are the same</b>, so the axis is separated the way every
	 * other axis in this fixture is: all four bands the league has appear exactly once,
	 * so a server answering a constant, or the wrong column, or the same band twice, is
	 * a different list rather than the same one.
	 *
	 * <p>The arithmetic each one stands on, for the season 2027 (the clock stands in
	 * 2026 and the floor lifts it - see {@code AUTUMN_2026}): 000007 was born in 1991
	 * and is 36, 000012 in 1968 and is 59, 000023 in 1985 and is 42, 000045 in 2007 and
	 * is 20.
	 */
	@Test
	void everyMemberIsAnsweredTheBandHisDateOfBirthPutsHimIn() throws Exception {
		assertThat(bands())
				.as("a member is answered a band other than the one the rulebook puts him in")
				.containsExactly(Map.entry("000007", "25-39"), Map.entry("000012", "55+"),
						Map.entry("000023", "40-54"), Map.entry("000045", "24-"));
	}

	/**
	 * AND IT IS A BAND, NEVER THE FINISHED CATEGORY CODE.
	 *
	 * <p>PDL, 13.09.2026: the served record carries „pojas a ne gotovu šifru, da pol ne
	 * bi bio zapisan dvaput". {@code Category} can answer either - {@code ageBandFor}
	 * gives the band and {@code codeFor} the code with the sex on the front - and the
	 * two are one word apart at the call site, so which one leaves the server is
	 * measured here rather than trusted.
	 *
	 * <p><b>The mark is asked of {@code Category.genderMark} rather than written out</b>,
	 * so a league that renamed its marks tomorrow is still measured, and {@code Ž} does
	 * not sit in this file as a letter somebody may quietly change.
	 */
	@Test
	void theBandIsTheRulebooksAndCarriesNoMarkOfSex() throws Exception {
		Map<String, String> bands = bands();

		assertThat(bands).as("no bands came back, so nothing below is asked of anything")
				.hasSize(4);

		assertThat(bands.values())
				.as("a band left the server that the rulebook does not have")
				.allSatisfy(band -> assertThat(THE_BANDS_THE_RULEBOOK_HAS).contains(band));

		assertThat(bands.values())
				.as("the finished category code left the server instead of the band, so the sex"
						+ " is written twice in one record")
				.allSatisfy(band -> assertThat(band)
						.doesNotStartWith(Category.genderMark("M"))
						.doesNotStartWith(Category.genderMark("F")));
	}

	/**
	 * THE SEX DOES NOT CHANGE THE BAND, and two members born on one day prove it.
	 *
	 * <p>The bands are the same four for everybody; what differs by sex is the MARK in
	 * front of the code, and that mark is the screen's ({@code categoryCodeFor}) and not
	 * this resource's. So the axis here is not „the two answers differ" but the opposite:
	 * a server that reached for {@code codeFor}, or that let the sex into the
	 * arithmetic at all, answers these two differently and fails.
	 *
	 * <p>Both are written here rather than taken from the fixture, because no two members
	 * of the fixture share a year of birth - that separation is what makes its own axes
	 * work, and it is exactly what this question needs undone.
	 *
	 * <p><b>AND BOTH PAIRS SIT ON A BOUNDARY, WHICH IS THE WHOLE OF WHY THIS CASE
	 * MEASURES ANYTHING.</b> It was written first with a single pair born in 1990 and it
	 * asserted NOTHING: a mutation that let the sex into the arithmetic - a year added to
	 * a woman's - was run before the reviewer was called and passed all thirty cases
	 * green. Born in 1990 a member is 37 in 2027 and 36 with the mutation, and both are
	 * the same band, so right and wrong gave one answer. The pairs are therefore chosen
	 * so that ONE year in either direction crosses a boundary: 2002 is 25 and falls to
	 * {@code 24-} if a year is added, 2003 is 24 and rises to {@code 25-39} if one is
	 * taken away. A shift of either sign is now a different band for the woman and the
	 * case fails.
	 */
	@Test
	void theSexDoesNotChangeTheBand() throws Exception {
		aMemberBornOn("000104", "2002-06-15", "M");
		aMemberBornOn("000105", "2002-06-15", "F");
		aMemberBornOn("000106", "2003-06-15", "M");
		aMemberBornOn("000107", "2003-06-15", "F");

		Map<String, String> bands = bands();

		assertThat(bands.get("000105"))
				.as("a woman born on the same day as a man is answered a different band, so the"
						+ " sex is reaching arithmetic that has no business knowing it")
				.isEqualTo(bands.get("000104"))
				.isEqualTo("25-39");

		assertThat(bands.get("000107"))
				.as("the same, on the other side of the boundary, which is what catches a shift"
						+ " in the opposite direction")
				.isEqualTo(bands.get("000106"))
				.isEqualTo("24-");
	}

	/**
	 * THE BAND TURNS ON NEW YEAR AND NEVER ON A BIRTHDAY.
	 *
	 * <p>PDL P7 and {@code Category}: „uzrast se utvrđuje jednom, na 1. januar sezone",
	 * changed from the 2017 rulebook where the band moved on the birthday itself and took
	 * that season's points with it. So the boundary this case stands on is the turn of a
	 * YEAR of birth and not a day in a year, and it is asked from both sides at once:
	 *
	 * <ul>
	 * <li><b>One day apart, two bands.</b> 31 December 2002 and 1 January 2003 are a day
	 * apart and are 25 and 24 in 2027, so they are answered different bands. A server
	 * that worked the age out from the DATE - the age somebody has reached on the day of
	 * the answer - puts both in the same band and fails here.</li>
	 * <li><b>Eleven months apart, one band.</b> 1 January 2003 and 31 December 2003 are
	 * nearly a year apart and are both 24, so they are answered the SAME band. This is
	 * the half that fails if the day is allowed into the arithmetic at all, and it is
	 * the half a boundary case usually leaves out.</li>
	 * </ul>
	 */
	@Test
	void theBandTurnsOnNewYearAndNeverOnABirthday() throws Exception {
		aMemberBornOn("000101", "2002-12-31", "M");
		aMemberBornOn("000102", "2003-01-01", "M");
		aMemberBornOn("000103", "2003-12-31", "M");

		Map<String, String> bands = bands();

		assertThat(bands.get("000101"))
				.as("a day either side of New Year was answered as one band, so the band is being"
						+ " worked out from the date rather than from the year")
				.isEqualTo("25-39");
		assertThat(bands.get("000102")).as("the first day of a year is in the wrong band")
				.isEqualTo("24-");
		assertThat(bands.get("000103"))
				.as("two members born in one year are in different bands, so the day of the year"
						+ " is reaching the arithmetic")
				.isEqualTo(bands.get("000102"));
	}

	/**
	 * AND IT MOVES WITH THE SEASON THAT IS RUNNING, at all three boundaries at once.
	 *
	 * <p>Three members, each one year short of a different boundary, so moving the clock
	 * on by a season moves all three and moves each into a DIFFERENT band. A server that
	 * worked the band out for a season written down as a constant - which is what the
	 * generator of the served file does, and it is named as a boundary on
	 * {@code CompetitorApi} - answers the first list twice and fails the second.
	 *
	 * <p><b>Both states of the axis are here</b>, which is what makes it an axis: the
	 * season is read once with 2027 running and once with 2028 running, and a resource
	 * that ignores the clock cannot tell them apart.
	 *
	 * <p><b>AND THE SECOND OF THE TWO IS A NEW YEAR'S NIGHT, WHICH IS WHAT MAKES THE ZONE
	 * MEASURED RATHER THAN BELIEVED.</b> This is the shape {@code ResultApiTest} carries -
	 * a fake clock reporting UTC standing at {@code 2027-12-31T23:30:00Z}, which is already
	 * 2028 in Belgrade - and the shape was copied here on 21.09.2026 WITHOUT that moment,
	 * so {@code clock.withZone(SeasonClock.ZONE)} could be dropped from
	 * {@code CompetitorApi.theBandsSeason} with the whole package staying green. Standing
	 * on the boundary, dropping it answers 2027 and all three members below come back a
	 * band short.
	 *
	 * <p><b>The floor asks the clock rather than remembering that it reports UTC.</b>
	 * Moved off the boundary, or handed a clock already keeping the league's own time, this
	 * case would quietly go back to measuring only that the year moved - which is what it
	 * did until today - and the floor says so instead of passing.
	 */
	@Test
	void theBandMovesWithTheSeasonThatIsRunning() throws Exception {
		aMemberBornOn("000111", "2003-06-01", "M");
		aMemberBornOn("000112", "1988-06-01", "M");
		aMemberBornOn("000113", "1973-06-01", "M");

		clock.moveTo(DURING_2027);
		assertThat(bands())
				.as("the bands for the season 2027 are not the ones the rulebook gives")
				.contains(Map.entry("000111", "24-"), Map.entry("000112", "25-39"),
						Map.entry("000113", "40-54"));

		assertThat(NEW_YEARS_NIGHT_INTO_2028.atZone(clock.getZone()).getYear())
				.as("the server's clock already reads this moment in the league's own year, so"
						+ " the list below is answered the same whether the resource re-reads"
						+ " the zone or not and the zone is not measured anywhere in this file")
				.isNotEqualTo(NEW_YEARS_NIGHT_INTO_2028.atZone(SeasonClock.ZONE).getYear());

		clock.moveTo(NEW_YEARS_NIGHT_INTO_2028);
		assertThat(bands())
				.as("a season went by and nobody changed band, so the band is worked out for a"
						+ " season fixed in the code - or read in the server's own zone, which on"
						+ " this night is still the season that has just ended")
				.contains(Map.entry("000111", "25-39"), Map.entry("000112", "40-54"),
						Map.entry("000113", "55+"));
	}

	/**
	 * BUT NEVER FOR A SEASON THE LEAGUE DOES NOT HAVE.
	 *
	 * <p>The league begins in 2027 (PDL P2) and the calendar through 2026 answers 2026,
	 * so the plain calendar year names a season that does not exist and a band worked out
	 * for it is a band for nothing. {@code theBandsSeason} lifts it, the same
	 * {@code Math.max} shape {@code frontend/src/data/season.ts} uses.
	 *
	 * <p><b>The member is chosen so that the floor is the only thing between two
	 * answers.</b> Born in 2002, he is 24 in 2026 and 25 in 2027 - one on each side of a
	 * boundary - so dropping the floor does not merely name a different number, it
	 * answers a different band. Without him the whole fixture would pass either way,
	 * which is how a floor gets deleted in a tidy-up.
	 */
	@Test
	void theBandIsNeverWorkedOutForASeasonTheLeagueDoesNotHave() throws Exception {
		aMemberBornOn("000114", "2002-06-01", "M");

		assertThat(SeasonClock.FIRST_SEASON)
				.as("the league's first season moved, so the clock below no longer stands before"
						+ " it and this case measures nothing")
				.isGreaterThan(AUTUMN_2026.atZone(SeasonClock.ZONE).getYear());

		assertThat(bands().get("000114"))
				.as("the band was worked out for the calendar year 2026, a season the league does"
						+ " not have, instead of for its first")
				.isEqualTo("25-39");
	}

	/**
	 * AND IT DOES NOT MOVE WHEN THE NEXT SEASON GOES ON SALE.
	 *
	 * <p>From 1 October the transfer window opens and {@code SeasonClock.seasonBeingPaidFor}
	 * begins answering with NEXT year, because that is the membership somebody is buying.
	 * The band is not that question: it moves once, on 1 January (PDL P7). A resource
	 * that reached for the renewal screen's clock would move every member forward a band
	 * for the last three months of every year, without a single birthday.
	 *
	 * <p><b>The floor asks {@code SeasonClock} itself rather than remembering.</b> The
	 * two functions agree for nine months of the year, so a case standing on the wrong
	 * day would pass whichever of them the resource used - which is exactly how this
	 * mutation survived 1540 cases in {@code ResultApiTest} until 13.09.2026.
	 */
	@Test
	void aBandDoesNotMoveWhenTheNextSeasonGoesOnSale() throws Exception {
		aMemberBornOn("000115", "1988-06-01", "M");

		assertThat(SeasonClock.seasonBeingPaidFor(MID_OCTOBER_2027.atZone(SeasonClock.ZONE)))
				.as("the season being paid for and the season being run agree at this moment, so"
						+ " swapping one for the other cannot be seen and this case measures nothing")
				.isEqualTo(2028);

		clock.moveTo(MID_OCTOBER_2027);

		assertThat(bands().get("000115"))
				.as("the band moved because the NEXT season went on sale, so the resource is"
						+ " reading the renewal screen's question instead of the running season")
				.isEqualTo("25-39");
	}

	/**
	 * AND EVERYBODY IS ANSWERED THE SAME BANDS, whoever they are.
	 *
	 * <p>Article 74 makes the category public, so it is not one of the fields this
	 * resource hands to some callers and withholds from others. All seven ways of asking
	 * in this fixture - the visitor, three members, an account that races for nobody, a
	 * moderator over the members and the superadmin - must come back with one and the
	 * same map.
	 *
	 * <p><b>The list of callers is the fixture's own two</b>, which
	 * {@code everyAccountInTheFixtureIsOnOneSideOfTheLineOrTheOther} holds to be exactly
	 * the accounts in the database. So an eighth account added tomorrow is measured here
	 * without anybody remembering this case.
	 *
	 * <p><b>The floor is over the BANDS and not over the number of records</b>, which is
	 * the same difference {@code everyMemberIsAnsweredTheBandHisDateOfBirthPutsHimIn}
	 * rests on. {@code bandsIn} keys the map by member number, so counting it counts
	 * records: until 21.09.2026 this floor read {@code hasSize(4)} while claiming to
	 * refuse an answer that carries no bands, and a server handing every record ONE
	 * constant band satisfied both it and every comparison below. Review measured that
	 * mutation failing eight cases in this file and NOT this one. What the comparisons
	 * need is an answer that can disagree, so that is what is asked for.
	 */
	@Test
	void everybodyIsAnsweredTheSameBands() throws Exception {
		Map<String, String> asAVisitor = bands();

		assertThat(asAVisitor.values())
				.as("a record came back carrying something that is not a band of the rulebook's,"
						+ " so what the callers below are compared against is an absence rather"
						+ " than the category Clan 74 makes public")
				.isNotEmpty()
				.allSatisfy(band -> assertThat(THE_BANDS_THE_RULEBOOK_HAS).contains(band));

		assertThat(Set.copyOf(asAVisitor.values()))
				.as("every record is answered one and the same band, so a server handing"
						+ " everybody a constant satisfies every comparison below and this case"
						+ " measures nothing but that the constant is the same constant")
				.hasSizeGreaterThan(1);

		List<String> everybody = new java.util.ArrayList<>(THE_ADMINISTRATION);
		NOBODY_WHO_MAY_READ_THE_BASIS.stream().filter(one -> one != null).forEach(everybody::add);

		for (String email : everybody) {
			assertThat(bandsIn(answerFor(email)))
					.as("%s is answered different bands from a visitor, and the category is public"
							+ " to everybody (Clan 74)", email)
					.isEqualTo(asAVisitor);
		}
	}

	/** The band on every record of an answer, by member number and in the answer's order. */
	private Map<String, String> bandsIn(JsonNode answered) {
		Map<String, String> bands = new LinkedHashMap<>();
		answered.forEach(one ->
				bands.put(one.path("memberNumber").asString(), one.path(THE_AGE_BAND).asString()));

		return bands;
	}

	private Map<String, String> bands() throws Exception {
		return bandsIn(answer());
	}

	/**
	 * A MEMBER WHO IS ORDINARY IN EVERY WAY EXCEPT THE DAY HE WAS BORN.
	 *
	 * <p>Added inside a case rather than to the fixture on purpose: the fixture's own
	 * floor counts the distinct years and days of birth in the table
	 * ({@code noYearOfBirthLeavesTheServer}), and every case here rolls back, so a member
	 * written for one question never reaches another.
	 *
	 * <p>His referral code is built from his number so that two of them cannot collide,
	 * which the schema refuses outright.
	 */
	private void aMemberBornOn(String number, String born, String gender) {
		member(number, "Ime" + number, "Prezime" + number, gender, born,
				"(select id from place where rank = 1)", "null", "null",
				2020, false, true, "payment", "", "a0b1c2d3e4f5" + number.substring(2), "null",
				false, "none");
	}

	/**
	 * A CLOCK THE CASE MOVES, because the band turns on a boundary in time.
	 *
	 * <p>Copied in shape from {@code ResultApiTest}, including the reason it reports UTC:
	 * whoever asks what season it is has to re-read the instant in the league's own time,
	 * and a server that reads this zone instead answers 2027 on a night that is already
	 * 2028 in Belgrade.
	 *
	 * <p><b>That night is {@link #NEW_YEARS_NIGHT_INTO_2028}, and it is named here because
	 * the sentence above arrived without it.</b> A zone reported by a fake clock is not a
	 * measurement on its own: every moment this file stood on read the same year in both
	 * zones, so the sentence was true of the portal and untrue of the cases until
	 * {@code theBandMovesWithTheSeasonThatIsRunning} was moved onto the boundary.
	 */
	static final class AClockTheCaseMoves extends Clock {

		private Instant now;

		private AClockTheCaseMoves(Instant now) {
			this.now = now;
		}

		void moveTo(Instant when) {
			this.now = when;
		}

		@Override
		public Instant instant() {
			return now;
		}

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return Clock.fixed(now, zone);
		}
	}

	/** And it stands in for the server's own clock, which is the point of that bean. */
	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockTheseCasesUse {

		@Bean
		@Primary
		AClockTheCaseMoves aClockTheCaseMoves() {
			return new AClockTheCaseMoves(AUTUMN_2026);
		}

	}

}
