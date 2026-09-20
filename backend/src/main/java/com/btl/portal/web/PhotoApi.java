package com.btl.portal.web;

import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * THE BYTES OF A PICTURE, ASKED FOR BY THE DIGEST OF THEIR OWN CONTENT.
 *
 * <p><b>The row says where the file is and what it is; the address says neither.</b> ADL
 * A36 O8: „Fajl na disku servera pod imenom koje izdaje baza, a u bazi red sa tipom,
 * velicinom, otiskom sadrzaja i iseckom." V8 names which name that is - „The name is this
 * row's {@code id}, which is what makes A12a's first rule keepable - the server never uses
 * the name a member's browser sent as a path, because it never uses it at all." This class
 * is the first reader of that arrangement, and the arrangement is the whole of its
 * security: what arrives over the wire is looked UP, never resolved, and what is resolved
 * is a {@code long} out of the row, which cannot carry a separator, a dot or an encoding.
 * Climbing out of the folder is therefore not refused here, it is unsayable.
 *
 * <p><b>THE ADDRESS IS THE DIGEST AND NOT THE KEY, and that is the decision of
 * 13.09.2026 arriving at a second resource.</b> PDL:6165: „Preusmerenje mora da se ponasa
 * isto i za profil koga nema. Ako skriven profil vodi na naslovnu a nepostojeci kaze 'nije
 * pronadjen', posetilac po razlici saznaje koji brojevi pripadaju skrivenim clanovima, sto
 * je upravo ono sto se krije." A picture addressed by {@code photo.id} is countable: a
 * visitor walking 1, 2, 3 learns how many pictures the portal holds and, the day a hidden
 * member has one, that his exists. Sixty four hexadecimal characters are not walked.
 * <b>It is not a substitute for a rule about who may read</b> - nothing here asks who is
 * asking - and the day a picture becomes something only some people may see, this route
 * needs that rule and not a longer name.
 *
 * <p><b>The whole picture and never the crop.</b> PDL:1653: „Odseceni deo se ne baca.
 * Slika ostaje cela, a isecak se pamti pored nje." The three fractions are answered beside
 * the thing they belong to - {@link TeamApi} already serves a team's - and nothing here
 * reads them: a route that cut the bytes would be the one place in the portal where the
 * crop is burnt in, which is exactly what ADL A17 refuses.
 *
 * <p><b>What is NOT answered, named rather than left out silently</b> (ADL A36 P-javno,
 * 13.09.2026: „Kad je sporno, polje se IZOSTAVLJA i izostavljanje se imenuje sa
 * razlogom"): the size, the digest, the crop and the moment of upload are all on the row
 * and none of them leaves here. This resource answers bytes; a caller who wants to know
 * anything ABOUT a picture is holding the wrong address, and a header invented here would
 * be a second home for a fact {@link TeamApi} already serves.
 *
 * <p><b>ONE ROW DECIDES EVEN WHEN TWO CARRY THE SAME DIGEST, and the schema allows two.</b>
 * V8 puts no unique constraint on {@code digest} and says why in as many words: „The digest
 * is what says two members uploaded the same picture." Two rows with one digest are two
 * files with identical content, so either would answer the same bytes - but „either" is not
 * a sentence a server may be written in, and {@code .optional()} over two rows is a 500. The
 * oldest row decides, which is the same tie-break {@link TeamApi} and {@link VerificationApi}
 * end their orders with.
 *
 * <p><b>A row whose file is not there is answered exactly as a digest nobody wrote.</b>
 * Any other number would be a sentence about the database: 500 or 410 would say „this
 * digest names a row and the row is broken", which is the same subtraction PDL:6165 shuts
 * for profiles, available to anybody with no session. So the operator is told - the WARN
 * below is the only place that fault exists - and the caller is told what a caller of an
 * address that is not there is told. The two answers are not merely the same NUMBER: both
 * go out through {@code sendError}, so the container's own ERROR dispatch writes both, and
 * {@code PhotoApiTest.aRowWithNoFileAnswersExactlyWhatNoRowAnswers} compares them body and
 * all. ADL A8 of 13.09.2026 measured what an imitation costs: two answers carrying one
 * number and nothing else alike are an oracle, one request per guess.
 *
 * <p><b>The type comes off the row and out of nothing else.</b> Not the name of the file a
 * member chose, not the {@code Content-Type} he sent, not what the bytes look like here -
 * ADL A12a, 1: the server „proveri tip po sadrzaju a ne po nazivu ni po {@code Content-Type}
 * zaglavlju", and the place that check belongs is the upload, whose answer is this column.
 * V8's {@code photo_media_type_known} allows exactly {@code image/jpeg}, {@code image/png}
 * and {@code image/webp}, which is why nothing here validates what it read: a fourth value
 * cannot be written, and a branch for one could never be measured.
 *
 * <p><b>And {@code nosniff}, which is the one header that makes the sentence above binding
 * on a browser.</b> Without it a browser may disregard the type and decide from the bytes,
 * and the whole point of answering from the row is that the row is the only thing that
 * decided. The edge sets this header for the portal already (ADL A12a, 5, which names it
 * among the three {@code deploy/README.md} sets), and it is set here as well on purpose:
 * this route is the portal's first that answers with bytes somebody else chose, and a rule
 * it depends on must not live only in a proxy it does not ship with.
 *
 * <p><b>The cache is a year and it is immutable, which is a sentence about the ADDRESS
 * rather than about the picture.</b> The name is the digest of the content, so bytes behind
 * a given address cannot change: a different picture is a different digest and therefore a
 * different address. That makes revalidation pure cost - there is no answer it could ever
 * come back with but „unchanged" - and it is the same reasoning the portal's own
 * {@code /assets/*} are served under (ADL, edge rules of 09.09.2026). <b>It is reasoning
 * and not a recorded decision, and it has a boundary:</b> {@code public} lets a shared
 * cache keep a copy for a year, which is harmless only while the address is the whole of
 * the permission. The day a picture becomes something only some people may read, this
 * header changes with it, because a shared cache will not ask again for a year.
 *
 * <p><b>It is open to a visitor, and by a list of its own.</b>
 * {@link ApiSecurity#READ_BY_ANYBODY_UNDER_A_NAME} says why the existing list could not
 * carry it: every entry there is a whole address, and this one is an address with a name in
 * it.
 */
@RestController
class PhotoApi {

	private static final Logger LOG = LoggerFactory.getLogger(PhotoApi.class);

	/**
	 * THE SHAPE THE SCHEMA ITSELF CHECKS, spelt the same way here.
	 *
	 * <p>V8's {@code photo_digest_shape} is {@code digest ~ '^[0-9a-f]{64}$'}, so a name
	 * that is not this shape cannot be any row's digest and there is nothing to look for.
	 * Asked here rather than left to the query, because „nothing was found" and „nothing
	 * could be found" are the same answer to the caller and two different things to the
	 * server: the second costs no round trip, and a name carrying a dot, a slash or a
	 * percent never reaches anything that could be asked to resolve it.
	 *
	 * <p><b>LOWERCASE, and that is the whole of it.</b> PostgreSQL compares text exactly,
	 * so an uppercased spelling of a digest that really exists finds no row anyway; what
	 * this adds is that the two spellings take the same road rather than two, and
	 * {@code aDigestSpeltInCapitalsIsNobody} measures it against a digest whose row and
	 * whose file are both there.
	 */
	private static final Pattern A_DIGEST = Pattern.compile("^[0-9a-f]{64}$");

	/** A year, which is the longest any cache is asked to believe anything. */
	private static final Duration FOR_A_YEAR = Duration.ofDays(365);

	private final JdbcClient db;

	private final Path folder;

	/**
	 * @param folder where the files are, which is a setting because QA and production are
	 *               two installations of one portal and neither is this machine. ADL A41,
	 *               11.09.2026: „Imenovan Docker volumen uz bazu, montiran samo u bekend."
	 *               Its default is a developer's temporary folder, and what that means is
	 *               an empty one: on a machine nobody has uploaded to, every picture is an
	 *               address that is not there, which is the true answer
	 */
	PhotoApi(JdbcClient db, @Value("${btl.photos.folder}") String folder) {
		this.db = db;
		this.folder = Path.of(folder);
	}

	/** The two things the row decides: where the file is, and what it is. */
	private record Kept(long id, String mediaType) {
	}

	/**
	 * @param name     the digest of the content, which is an address and never a path
	 * @param response asked for so that every refusal goes down the same road an address
	 *                 that is not there takes, exactly as {@link InboxApi#inbox} and
	 *                 {@link VerificationApi#verification} do
	 */
	@GetMapping("/api/photos/{name}")
	ResponseEntity<byte[]> photo(@PathVariable String name, HttpServletResponse response)
			throws IOException {

		if (!A_DIGEST.matcher(name).matches()) {
			return nothingIsHere(response);
		}

		Optional<Kept> kept = db
				.sql("select id, media_type from photo where digest = :digest order by id limit 1")
				.param("digest", name)
				.query((row, one) -> new Kept(row.getLong(1), row.getString(2)))
				.optional();

		if (kept.isEmpty()) {
			return nothingIsHere(response);
		}

		byte[] bytes;

		try {
			/* THE NAME OF THE FILE IS THE KEY OF THE ROW AND NOTHING ELSE TOUCHES IT. Not
			   `name`, which came over the wire; not the digest, which is the same string.
			   A `long` written out is digits, so there is no spelling of it that leaves
			   this folder, and `PhotoApiTest.theBytesAreTheRowsAndNotTheAddressesOwn`
			   keeps a decoy file named after the digest to say which of the two was
			   read. */
			bytes = Files.readAllBytes(folder.resolve(String.valueOf(kept.get().id())));
		} catch (IOException noFile) {
			/* THE ONLY PLACE THIS FAULT EXISTS. The caller is told what a caller of a
			   digest nobody wrote is told, so a row and its absence cannot be told apart
			   from outside; whoever runs the server is told here, because a row whose file
			   has gone is a backup that did not cover the volume (ADL A41, „rezervna kopija
			   mora da pokrije i volumen, a danas ne pokriva nista"). */
			LOG.warn("photo {} names a row whose file could not be read under {}", name, folder,
					noFile);
			return nothingIsHere(response);
		}

		return ResponseEntity.ok()
				.contentType(MediaType.parseMediaType(kept.get().mediaType()))
				.cacheControl(CacheControl.maxAge(FOR_A_YEAR).cachePublic().immutable())
				/* Spring writes this header for the pages it serves and for nothing it does
				   not; this answer is bytes somebody else chose, and the type on it is only
				   as good as the browser's willingness to believe it. */
				.header("X-Content-Type-Options", "nosniff")
				.body(bytes);
	}

	/**
	 * THE ONE ANSWER, so that the three ways of getting here cannot drift apart.
	 *
	 * <p>Written three times it would be three chances for one of them to become a
	 * different sentence - a status set on the response rather than sent as an error is
	 * already a different answer on the wire, measured byte for byte on 13.09.2026 - and
	 * the whole point is that a name of the wrong shape, a digest nobody wrote and a row
	 * whose file has gone are indistinguishable from outside.
	 */
	private static ResponseEntity<byte[]> nothingIsHere(HttpServletResponse response)
			throws IOException {
		response.sendError(HttpStatus.NOT_FOUND.value());
		return null;
	}
}
