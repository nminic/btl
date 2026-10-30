package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.payment.IpsSlip;
import com.btl.portal.domain.payment.ReadingTheCode;
import com.btl.portal.domain.token.SecretToken;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import jakarta.mail.BodyPart;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mail.MailSendException;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * THE LETTER AFTER A CONFIRMED ADDRESS, END TO END: through both doors that confirm one, against a
 * real database and a real mail server.
 *
 * <p>The owner, 23.10.2026 (PDL „Poruka posle potvrde adrese i rok nedovršene registracije") and
 * 24.10.2026. Every case here walks a request through {@code EmailConfirmationApi} or
 * {@code PasswordResetApi} and reads what the mail server received, because what decides the letter
 * is spread over the account, the member, his country, his book, his membership and the price list,
 * and a case that asked {@link TheLetterAfterTheAddress} directly would skip the one thing the
 * routes add: that it is sent only by the request that confirmed the address.
 *
 * <p><b>THE AMOUNTS ARE READ OFF THE PRICE LIST AND NOT TYPED HERE</b>, and that is not taking the
 * class's word for them: the price list is read with a query of this file's own, and the case puts
 * the number it reads next to what the letter says. Where a case needs a price that tells two rules
 * apart, it sets one in its own transaction.
 *
 * <p><b>THE OTHER SOURCE OF EACH VALUE IS IN THE FIXTURE, SO A SWAP SHOWS.</b> A member from Serbia
 * and one from abroad live in two countries; the member with a balance has one that is not his
 * whole fee; the junior's price differs from the adult's; every member is not the first row of
 * anything; and a second member is confirmed beside the first in the cases that count letters.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, TheLetterAfterTheAddressTest.TheClockThisFileUses.class})
@TestPropertySource(properties = {
		"spring.mail.host=127.0.0.1",
		"spring.mail.port=3336",
		"spring.mail.properties.mail.smtp.auth=false",
		"btl.portal.address=https://probni-portal.primer.rs"})
@Transactional
class TheLetterAfterTheAddressTest {

	@RegisterExtension
	static final GreenMailExtension SMTP = new GreenMailExtension(MailServerForACase.on(3336));

	/** 20 October 2026: past the fifteenth, so the season on sale is 2027 (PDL 30.07.2026). */
	private static final Instant NOW = Instant.parse("2026-10-20T09:00:00Z");

	private static final int ON_SALE = 2027;

	/** The day of the year the price list is asked about, as V4 writes its periods. */
	private static final String THE_DAY = "11-11";

	private static final String NEW_PASSWORD = "trcim.kroz.sumu.2027";

	private static final String A_TOWN_IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	private static final String A_TOWN_ABROAD = "(select id from place where rank = 1)";

