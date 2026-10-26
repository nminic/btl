package com.btl.portal.domain.statement;

import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * READING A STATEMENT OF AIK BANKA, AGAINST STATEMENTS LAID OUT AS THE FIRST REAL ONE IS.
 *
 * <p>Every statement here is {@link ASyntheticStatement}: the layout of number 1 of 23.10.2026, with
 * names, accounts and order numbers nobody has. The first case is that statement's own shape, one
 * payment and three charges of the bank, with every field the decision names.
 */
class AikStatementTest {

	private static final String DUSAN = "DUŠAN PROBIĆ, ULICA PRIMERA 5, BEOGRAD-ČUKARICA";

	@Test
	void theShapeOfTheFirstStatementGivesItsOnePaymentWithEveryFieldAndSkipsTheThreeCharges()
			throws Exception {
		byte[] statement = ASyntheticStatement.number(1)
				.credit(DUSAN, "4200.00", null, "5900000000000001 (1900000000000001-6)")
				.fee("250.00", "(1900000000000002-1)")
				.fee("250.00", "(1900000000000003-1)")
				.fee("19.50", "(1900000000000004-1)")
				.bytes();

		AikStatement.Read read = AikStatement.read(statement);

		assertThat(read.account()).isEqualTo("105-0000000003284-71");
		assertThat(read.number()).isEqualTo(1);
		assertThat(read.dated()).isEqualTo(LocalDate.of(2026, 10, 23));
		assertThat(read.credits()).containsExactly(new AikStatement.Credit(1, DUSAN, "200-0000000000001-11",
				new BigDecimal("4200.00"), "289", "Članarina za 2027. godinu", null,
				"5900000000000001 (1900000000000001-6)"));
		assertThat(read.credits().getFirst().payerName()).isEqualTo("DUŠAN PROBIĆ");
	}

	/**
	 * EACH PAYMENT KEEPS ITS OWN FIELDS, and the cases are set up so that no two of them share a value:
	 * a field read off the wrong item would show on the other one.
	 */
	@Test
	void twoPaymentsBetweenTwoChargesEachKeepTheirOwnAmountReferenceAndOrder() throws Exception {
		byte[] statement = ASyntheticStatement.number(12).dated("02.11.2026")
				.fee("19.50", "(1900000000000009-1)")
				.credit(DUSAN, "4200.00", "2027000004", "5900000000000001 (1900000000000001-6)")
				.item(new ASyntheticStatement.Item(true, "MILA ŽIVIĆ, DRUGA 2, NIŠ", "160-0000000000002-22",
						new BigDecimal("3800.00"), "189", List.of("Članarina", "za Milu"), "(97) 2027000027",
						"5900000000000002 (1900000000000005-1)"))
				.fee("250.00", "(1900000000000006-1)")
				.bytes();

		AikStatement.Read read = AikStatement.read(statement);

		assertThat(read.number()).isEqualTo(12);
		assertThat(read.dated()).isEqualTo(LocalDate.of(2026, 11, 2));
		assertThat(read.credits()).extracting(AikStatement.Credit::position).containsExactly(2, 3);
		assertThat(read.credits()).extracting(AikStatement.Credit::amount)
				.containsExactly(new BigDecimal("4200.00"), new BigDecimal("3800.00"));
		assertThat(read.credits()).extracting(AikStatement.Credit::reference)
				.containsExactly("2027000004", "2027000027");
		assertThat(read.credits()).extracting(AikStatement.Credit::orderNumber)
				.containsExactly("5900000000000001 (1900000000000001-6)", "5900000000000002 (1900000000000005-1)");
		assertThat(read.credits()).extracting(AikStatement.Credit::payerAccount)
				.containsExactly("200-0000000000001-11", "160-0000000000002-22");
		assertThat(read.credits()).extracting(AikStatement.Credit::paymentCode).containsExactly("289", "189");
		assertThat(read.credits().get(1).purpose()).isEqualTo("Članarina za Milu");
		assertThat(read.credits().get(1).payerName()).isEqualTo("MILA ŽIVIĆ");
	}

	@Test
	void anAmountOverAThousandIsReadWithItsSeparatorsAndAnAmountUnderOneWithout() throws Exception {
		byte[] statement = ASyntheticStatement.number(2)
				.credit(DUSAN, "1234567.80", null, "5900000000000001 (1")
				.credit(DUSAN, "0.40", null, "5900000000000002 (2")
				.bytes();

		assertThat(AikStatement.read(statement).credits()).extracting(AikStatement.Credit::amount)
				.containsExactly(new BigDecimal("1234567.80"), new BigDecimal("0.40"));
	}

