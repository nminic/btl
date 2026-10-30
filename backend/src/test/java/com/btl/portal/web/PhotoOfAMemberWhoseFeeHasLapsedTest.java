package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * THE BYTES OF A PORTRAIT ARE ANSWERED WHILE ITS MEMBER'S FEE STANDS; AFTER IT DOES NOT, TO THE
 * ADMINISTRATION AND TO HIM WHILE HIS PROFILE IS OPEN, AND TO NOBODY ELSE.
 *
 * <p><b>[IZVEDENO 10.10.2026, my reasoning from the record and NOT a sentence of the owner's.]</b>
 * PDL P8, „Pre plaćanja član sme da otvori nalog, ali nigde nije vidljiv i ne može ništa da radi u
 * sistemu"; P11, „profil se ne prikazuje za sezonu u kojoj član nije aktivan", which the owner
 * confirmed on 03.08.2026 as deliberate; and the rule of 13.09.2026, „Nijedan javni odgovor ne sme da
 * imenuje člana kome je članarina istekla, ni posredno". Until this increment {@link PhotoApi} asked
 * the fee of the READER (since 03.10.2026) and never the fee of the member whose portrait it was, so
 * a member who had lapsed, and who by PDL P8 of 10.10.2026 and 11.10.2026 cannot take his picture
 * down himself, still had it answered to anybody holding the digest. The exception is the member:
 * PDL P8, 25.09.2026, „Treba da moze da otvori svoj profil dokle god postoji, odnosno dok ga admin ne
 * obrise".
 *
 * <p><b>AND THE EXCEPTION STOPS WHERE THE OWNER STOPPED IT.</b> A member who has lapsed AND hides his
 * profile is not served his own portrait. That is the boundary C of PR 515 (10.10.2026): the owner
 * was shown that this member is handed the address and not the bytes, and chose to leave it so
 * (written out in {@code MeApi}; I found it in the pull request and in that javadoc and NOT in
 * PDL or ADL). The cell is in the table, named, because it reads as a fault and is not.
 *
 * <p><b>THE FACT IS THE HOLDER'S AND THE READER'S IS A DIFFERENT ONE, so the fixture gives each of
 * them both states on purpose.</b> Five holders of a portrait: active and open, active and hiding,
 * lapsed and open, lapsed and hiding, and somebody who registered and has never paid. And twelve
 * readers, written beside the table below: a visitor, an active member, a member whose own fee has
 * lapsed, somebody who never paid, an account that races for nobody, a moderator with no box ticked,
 * the superadmin, and each of the five holders asking for pictures that are not his own.
 *
 * <p><b>Every cell of the table is asked, and the table is a hand-written list of what each reader
 * is served, with a floor under it</b> ({@link #theTableNamesEveryReaderAndEveryPictureOfTheFixture}
 * reads every account and every picture out of the database), so a sixth holder or a thirteenth
 * reader written tomorrow has to be put in it rather than quietly measured by nothing.
 *
 * <p><b>Two pictures are held by a TEAM</b> - one by the team alone, one by the team and by a member
 * who has lapsed - and both are served to everybody, because a team has no fee and {@code team.logo_id}
 * is on the other {@code exists}. A condition written over the whole rule would refuse them.
 *
 * <p><b>The mutations this is written against, each of which is a cell:</b> the holder's
 * {@code active} replaced by the reader's (an active member is then served a lapsed member's portrait
 * and a lapsed reader is refused an open one), the condition on {@code profile_hidden} alone (a visitor
 * is then served a lapsed member's portrait), the owner's clause widened to any account that names a
 * member (a lapsed reader is then served another lapsed member's portrait), the owner's clause removed
 * (a lapsed holder is refused his own), the owner's clause without its {@code not profile_hidden} (a
 * lapsed holder who hides is then served his own, against the owner's choice), the administration's
 * removed, and the administration read as
 * the reader's {@code readsHiddenProfiles} (an active member is then served a lapsed member's portrait).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class PhotoOfAMemberWhoseFeeHasLapsedTest {

	/** One picture and the member or team that holds it: what it is, and the bytes under its address. */
	private record Subject(String digest, String mediaType, byte[] bytes) {
	}

	private static final Subject ACTIVE_AND_OPEN = new Subject("a0".repeat(32), "image/jpeg",
			new byte[] {(byte) 0xFF, (byte) 0xD8, 'a', 'o'});

	private static final Subject ACTIVE_AND_HIDING = new Subject("a1".repeat(32), "image/png",
			new byte[] {(byte) 0x89, 'P', 'N', 'G', 'a', 'h'});

	private static final Subject LAPSED_AND_OPEN = new Subject("a2".repeat(32), "image/jpeg",
			new byte[] {(byte) 0xFF, (byte) 0xD8, 'l', 'o'});

	private static final Subject LAPSED_AND_HIDING = new Subject("a3".repeat(32), "image/webp",
			new byte[] {'R', 'I', 'F', 'F', 0x00, 'l', 'h'});

	private static final Subject NEVER_PAID = new Subject("a4".repeat(32), "image/png",
			new byte[] {(byte) 0x89, 'P', 'N', 'G', 'n', 'p'});

	/** Held by a team and by nobody else. */
	private static final Subject A_TEAMS_MARK = new Subject("a5".repeat(32), "image/webp",
			new byte[] {'R', 'I', 'F', 'F', 0x00, 't', 'm'});

	/** Held by a team AND by a member whose fee has lapsed: the team's mark decides. */
	private static final Subject THE_SAME_PICTURE_TWICE = new Subject("a6".repeat(32), "image/jpeg",
			new byte[] {(byte) 0xFF, (byte) 0xD8, 's', 't'});

	private static final List<Subject> EVERY_PICTURE = List.of(ACTIVE_AND_OPEN, ACTIVE_AND_HIDING,
			LAPSED_AND_OPEN, LAPSED_AND_HIDING, NEVER_PAID, A_TEAMS_MARK, THE_SAME_PICTURE_TWICE);

	/** A digest of the right shape that no row has, which is what a refusal must be told from. */
	private static final String NOBODY_WROTE = "f7".repeat(32);

	private static final String THE_VISITOR = "visitor";

	private static final String AN_ACTIVE_MEMBER = "aktivan-citalac@primer.rs";

	private static final String A_LAPSED_MEMBER = "istekao-citalac@primer.rs";

	private static final String SOMEBODY_WHO_NEVER_PAID = "nikad-platio-citalac@primer.rs";

	private static final String AN_ACCOUNT_THAT_RACES_FOR_NOBODY = "bez-clana-citalac@primer.rs";

	private static final String A_MODERATOR_WITH_NO_BOX_TICKED = "moderator-citalac@primer.rs";

	private static final String THE_SUPERADMIN = "superadmin-citalac@primer.rs";

	private static final String HOLDER_ACTIVE_AND_OPEN = "vlasnik-aktivan-otvoren@primer.rs";

	private static final String HOLDER_ACTIVE_AND_HIDING = "vlasnik-aktivan-skriven@primer.rs";

	private static final String HOLDER_LAPSED_AND_OPEN = "vlasnik-istekao-otvoren@primer.rs";

	private static final String HOLDER_LAPSED_AND_HIDING = "vlasnik-istekao-skriven@primer.rs";

	private static final String HOLDER_WHO_NEVER_PAID = "vlasnik-nikad-platio@primer.rs";

	/**
	 * WHO IS SERVED WHAT, written out. A reader that is not a key here is a reader the fixture has
	 * and the table does not, and {@link #theTableNamesEveryReaderAndEveryPictureOfTheFixture} says so.
	 *
	 * <p>The four ways to read it: the visitor, the lapsed reader, the one who never paid and the
	 * account that races for nobody are all served what is open and held by a member whose fee stands,
	 * and both team pictures. The active member is served that and what is hiding. The two
	 * administration readers are served everything. A holder is served what a reader in his own
	 * state is served, and his own picture on top of it.
	 */
	private static final Map<String, Set<Subject>> SERVED = served();

	private static Map<String, Set<Subject>> served() {
		Set<Subject> whatAnybodyIsServed = Set.of(ACTIVE_AND_OPEN, A_TEAMS_MARK, THE_SAME_PICTURE_TWICE);
		Set<Subject> whatAnActiveReaderIsServed = Set.of(ACTIVE_AND_OPEN, ACTIVE_AND_HIDING, A_TEAMS_MARK,
				THE_SAME_PICTURE_TWICE);
		Map<String, Set<Subject>> table = new LinkedHashMap<>();

		table.put(THE_VISITOR, whatAnybodyIsServed);
		table.put(AN_ACTIVE_MEMBER, whatAnActiveReaderIsServed);
		table.put(A_LAPSED_MEMBER, whatAnybodyIsServed);
		table.put(SOMEBODY_WHO_NEVER_PAID, whatAnybodyIsServed);
		table.put(AN_ACCOUNT_THAT_RACES_FOR_NOBODY, whatAnybodyIsServed);
		table.put(A_MODERATOR_WITH_NO_BOX_TICKED, Set.copyOf(EVERY_PICTURE));
		table.put(THE_SUPERADMIN, Set.copyOf(EVERY_PICTURE));

		table.put(HOLDER_ACTIVE_AND_OPEN, whatAnActiveReaderIsServed);
		table.put(HOLDER_ACTIVE_AND_HIDING, whatAnActiveReaderIsServed);
		table.put(HOLDER_LAPSED_AND_OPEN, with(whatAnybodyIsServed, LAPSED_AND_OPEN));
		/* HIS OWN PICTURE IS NOT SERVED TO HIM: the owner chose, shown with PR 515 (10.10.2026), to
		   leave the portrait of a member who has lapsed AND hides unloaded even for himself (the
		   boundary C of that PR, written in `MeApi`). It is the one cell of the table that reads as
		   a fault and is not, and the case that names it is below. */
		table.put(HOLDER_LAPSED_AND_HIDING, whatAnybodyIsServed);
		table.put(HOLDER_WHO_NEVER_PAID, with(whatAnybodyIsServed, NEVER_PAID));

		return table;
	}

	private static Set<Subject> with(Set<Subject> served, Subject more) {
		Set<Subject> whole = new java.util.HashSet<>(served);

		whole.add(more);

		return Set.copyOf(whole);
	}

	private static final Path FOLDER = aFolderOfItsOwn();

	@DynamicPropertySource
	static void whereThePicturesAre(DynamicPropertyRegistry settings) {
		settings.add("btl.photos.folder", FOLDER::toString);
	}

	private static Path aFolderOfItsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-lapsed");
		}
		catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	/** Feeds the sixteen lowercase hexadecimal characters {@code referral_code} needs (V7). */
	private int issued;

	@BeforeEach
	void fiveHoldersTwoTeamPicturesAndTwelveReaders() {
		long activeAndOpen = aPicture(ACTIVE_AND_OPEN);
		long activeAndHiding = aPicture(ACTIVE_AND_HIDING);
		long lapsedAndOpen = aPicture(LAPSED_AND_OPEN);
		long lapsedAndHiding = aPicture(LAPSED_AND_HIDING);
		long neverPaid = aPicture(NEVER_PAID);
		long aTeamsMark = aPicture(A_TEAMS_MARK);
		long theSameTwice = aPicture(THE_SAME_PICTURE_TWICE);

		/* THE HOLDERS: the four ways a member who has been a member can stand, and the fifth, who never
		   was. `active` is the fact the rule asks and `profile_hidden` is the second, independent one. */
		member("000201", true, false, activeAndOpen);
		member("000202", true, true, activeAndHiding);
		member("000203", false, false, lapsedAndOpen);
		member("000204", false, true, lapsedAndHiding);
		member(null, false, false, neverPaid);

		/* AND A SIXTH HOLDER WHO HAS NO ACCOUNT: the lapsed member whose picture a team's mark also is. */
		member("000205", false, false, theSameTwice);

		team("tim-sa-znakom", aTeamsMark);
		team("tim-sa-znakom-clana-koji-je-istekao", theSameTwice);

		/* THE READERS WHO HOLD NOTHING, so that what each is served is not about what he holds. */
		member("000210", true, false, null);
		member("000211", false, false, null);
		member(null, false, false, null);

		account(AN_ACTIVE_MEMBER, "competitor");
		belongsTo(AN_ACTIVE_MEMBER, "000210");
		account(A_LAPSED_MEMBER, "competitor");
		belongsTo(A_LAPSED_MEMBER, "000211");
		account(SOMEBODY_WHO_NEVER_PAID, "competitor");
		db.sql("update account set competitor_id = (select max(id) from competitor where member_number"
				+ " is null and photo_id is null) where email = ?").param(SOMEBODY_WHO_NEVER_PAID).update();
		account(AN_ACCOUNT_THAT_RACES_FOR_NOBODY, "competitor");
		account(A_MODERATOR_WITH_NO_BOX_TICKED, "moderator");
		account(THE_SUPERADMIN, "superadmin");

		account(HOLDER_ACTIVE_AND_OPEN, "competitor");
		belongsTo(HOLDER_ACTIVE_AND_OPEN, "000201");
		account(HOLDER_ACTIVE_AND_HIDING, "competitor");
		belongsTo(HOLDER_ACTIVE_AND_HIDING, "000202");
		account(HOLDER_LAPSED_AND_OPEN, "competitor");
		belongsTo(HOLDER_LAPSED_AND_OPEN, "000203");
		account(HOLDER_LAPSED_AND_HIDING, "competitor");
		belongsTo(HOLDER_LAPSED_AND_HIDING, "000204");
		account(HOLDER_WHO_NEVER_PAID, "competitor");
		db.sql("update account set competitor_id = (select id from competitor where photo_id ="
				+ " (select id from photo where digest = ?)) where email = ?")
				.params(NEVER_PAID.digest(), HOLDER_WHO_NEVER_PAID).update();
	}

	@AfterEach
	void theFolderIsLeftEmpty() throws IOException {
		try (Stream<Path> left = Files.walk(FOLDER)) {
			for (Path one : left.sorted(Comparator.reverseOrder()).toList()) {
				if (!one.equals(FOLDER)) {
					Files.delete(one);
				}
			}
		}
	}

	/**
	 * THE TABLE AT THE TOP NAMES EVERY READER THE FIXTURE HAS AND EVERY PICTURE IT HOLDS, which is the
	 * floor under a hand-written list.
	 *
	 * <p>Read out of the database and not out of the constants: the accounts out of {@code account},
	 * the pictures out of {@code photo}, and the state of each holder out of {@code competitor}, so
	 * that a constant whose row was written differently from its name is heard here and not by a cell
	 * that happens to pass.
	 */
	@Test
	void theTableNamesEveryReaderAndEveryPictureOfTheFixture() {
		List<String> written = db.sql("select email from account order by email")
				.query(String.class).list();
		List<String> listed = SERVED.keySet().stream().filter(one -> !THE_VISITOR.equals(one)).sorted()
				.toList();

		assertThat(written)
				.as("an account of the fixture has no row in the table of who is served what, or the"
						+ " table names one the fixture does not have")
				.isEqualTo(listed);

		assertThat(db.sql("select digest from photo order by digest").query(String.class).list())
				.as("a picture of the fixture is not a column of the table, or the table names one the"
						+ " fixture does not hold")
				.isEqualTo(EVERY_PICTURE.stream().map(Subject::digest).sorted().toList());

		assertThat(facts("select active, profile_hidden, member_number is null from competitor"
				+ " where photo_id = (select id from photo where digest = ?)", LAPSED_AND_OPEN.digest()))
				.as("the lapsed and open holder is not lapsed and open")
				.isEqualTo("false false false");
		assertThat(facts("select active, profile_hidden, member_number is null from competitor"
				+ " where photo_id = (select id from photo where digest = ?)", LAPSED_AND_HIDING.digest()))
				.as("the lapsed and hiding holder is not lapsed and hiding")
				.isEqualTo("false true false");
		assertThat(facts("select active, profile_hidden, member_number is null from competitor"
				+ " where photo_id = (select id from photo where digest = ?)", ACTIVE_AND_HIDING.digest()))
				.as("the active and hiding holder is not active and hiding")
				.isEqualTo("true true false");
		assertThat(facts("select active, profile_hidden, member_number is null from competitor"
				+ " where photo_id = (select id from photo where digest = ?)", NEVER_PAID.digest()))
				.as("the holder who never paid has a number, or is active")
				.isEqualTo("false false true");
		assertThat(facts("select count(*) from team where logo_id = (select id from photo where digest"
				+ " = ?)", THE_SAME_PICTURE_TWICE.digest()))
				.as("the picture held twice is not a team's mark as well")
				.isEqualTo("1");
		assertThat(facts("select count(*) from competitor where photo_id = (select id from photo where"
				+ " digest = ?)", THE_SAME_PICTURE_TWICE.digest()))
				.as("the picture held twice is not a member's portrait as well")
				.isEqualTo("1");
	}

	/**
	 * EACH READER IS SERVED EXACTLY THE PICTURES THE TABLE SAYS AND IS REFUSED EVERY OTHER ONE AS A
	 * DIGEST NOBODY WROTE IS REFUSED.
	 *
	 * <p><b>A served picture is compared by its bytes</b>, because the folder also holds a decoy named
	 * after each digest and a 200 alone would be satisfied by a server that resolved the address as a
	 * path. <b>A refused one is compared whole with the answer to a digest no row has, for the SAME
	 * reader</b>: status, body, type and the names of the headers, because a refusal that differed
	 * in any of them would say „this digest names a member whose fee has lapsed", which is the very
	 * sentence the rule exists to withhold.
	 */
	@ParameterizedTest
	@MethodSource("everyReader")
	void eachReaderIsServedWhatTheTableSaysAndNothingIsToldApart(String reader) throws Exception {
		MockHttpServletResponse nobodyWroteIt = answer(NOBODY_WROTE, reader);

		assertThat(nobodyWroteIt.getStatus())
				.as("a digest no row has was not refused to %s", reader)
				.isEqualTo(404);

		List<String> wrong = new ArrayList<>();

		for (Subject picture : EVERY_PICTURE) {
			MockHttpServletResponse got = answer(picture.digest(), reader);

			if (SERVED.get(reader).contains(picture)) {
				if (got.getStatus() != 200 || !java.util.Arrays.equals(got.getContentAsByteArray(),
						picture.bytes()) || !picture.mediaType().equals(got.getContentType())) {
					wrong.add(picture.digest().substring(0, 2) + " should have been served and was"
							+ " answered " + got.getStatus());
				}
			}
			else if (got.getStatus() != nobodyWroteIt.getStatus()
					|| !java.util.Arrays.equals(got.getContentAsByteArray(),
							nobodyWroteIt.getContentAsByteArray())
					|| !java.util.Objects.equals(got.getContentType(), nobodyWroteIt.getContentType())
					|| !java.util.Set.copyOf(got.getHeaderNames())
							.equals(java.util.Set.copyOf(nobodyWroteIt.getHeaderNames()))) {
				wrong.add(picture.digest().substring(0, 2) + " should have been answered as a digest"
						+ " nobody wrote and was answered " + got.getStatus());
			}
		}

		assertThat(wrong)
				.as("%s is served a picture the table says he is not, or refused one it says he is,"
						+ " or told a refusal apart from an address that is not there", reader)
				.isEmpty();
	}

	static Stream<String> everyReader() {
		return SERVED.keySet().stream();
	}

	/* ------------------------------------------------------------------------------------------
	   THE FIXTURE
	   ------------------------------------------------------------------------------------------ */

	private MockHttpServletResponse answer(String name, String reader) throws Exception {
		MockHttpServletRequestBuilder asks = get("/api/photos/{name}", name);

		return http.perform(THE_VISITOR.equals(reader) ? asks
						: asks.cookie(new Cookie(SessionCookie.NAME, sessions.get(reader).secret())))
				.andReturn().getResponse();
	}

	/** One row of one query as a single line, so that a case reads the facts it is built on. */
	private String facts(String sql, Object... params) {
		return db.sql(sql).params(params).query((row, one) -> {
			List<String> cells = new ArrayList<>();

			for (int at = 1; at <= row.getMetaData().getColumnCount(); at++) {
				cells.add(String.valueOf(row.getObject(at)));
			}

			return String.join(" ", cells);
		}).single();
	}

	private long aPicture(Subject picture) {
		long id = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
						+ " values (?, ?, ?, ?, ?, ?) returning id")
				.params(picture.mediaType(), picture.bytes().length, picture.digest(),
						new BigDecimal("0.25"), new BigDecimal("0.75"), new BigDecimal("0.40"))
				.query(Long.class).single();

		try {
			Files.write(FOLDER.resolve(String.valueOf(id)), picture.bytes());
			/* THE DECOY: a file named after the DIGEST, with the bytes turned round. */
			byte[] turned = new byte[picture.bytes().length];

			for (int at = 0; at < turned.length; at++) {
				turned[at] = picture.bytes()[turned.length - 1 - at];
			}

			Files.write(FOLDER.resolve(picture.digest()), turned);
		}
		catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}

		return id;
	}

	/** @param number null for somebody who registered and has not paid (V16) */
	private void member(String number, boolean active, boolean hidden, Long photo) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, active, "
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at, photo_id)"
						+ " values (?, 'Ime', 'Prezime', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, ?, ?, '', ?,"
						+ " 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00', ?)")
				.params(number, active, String.format("%016x", ++issued), hidden, photo)
				.update();
	}

	private void team(String slug, long mark) {
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id) values (?, ?, '', '', (select id from place"
						+ " where rank = 1), null, null, ?, 2027, null)")
				.params(slug, "Tim " + slug, mark).update();
	}

	private void account(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni', 'Probic', ?,"
				+ " (select id from role where code = ?))").params(email, role).update();

		SecretToken session = SecretToken.fresh();
		Instant issuedAt = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(issuedAt.minus(Duration.ofDays(1))),
						Timestamp.from(issuedAt), Timestamp.from(issuedAt.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	/** Ties an account to the member it races as (V23). */
	private void belongsTo(String email, String memberNumber) {
		db.sql("update account set competitor_id = (select id from competitor where member_number = ?)"
				+ " where email = ?").params(memberNumber, email).update();
	}
}