	private static final String THE_MODERATOR = "blagajnik-pisma@primer.rs";

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisFileUses {

		@Bean
		@Primary
		Clock aDayAfterTheSaleOpened() {
			return Clock.fixed(NOW, ZoneOffset.UTC);
		}
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@MockitoSpyBean
	private com.btl.portal.mail.Postman postman;

	private int issued;

	@BeforeEach
	void somebodyElseFirstAndAModeratorToRecordTheBook() {
		/* NOBODY A CASE ASKS ABOUT IS THE FIRST ROW OF ANYTHING. */
		aMember("prvi-u-tabeli@primer.rs", A_TOWN_IN_SERBIA, "1990-01-01", true);

		db.sql("insert into account (first_name, last_name, email, role_id, email_confirmed_at)"
						+ " values ('Probni', 'Blagajnik', ?, (select id from role where code = 'moderator'), now())")
				.param(THE_MODERATOR).update();
	}

	/** A member with an unconfirmed account, his password set or not, and the account's key. */
	private long aMember(String email, String town, String born, boolean withAPassword) {
		long member = db.sql("insert into competitor (first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, active,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values ('Probni', 'Clan', 'M', cast(? as date), " + town + ", 2027, false,"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.params(born, String.format("%016x", 0x5eedL * 1000 + ++issued))
				.query(Long.class).single();

		return db.sql("insert into account (first_name, last_name, email, role_id, competitor_id,"
						+ " password_hash) values ('Probni', 'Clan', ?, (select id from role where code ="
						+ " 'competitor'), ?, ?) returning id")
				.params(email, member, withAPassword ? "{bcrypt}$2a$10$abcdefghijklmnopqrstuv" : null)
				.query(Long.class).single();
	}

	private long memberOf(long account) {
		return db.sql("select competitor_id from account where id = ?").param(account).query(Long.class).single();
	}

	private String aConfirmationLink(long account) {
		SecretToken token = SecretToken.fresh();

		db.sql("insert into email_verification_token (account_id, token_hash) values (?, ?)")
				.params(account, token.hash()).update();

		return token.secret();
	}

	private String aPasswordLink(long account) {
		SecretToken token = SecretToken.fresh();

		db.sql("insert into password_reset_token (account_id, token_hash) values (?, ?)")
				.params(account, token.hash()).update();

		return token.secret();
	}

	private int confirm(String token) throws Exception {
		return http.perform(post("/api/email-confirmation").with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
				.andReturn().getResponse().getStatus();
	}

	private int reset(String token) throws Exception {
		return http.perform(post("/api/password-reset").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"token\":\"" + token + "\",\"password\":\"" + NEW_PASSWORD
								+ "\",\"passwordRepeat\":\"" + NEW_PASSWORD + "\"}"))
				.andReturn().getResponse().getStatus();
	}

	private BigDecimal thePriceList(String column, String where) {
		return db.sql("select " + column + " from price_row where " + where)
				.query(BigDecimal.class).single();
	}

	private BigDecimal thePeriodInDinars() {
		return thePriceList("rsd", "kind = 'period' and day_from <= '" + THE_DAY + "' and day_to >= '"
				+ THE_DAY + "'");
	}

	private void thePeriodCosts(String eur, String rsd) {
		db.sql("update price_row set eur = cast(? as numeric), rsd = cast(? as numeric)"
						+ " where kind = 'period' and day_from <= ? and day_to >= ?")
				.params(eur, rsd, THE_DAY, THE_DAY).update();
	}

	/** A referral on his book of {@code amount} in dinars, naming a newcomer of its own. */
	private void onHisBook(long account, String amount) {
		long newcomer = memberOf(aMember("doveden-" + ++issued + "@primer.rs", A_TOWN_IN_SERBIA, "1990-01-01",
				true));

		db.sql("insert into balance_entry (competitor_id, amount, currency, reason,"
						+ " referred_competitor_id, occurred_at, recorded_by, recorded_by_name)"
						+ " values (?, cast(? as numeric), 'RSD', 'referral', ?, ?,"
						+ " (select id from account where email = ?), 'Blagajnik Probni')")
				.params(memberOf(account), amount, newcomer, Timestamp.from(NOW.minusSeconds(86_400)),
						THE_MODERATOR)
				.update();
	}

	private List<MimeMessage> theLettersTo(String address) {
		SMTP.waitForIncomingEmail(1500, 99);

		List<MimeMessage> to = new ArrayList<>();

		for (MimeMessage one : SMTP.getReceivedMessages()) {
			try {
				if (one.getAllRecipients()[0].toString().equals(address)) {
					to.add(one);
				}
			} catch (jakarta.mail.MessagingException unreadable) {
				throw new IllegalStateException(unreadable);
			}
		}

		return to;
	}

	private MimeMessage theOnlyLetterTo(String address) {
		List<MimeMessage> letters = theLettersTo(address);

		assertThat(letters).as("%s was sent %d letters, not one", address, letters.size()).hasSize(1);

		return letters.get(0);
	}

	/** The words of a letter, and the file beside them if there is one. */
	private record Opened(String subject, String text, byte[] file, String fileName) {
	}

	private static Opened opened(MimeMessage letter) throws Exception {
		Object content = letter.getContent();

		if (!(content instanceof Multipart parts)) {
			return new Opened(letter.getSubject(), content.toString(), null, null);
		}

		String text = null;
		byte[] file = null;
		String name = null;

		for (int one = 0; one < parts.getCount(); one++) {
			BodyPart part = parts.getBodyPart(one);

			if (part.getContent() instanceof Multipart inner) {
				text = inner.getBodyPart(0).getContent().toString();
			} else if (Part.ATTACHMENT.equalsIgnoreCase(part.getDisposition())) {
				file = part.getInputStream().readAllBytes();
				name = part.getFileName();
			} else {
				text = part.getContent().toString();
			}
		}

		return new Opened(letter.getSubject(), text, file, name);
	}

	private static String dinars(BigDecimal amount) {
		return com.btl.portal.domain.mail.WhatTheWelcomeSays.amount(amount, "RSD",
				com.btl.portal.domain.mail.MailLanguage.SERBIAN);
	}

	// --- who is sent which letter ---

	/**
	 * B: A MEMBER FROM SERBIA IS SENT THE SLIP, AND THE CODE IN IT CARRIES WHAT THE SLIP IN WRITING
	 * SAYS, read back off the picture. The amount is the period's, with nothing on his book.
	 */
	@Test
	void aMemberFromSerbiaIsSentTheSlipAndItsCodeCarriesItsAmount() throws Exception {
		long account = aMember("iz-srbije@primer.rs", A_TOWN_IN_SERBIA, "1990-01-01", true);
		BigDecimal fee = thePeriodInDinars();

		assertThat(confirm(aConfirmationLink(account))).isEqualTo(204);

		Opened letter = opened(theOnlyLetterTo("iz-srbije@primer.rs"));

		assertThat(letter.subject()).isEqualTo("Uplatnica za članarinu za 2027. godinu");
		assertThat(letter.text())
				.contains("Iznos: " + dinars(fee))
				.contains("Račun: 105-0000000003284-71")
				.contains("Svrha uplate: Članarina za 2027. godinu")
				.contains("https://probni-portal.primer.rs/moja-clanarina");
		assertThat(letter.fileName()).isEqualTo("uplatnica-2027.png");
		assertThat(ReadingTheCode.in(letter.file()).bytes())
				.isEqualTo(IpsSlip.payload(ON_SALE, fee).getBytes(StandardCharsets.UTF_8));
	}

	/**
	 * THE BALANCE COMES OFF THE AMOUNT, IN THE WORDS AND IN THE CODE, AND IS PROMISED (owner,
	 * 26.09.2026, chosen with my recommendation: the code is minted on the amount less the balance;
	 * 27.09.2026, the first look fixes the promise).
	 * His book holds less than the fee, so the full fee and the fee less the book are two numbers.
	 */
	@Test
	void hisBalanceComesOffTheAmountInTheWordsAndInTheCodeAndIsPromised() throws Exception {
		long account = aMember("sa-balansom@primer.rs", A_TOWN_IN_SERBIA, "1990-01-01", true);
		BigDecimal fee = thePeriodInDinars();

		onHisBook(account, "600");
		assertThat(fee).isGreaterThan(new BigDecimal("600"));

		confirm(aConfirmationLink(account));

		Opened letter = opened(theOnlyLetterTo("sa-balansom@primer.rs"));
		BigDecimal less = fee.subtract(new BigDecimal("600"));

		assertThat(letter.text()).contains("Iznos: " + dinars(less));
		assertThat(ReadingTheCode.in(letter.file()).bytes())
				.isEqualTo(IpsSlip.payload(ON_SALE, less).getBytes(StandardCharsets.UTF_8));
		assertThat(db.sql("select amount || ' ' || currency from balance_promise where competitor_id = ?"
						+ " and season = ?").params(memberOf(account), ON_SALE).query(String.class).single())
				.isEqualTo("600.00 RSD");
	}

	/** A JUNIOR IS ASKED FOR THE JUNIOR PRICE, which the server knows and the page does not. */
	@Test
	void aJuniorIsAskedForTheJuniorPrice() throws Exception {
		long account = aMember("junior@primer.rs", A_TOWN_IN_SERBIA, "2013-05-01", true);
		BigDecimal junior = thePriceList("rsd", "key = 'junior'");

		assertThat(junior).as("the junior price is the adult's, so this tells nothing apart")
				.isNotEqualByComparingTo(thePeriodInDinars());

		confirm(aConfirmationLink(account));

		assertThat(opened(theOnlyLetterTo("junior@primer.rs")).text()).contains("Iznos: " + dinars(junior));
	}

	/** C: A MEMBER FROM ABROAD IS SENT PAYPAL, THE FEE IN EURO WITH THE PROCESSING FEE, AND NO FILE. */
	@Test
	void aMemberFromAbroadIsSentPayPalWithTheProcessingFeeAndNoFile() throws Exception {
		long account = aMember("iz-inostranstva@primer.rs", A_TOWN_ABROAD, "1990-01-01", true);
		BigDecimal total = thePriceList("eur", "kind = 'period' and day_from <= '" + THE_DAY
				+ "' and day_to >= '" + THE_DAY + "'").add(thePriceList("eur", "key = 'processing'"));

		confirm(aConfirmationLink(account));

		Opened letter = opened(theOnlyLetterTo("iz-inostranstva@primer.rs"));

		assertThat(letter.subject()).isEqualTo("Podaci za uplatu članarine za 2027. godinu");
		assertThat(letter.text())
				.contains("PayPal adresa: info@balkanskatrkackaliga.net")
				.contains("PayPal adresa je poslovna, na Sportsko udruženje BTL.")
				.doesNotContain("nalog")
				.contains("Iznos (sa uračunatom taksom): " + com.btl.portal.domain.mail.WhatTheWelcomeSays
						.amount(total, "EUR", com.btl.portal.domain.mail.MailLanguage.SERBIAN));
		assertThat(letter.file()).isNull();
	}

	/** D: FREED OF THE FEE FOR THE SEASON ON SALE, read off his membership of that season. */
	@Test
	void aMemberFreedOfTheSeasonOnSaleIsToldSo() throws Exception {
		long account = aMember("oslobodjen@primer.rs", A_TOWN_IN_SERBIA, "1990-01-01", true);

		db.sql("insert into membership (competitor_id, season, basis, payment_id, decided_by,"
						+ " decided_by_name, decided_at) values (?, ?, 'feeExempt', null,"
						+ " (select id from account where email = ?), 'Probni Probic', ?)")
				.params(memberOf(account), ON_SALE, THE_MODERATOR, Timestamp.from(NOW)).update();

		confirm(aConfirmationLink(account));

		Opened letter = opened(theOnlyLetterTo("oslobodjen@primer.rs"));

		assertThat(letter.subject()).isEqualTo("Član ste lige za 2027. godinu");
		assertThat(letter.text()).contains("oslobođeni ste plaćanja članarine");
		assertThat(letter.file()).isNull();
	}

	/**
	 * A MEMBERSHIP OF ANOTHER SEASON SAYS NOTHING ABOUT THIS ONE: freed of 2028, he is still asked to
	 * pay for 2027, the season on sale (owner, 27.09.2026, „BESPLATNI CLANOVI NISU BESPLATNI
	 * DOZIVOTNO").
	 */
	@Test
	void aMembershipOfAnotherSeasonIsNotTheSeasonOnSale() throws Exception {
		long account = aMember("druga-sezona@primer.rs", A_TOWN_IN_SERBIA, "1990-01-01", true);

		db.sql("insert into membership (competitor_id, season, basis, payment_id, decided_by,"
						+ " decided_by_name, decided_at) values (?, ?, 'feeExempt', null,"
						+ " (select id from account where email = ?), 'Probni Probic', ?)")
				.params(memberOf(account), ON_SALE + 1, THE_MODERATOR, Timestamp.from(NOW)).update();

		confirm(aConfirmationLink(account));

		assertThat(opened(theOnlyLetterTo("druga-sezona@primer.rs")).subject())
				.isEqualTo("Uplatnica za članarinu za 2027. godinu");
	}

	/** G: HIS BALANCE REACHES THE WHOLE FEE AND THE MEMBERSHIP HAS NOT BEEN TAKEN OUT OF IT. */
	@Test
	void aBalanceThatCoversTheWholeFeeIsToldToActivate() throws Exception {
		long account = aMember("pokriven@primer.rs", A_TOWN_IN_SERBIA, "1990-01-01", true);

		thePeriodCosts("5", "600");
		onHisBook(account, "600");

		confirm(aConfirmationLink(account));

		Opened letter = opened(theOnlyLetterTo("pokriven@primer.rs"));

		assertThat(letter.subject()).isEqualTo("Balans pokriva članarinu za 2027. godinu");
		assertThat(db.sql("select count(*) from balance_promise where competitor_id = ?")
				.param(memberOf(account)).query(Long.class).single())
				.as("a balance that covers the fee mints no code, so nothing is promised")
				.isZero();
	}

	/** Nothing for a fee of nought (owner, 24.10.2026). */
	@Test
	void aFeeOfNoughtIsToldNothing() throws Exception {
		long account = aMember("besplatno@primer.rs", A_TOWN_IN_SERBIA, "1990-01-01", true);

		thePeriodCosts("0", "0");

		assertThat(confirm(aConfirmationLink(account))).isEqualTo(204);
		assertThat(theLettersTo("besplatno@primer.rs")).isEmpty();
	}

	/** Nothing for a member who already has a number and no membership of the season on sale. */
	@Test
	void aMemberWithANumberAndNoSeasonIsToldNothing() throws Exception {
		long account = aMember("sa-brojem@primer.rs", A_TOWN_IN_SERBIA, "1990-01-01", true);

		db.sql("update competitor set member_number = '009901' where id = ?").param(memberOf(account)).update();

		confirm(aConfirmationLink(account));

		assertThat(theLettersTo("sa-brojem@primer.rs")).isEmpty();
	}

	/** An English account is written to in English, and led to the English page. */
	@Test
	void anEnglishAccountIsWrittenToInEnglish() throws Exception {
		long account = aMember("engleski@primer.rs", A_TOWN_IN_SERBIA, "1990-01-01", true);

		db.sql("update account set mail_language = 'en' where id = ?").param(account).update();

		confirm(aConfirmationLink(account));

		Opened letter = opened(theOnlyLetterTo("engleski@primer.rs"));

		assertThat(letter.subject()).isEqualTo("Payment slip for the 2027 membership");
		assertThat(letter.text()).contains("https://probni-portal.primer.rs/en/moja-clanarina");
	}

	// --- once, and only by whoever confirmed ---

	/**
	 * A SECOND PRESS ON THE LINK, AND A SECOND LINK, SEND NOTHING MORE: the letter goes with the first
	 * confirmation and never again. Another member confirmed beside him gets his own one letter.
	 */
	@Test
	void theLetterGoesOnceWhateverIsPressedAfter() throws Exception {
		long account = aMember("dvaput@primer.rs", A_TOWN_IN_SERBIA, "1990-01-01", true);
		long beside = aMember("pored@primer.rs", A_TOWN_IN_SERBIA, "1990-01-01", true);
		String first = aConfirmationLink(account);
		String second = aConfirmationLink(account);

		assertThat(confirm(first)).isEqualTo(204);
		assertThat(confirm(first)).isEqualTo(204);
		assertThat(confirm(second)).isEqualTo(204);
		assertThat(confirm(aConfirmationLink(beside))).isEqualTo(204);

		assertThat(theLettersTo("dvaput@primer.rs")).hasSize(1);
		assertThat(theLettersTo("pored@primer.rs")).hasSize(1);
	}

	/**
	 * THE MEMBER THE ADMINISTRATION ENTERED CONFIRMS HIS ADDRESS BY SETTING HIS PASSWORD, and that is
	 * when his letter goes - once.
	 */
	@Test
	void anEnteredMemberIsSentHisLetterWhenHeSetsHisPasswordAndOnlyThen() throws Exception {
		long account = aMember("upisan@primer.rs", A_TOWN_IN_SERBIA, "1990-01-01", false);

		assertThat(reset(aPasswordLink(account))).isEqualTo(204);
		assertThat(reset(aPasswordLink(account))).isEqualTo(204);

		assertThat(opened(theOnlyLetterTo("upisan@primer.rs")).subject())
				.isEqualTo("Uplatnica za članarinu za 2027. godinu");
	}

	/**
	 * A RESET BY SOMEBODY WHO ALREADY HAS A PASSWORD CONFIRMS NOTHING (PDL 19.09.2026), so it sends
	 * no letter, his address being unconfirmed or not.
	 */
	@Test
	void aResetOfAnAccountWithAPasswordSendsNoLetter() throws Exception {
		long account = aMember("ima-lozinku@primer.rs", A_TOWN_IN_SERBIA, "1990-01-01", true);

		assertThat(reset(aPasswordLink(account))).isEqualTo(204);
		assertThat(theLettersTo("ima-lozinku@primer.rs")).isEmpty();
	}

	/** A moderator who does not race has no membership to be told about. */
	@Test
	void anAccountThatNamesNoMemberIsSentNoLetter() throws Exception {
		long moderator = db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Novi', 'Moderator', 'novi-moderator@primer.rs',"
						+ " (select id from role where code = 'moderator')) returning id")
				.query(Long.class).single();

		assertThat(reset(aPasswordLink(moderator))).isEqualTo(204);
		assertThat(theLettersTo("novi-moderator@primer.rs")).isEmpty();
	}

	/** A relay that will not take the letter does not take the confirmation back. */
	@Test
	void aRelayThatWillNotTakeTheLetterLeavesTheAddressConfirmed() throws Exception {
		long account = aMember("bez-releja@primer.rs", A_TOWN_IN_SERBIA, "1990-01-01", true);

		doThrow(new MailSendException("the relay is not there"))
				.when(postman).sendWith(any(Said.class), anyString(), any());

		assertThat(confirm(aConfirmationLink(account))).isEqualTo(204);
		assertThat(db.sql("select email_confirmed_at is not null from account where id = ?")
				.param(account).query(Boolean.class).single()).isTrue();
	}
}