	@Test
	void itemsOnSeveralPagesAreReadWholeAndInOrder() throws Exception {
		ASyntheticStatement statement = ASyntheticStatement.number(3).itemsPerPage(2);

		for (int i = 1; i <= 5; i++) {
			statement.credit("ČLAN " + i + ", ULICA", i + "00.00", null, "59000000000000" + i + " (x)");
		}

		AikStatement.Read read = AikStatement.read(statement.fee("19.50", "(f)").bytes());

		assertThat(read.credits()).extracting(AikStatement.Credit::payerName)
				.containsExactly("ČLAN 1", "ČLAN 2", "ČLAN 3", "ČLAN 4", "ČLAN 5");
		assertThat(read.credits()).extracting(AikStatement.Credit::position).containsExactly(1, 2, 3, 4, 5);
	}

	@Test
	void aStatementWithNoPaymentAtAllReadsAsNone() throws Exception {
		byte[] statement = ASyntheticStatement.number(4).fee("19.50", "(f)").bytes();

		assertThat(AikStatement.read(statement).credits()).isEmpty();
	}

	@Test
	void aStatementOfAnotherAccountIsRefusedAsAnotherAccount() {
		byte[] statement = ASyntheticStatement.number(1).ofTheAccount("105-0000000009999-11")
				.credit(DUSAN, "4200.00", null, "5900000000000001 (1)").bytes();

		assertThatThrownBy(() -> AikStatement.read(statement))
				.isInstanceOfSatisfying(AikStatement.NotTaken.class,
						refused -> assertThat(refused.refusal()).isEqualTo(AikStatement.Refusal.ANOTHER_ACCOUNT));
	}

	@Test
	void aStatementOfAnotherBankIsNotAStatement() {
		byte[] statement = ASyntheticStatement.number(1).ofTheBank("Druga banka ad Beograd")
				.credit(DUSAN, "4200.00", null, "5900000000000001 (1)").bytes();

		assertNotAStatement(statement);
	}

	/**
	 * THE PAGE CHECKS ITSELF: a statement whose items do not add up to its own totals is refused rather
	 * than read in part, whichever of the two is off.
	 */
	@Test
	void aStatementWhoseItemsDoNotComeToItsOwnCountOrSumIsRefused() {
		assertNotAStatement(ASyntheticStatement.number(1)
				.credit(DUSAN, "4200.00", null, "5900000000000001 (1)")
				.sayingTheCreditsAre(2, "4200.00").bytes());
		assertNotAStatement(ASyntheticStatement.number(1)
				.credit(DUSAN, "4200.00", null, "5900000000000001 (1)")
				.sayingTheCreditsAre(1, "4300.00").bytes());
	}

	@Test
	void aPaymentThatNamesNoOrderIsRefusedBecauseNothingWouldKeepItFromBeingBookedTwice() {
		byte[] statement = ASyntheticStatement.number(1)
				.item(new ASyntheticStatement.Item(true, DUSAN, "200-0000000000001-11", new BigDecimal("10.00"),
						"289", List.of("Članarina"), null, ""))
				.bytes();

		assertNotAStatement(statement);
	}

	@Test
	void aFileThatIsNotAPdfOrIsBrokenIsNotAStatement() {
		assertNotAStatement("Ovo nije PDF.".getBytes(java.nio.charset.StandardCharsets.UTF_8));

		byte[] whole = ASyntheticStatement.number(1).credit(DUSAN, "4200.00", null, "590 (1)").bytes();
		assertNotAStatement(java.util.Arrays.copyOf(whole, whole.length / 3));
		assertNotAStatement(new byte[0]);
	}

	@Test
	void anEncryptedStatementIsNotOpened() {
		byte[] statement = ASyntheticStatement.number(1).credit(DUSAN, "4200.00", null, "590 (1)")
				.beforeSaving(document -> {
					try {
						StandardProtectionPolicy policy = new StandardProtectionPolicy("vlasnik", "",
								new AccessPermission());
						policy.setEncryptionKeyLength(128);
						document.protect(policy);
					}
					catch (IOException broken) {
						throw new UncheckedIOException(broken);
					}
				})
				.bytes();

		assertNotAStatement(statement);
	}

	@Test
	void aDocumentOfMorePagesThanAStatementHasIsNotRead() {
		byte[] atTheBound = ASyntheticStatement.number(1).credit(DUSAN, "4200.00", null, "590 (1)")
				.blankPagesAfter(AikStatement.AT_MOST_PAGES - 1).bytes();
		byte[] overIt = ASyntheticStatement.number(1).credit(DUSAN, "4200.00", null, "590 (1)")
				.blankPagesAfter(AikStatement.AT_MOST_PAGES).bytes();

		assertThat(read(atTheBound).credits()).hasSize(1);
		assertNotAStatement(overIt);
	}

	@Test
	void aModelInFrontOfTheReferenceAndItsSpacesAreNotPartOfIt() {
		assertThat(AikStatement.referenceOf("(97) 2027 000 004")).isEqualTo("2027000004");
		assertThat(AikStatement.referenceOf("2027000004")).isEqualTo("2027000004");
		assertThat(AikStatement.referenceOf("97 2027000004")).isEqualTo("972027000004");
	}

	/* ------------------------------------------------------------------------------------
	   A PAGE THAT IS NOT LAID OUT AS A STATEMENT, one thing taken away or moved at a time
	   ------------------------------------------------------------------------------------ */

	/** The words of the first statement's shape, which every case below changes in one place. */
	private static List<AikStatement.Word> aStatementsWords() throws AikStatement.NotTaken {
		return new java.util.ArrayList<>(AikStatement.wordsOf(ASyntheticStatement.number(1)
				.credit(DUSAN, "4200.00", null, "5900000000000001 (1)")
				.fee("19.50", "(2)")
				.bytes(), AikStatement.AT_MOST_WORDS));
	}

	private static List<AikStatement.Word> without(List<AikStatement.Word> words, String text) {
		return words.stream().filter(word -> !word.text().equals(text)).toList();
	}

	private static List<AikStatement.Word> moved(List<AikStatement.Word> words, String text, float by) {
		return words.stream().map(word -> word.text().equals(text)
				? new AikStatement.Word(word.page(), word.x() + by, word.right() + by, word.y(), word.text())
				: word).toList();
	}

	private static List<AikStatement.Word> renamed(List<AikStatement.Word> words, String text, String to) {
		return words.stream().map(word -> word.text().equals(text)
				? new AikStatement.Word(word.page(), word.x(), word.right(), word.y(), to)
				: word).toList();
	}

	@Test
	void theUntouchedWordsAreAStatement() throws Exception {
		assertThat(AikStatement.of(aStatementsWords()).credits()).hasSize(1);
	}

	@Test
	void aPageMissingAnyOneOfItsLandmarksIsNotAStatement() throws Exception {
		List<AikStatement.Word> words = aStatementsWords();

		for (String landmark : List.of("BROJ", "Od:", "Duguje", "Potražuje", "potražuje:", "duguje:", "UKUPNO")) {
			assertNotAStatement(without(words, landmark));
		}

		/* THE COUNTS OF THE TWO SIDES, which leave the labels of the totals with nothing after them. */
		assertNotAStatement(words.stream()
				.filter(word -> !(word.text().equals("1") && word.x() > 200 && word.x() < 220)).toList());

		/* THE NUMBER OF THE STATEMENT, which leaves the two words of its heading the last on their line. */
		assertNotAStatement(words.stream()
				.filter(word -> !(word.text().equals("1") && word.y() > 110 && word.y() < 120)).toList());
	}

	@Test
	void aDayThatIsNoDayIsNotAStatement() {
		assertNotAStatement(ASyntheticStatement.number(1).dated("31.02.2026")
				.credit(DUSAN, "4200.00", null, "590 (1)").bytes());
		assertNotAStatement(ASyntheticStatement.number(1).dated("23-10-2026")
				.credit(DUSAN, "4200.00", null, "590 (1)").bytes());
	}

	@Test
	void anAccountThatIsNotShapedAsOneIsNotAStatement() {
		assertNotAStatement(ASyntheticStatement.number(1).ofTheAccount("105-3284-71")
				.credit(DUSAN, "4200.00", null, "590 (1)").bytes());
	}

	@Test
	void anItemWithoutAnAmountOrWithOneInNoColumnIsNotAStatement() throws Exception {
		List<AikStatement.Word> words = aStatementsWords();
		AikStatement.Word item = words.stream().filter(word -> word.text().equals("4,200.00"))
				.min(java.util.Comparator.comparingDouble(AikStatement.Word::y)).orElseThrow();

		assertNotAStatement(words.stream().filter(word -> word != item).toList());
		assertNotAStatement(moved(words, "19.50", -60));
	}

	@Test
	void aTotalThatStandsInNoColumnIsNotAStatement() throws Exception {
		/* The credit total and the item are both 4,200.00, so the total is the lower of the two. */
		List<AikStatement.Word> words = aStatementsWords();
		AikStatement.Word total = words.stream().filter(word -> word.text().equals("4,200.00"))
				.max(java.util.Comparator.comparingDouble(AikStatement.Word::y)).orElseThrow();

		assertNotAStatement(words.stream().map(word -> word == total
				? new AikStatement.Word(word.page(), word.x() - 100, word.right() - 100, word.y(), word.text())
				: word).toList());
	}

	@Test
	void itemsThatAreNotNumberedOneTwoThreeAreNotAStatement() throws Exception {
		assertNotAStatement(renamed(aStatementsWords(), "2.", "3."));
	}

	@Test
	void aPdfWithNoTextIsNotAStatement() {
		assertNotAStatement(ASyntheticStatement.number(1).blankOnly().bytes());
	}

	@Test
	void theTextIsAbandonedPastItsBoundAndTheBoundIsFarAboveAStatement() throws Exception {
		byte[] statement = ASyntheticStatement.number(1).credit(DUSAN, "4200.00", null, "590 (1)").bytes();
		int words = AikStatement.wordsOf(statement, AikStatement.AT_MOST_WORDS).size();

		assertThat(AikStatement.wordsOf(statement, words)).hasSize(words);
		assertThatThrownBy(() -> AikStatement.wordsOf(statement, words - 1))
				.isInstanceOf(AikStatement.NotTaken.class);
		assertThat(AikStatement.AT_MOST_WORDS).isGreaterThan(100 * words);
	}

	/** EVERY FIELD HAS ITS BOUND, one past it is refused, and a field the statement left out is no field. */
	@Test
	void everyFieldIsAsLongAsAStatementPrintsOneAndNoLonger() {
		AikStatement.Credit fine = new AikStatement.Credit(1, "P".repeat(300), "A".repeat(40), BigDecimal.ONE,
				"C".repeat(10), "S".repeat(1000), "R".repeat(64), "O".repeat(100));
		AikStatement.Credit leftOut = new AikStatement.Credit(1, "P", null, BigDecimal.ONE, null, "", null, "O");

		assertThat(AikStatement.withinItsBounds(fine)).isTrue();
		assertThat(AikStatement.withinItsBounds(leftOut)).isTrue();
		assertThat(List.of(
				new AikStatement.Credit(1, "P".repeat(301), null, BigDecimal.ONE, null, "", null, "O"),
				new AikStatement.Credit(1, "P", "A".repeat(41), BigDecimal.ONE, null, "", null, "O"),
				new AikStatement.Credit(1, "P", null, BigDecimal.ONE, "C".repeat(11), "", null, "O"),
				new AikStatement.Credit(1, "P", null, BigDecimal.ONE, null, "S".repeat(1001), null, "O"),
				new AikStatement.Credit(1, "P", null, BigDecimal.ONE, null, "", "R".repeat(65), "O"),
				new AikStatement.Credit(1, "P", null, BigDecimal.ONE, null, "", null, "O".repeat(101))))
				.noneMatch(AikStatement::withinItsBounds);
	}

	@Test
	void aPaymentWithAFieldLongerThanAStatementPrintsIsNotAStatement() {
		/* A purpose of thirteen lines of eighty letters, which fits the page and not the bound. */
		assertNotAStatement(ASyntheticStatement.number(1)
				.item(new ASyntheticStatement.Item(true, DUSAN, "200-0000000000001-11", new BigDecimal("10.00"),
						"289", java.util.Collections.nCopies(13, "S".repeat(80)), null, "590 (1)"))
				.bytes());
	}

	private static void assertNotAStatement(List<AikStatement.Word> words) {
		assertThatThrownBy(() -> AikStatement.of(words))
				.isInstanceOfSatisfying(AikStatement.NotTaken.class,
						refused -> assertThat(refused.refusal()).isEqualTo(AikStatement.Refusal.NOT_A_STATEMENT));
	}

	/* ------------------------------------------------------------------------------------
	   WHAT THE PAYER WROTE IS NOT A FIELD (security review of PR 647, S3; owner, 26.10.2026)
	   ------------------------------------------------------------------------------------ */

	/** One payment whose purpose is this, with its real order „REAL-ORDER-0001" and no reference. */
	private static AikStatement.Credit theOneWhosePurposeIs(String purpose) throws Exception {
		return AikStatement.read(ASyntheticStatement.number(1)
				.item(new ASyntheticStatement.Item(true, "PETAR PETROVIC, BEOGRAD", "200-0000000000001-11",
						new BigDecimal("4200.00"), "289", List.of(purpose), null, "REAL-ORDER-0001"))
				.bytes()).credits().getFirst();
	}

	/**
	 * A LABEL IN THE PURPOSE IS THE PURPOSE: the order, the reference and the account stay what the
	 * statement's own fields print, and the words stay in the purpose. Each was the payer's to set until
	 * 26.10.2026, because a label was taken from any line of the item and the last one won.
	 */
	@Test
	void aLabelWrittenIntoThePurposeIsReadAsThePurposeAndChangesNoField() throws Exception {
		AikStatement.Credit order = theOneWhosePurposeIs("Nalog: FORGED-ORDER-123");
		AikStatement.Credit reference = theOneWhosePurposeIs("Poziv na broj: 2027000099");
		AikStatement.Credit account = theOneWhosePurposeIs("Račun: 999-9999999999999-99");

		assertThat(order.orderNumber()).isEqualTo("REAL-ORDER-0001");
		assertThat(order.purpose()).isEqualTo("Nalog: FORGED-ORDER-123");
		assertThat(reference.reference()).isNull();
		assertThat(reference.purpose()).isEqualTo("Poziv na broj: 2027000099");
		assertThat(account.payerAccount()).isEqualTo("200-0000000000001-11");
		assertThat(account.purpose()).isEqualTo("Račun: 999-9999999999999-99");
	}

	/**
	 * AND THE TOTALS ARE READ ONLY UNDER „UKUPNO ZA IZVOD", so a purpose that names them or that says
	 * „UKUPNO" neither refuses the statement nor ends its items early.
	 */
	@Test
	void theTotalsWordsInAPurposeNeitherRefuseTheStatementNorEndItsItems() throws Exception {
		assertThat(theOneWhosePurposeIs("Ukupno stavki potražuje: 7").purpose())
				.isEqualTo("Ukupno stavki potražuje: 7");

		AikStatement.Read read = AikStatement.read(ASyntheticStatement.number(1)
				.item(new ASyntheticStatement.Item(true, "PRVI PLATILAC", "200-0000000000001-11",
						new BigDecimal("100.00"), "289", List.of("UKUPNO ZA IZVOD"), null, "O-1"))
				.credit(DUSAN, "200.00", null, "O-2")
				.bytes());

		assertThat(read.credits()).extracting(AikStatement.Credit::orderNumber).containsExactly("O-1", "O-2");
	}

	/** A FIELD PRINTED TWICE IS THE FIRST ONE: a second line of fields does not overwrite it. */
	@Test
	void aFieldIsTakenFromItsFirstPlaceAndNotFromALaterLine() throws Exception {
		AikStatement.Credit credit = AikStatement.read(ASyntheticStatement.number(1)
				.item(new ASyntheticStatement.Item(true, DUSAN, "200-0000000000001-11", new BigDecimal("4200.00"),
						"289", List.of("Članarina"), "2027000004", "REAL-ORDER-0001"))
				.secondFieldsLine("Nalog:", "LATER-ORDER-0002")
				.secondFieldsLine("Poziv na broj:", "2027000099")
				.secondFieldsLine("Račun:", "999-9999999999999-99")
				.secondFieldsLine("Šifra pl.:", "999")
				.secondFieldsLine("Napomena:", "nešto drugo")
				.bytes()).credits().getFirst();

		assertThat(credit.orderNumber()).isEqualTo("REAL-ORDER-0001");
		assertThat(credit.reference()).isEqualTo("2027000004");
		assertThat(credit.payerAccount()).isEqualTo("200-0000000000001-11");
		assertThat(credit.paymentCode()).isEqualTo("289");
		/* AND A LINE IN THE COLUMN OF LABELS THAT BEGINS WITH NO LABEL IS NOT A LINE OF FIELDS. */
		assertThat(credit.purpose()).isEqualTo("Članarina Napomena: nešto drugo");
	}

	private static AikStatement.Read read(byte[] statement) {
		try {
			return AikStatement.read(statement);
		}
		catch (AikStatement.NotTaken refused) {
			throw new AssertionError(refused);
		}
	}

	private static void assertNotAStatement(byte[] statement) {
		assertThatThrownBy(() -> AikStatement.read(statement))
				.isInstanceOfSatisfying(AikStatement.NotTaken.class,
						refused -> assertThat(refused.refusal()).isEqualTo(AikStatement.Refusal.NOT_A_STATEMENT));
	}
}
