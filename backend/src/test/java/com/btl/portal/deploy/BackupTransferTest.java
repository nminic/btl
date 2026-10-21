package com.btl.portal.deploy;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.Container.ExecResult;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.images.builder.Transferable;
import org.testcontainers.utility.DockerImageName;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT {@code deploy/backup/transfer.sh}, {@code alert.sh} AND {@code write-settings.sh} DO, RUN IN
 * THE IMAGE THEY RUN IN ON THE HOST AND MEASURED AGAINST STAND-INS ON A LOOPBACK.
 *
 * <p>The container is {@code eclipse-temurin:21-jre}, the image {@code deploy/backup.sh} runs curl
 * in, started with NO NETWORK: everything here talks to {@code 127.0.0.1} inside it, so not one
 * byte leaves the machine and nothing pretends to be Cloudflare or Brevo on a real address. The
 * stand-ins are {@code src/test/resources/backup/fake-r2.pl} and {@code fake-relay.pl}, written with
 * the perl the image already carries.
 *
 * <p><b>What this does NOT claim, written down rather than left to be found.</b> The stand-in for
 * R2 does not check a signature, and it answers the MD5 of the body as its ETag because that is what
 * S3 does for one PUT. Whether R2 accepts what curl signs, and whether R2's ETag is that MD5, are
 * the first steps of the first real run ({@code deploy/README.md}). What IS measured is the other
 * side, which no real run would show this clearly: what our script sends, and what it does with
 * each answer - above all, that an answer it did not expect fails the run.
 */
class BackupTransferTest {

	private static final Path BACKUP = Path.of("..", "deploy", "backup");

	private static final Path RESOURCES = Path.of("src", "test", "resources", "backup");

	private static final String THERE = "/tmp/bkp-scripts";

	private static final AtomicInteger NEXT_PORT = new AtomicInteger(18100);

	private static GenericContainer<?> image;

	@BeforeAll
	@SuppressWarnings("resource")
	static void theImageTheScriptsRunIn() {
		image = new GenericContainer<>(DockerImageName.parse(BackupScriptTest.transferImage()))
				.withNetworkMode("none")
				.withCreateContainerCmdModifier(create -> create.withEntrypoint("sleep"))
				.withCommand("infinity");
		image.start();

		for (String script : List.of("transfer.sh", "alert.sh", "write-settings.sh")) {
			put(BACKUP.resolve(script), THERE + "/" + script);
		}
		put(RESOURCES.resolve("fake-r2.pl"), THERE + "/fake-r2.pl");
		put(RESOURCES.resolve("fake-relay.pl"), THERE + "/fake-relay.pl");
	}

	@AfterAll
	static void stopIt() {
		if (image != null) {
			image.stop();
		}
	}

	/** Read with CRLF folded to LF: a Windows checkout carries CRLF, which sh reads as part of every word. */
	static byte[] lf(Path file) {
		try {
			return Files.readString(file, StandardCharsets.UTF_8).replace("\r\n", "\n")
					.getBytes(StandardCharsets.UTF_8);
		}
		catch (IOException cannotRead) {
			throw new UncheckedIOException("cannot read " + file, cannotRead);
		}
	}

	private static void put(Path file, String where) {
		image.copyFileToContainer(Transferable.of(lf(file)), where);
	}

	private static ExecResult sh(String command) {
		try {
			return image.execInContainer("sh", "-c", command);
		}
		catch (IOException | InterruptedException cannot) {
			throw new IllegalStateException("could not run in the container: " + command, cannot);
		}
	}

	private static String out(String command) {
		return sh(command).getStdout().strip();
	}

	/** A fresh work folder in the container's memory, with the stand-in for R2 listening, and its port. */
	private record Bucket(String work, String folder, int port) {
	}

	private static Bucket aBucket() {
		int port = NEXT_PORT.getAndIncrement();
		String work = out("mktemp -d /dev/shm/bkp-work.XXXXXX");
		String folder = out("mktemp -d /dev/shm/bkp-r2.XXXXXX");
		sh("cd /tmp && nohup perl " + THERE + "/fake-r2.pl " + port + " " + folder + " > /dev/null 2>&1 &");
		sh("i=0; while [ ! -e " + folder + "/ready ] && [ $i -lt 100 ]; do sleep 0.1; i=$((i+1)); done");
		assertThat(out("[ -e " + folder + "/ready ] && echo up")).as("the stand-in for R2 did not start").isEqualTo("up");

		sh("printf 'user = \"AKIDBKPTEST:THE-SECRET-HALF\"\\n' > " + work + "/r2.curl");
		sh("printf 'http://127.0.0.1:" + port + "/btl-kopije\\n' > " + work + "/r2.base");
		return new Bucket(work, folder, port);
	}

	private static ExecResult transfer(Bucket bucket, String arguments) {
		return sh("sh " + THERE + "/transfer.sh " + bucket.work() + " " + arguments);
	}

	private static String aFile(Bucket bucket, String name, int bytes) {
		String file = bucket.work() + "/" + name;
		sh("head -c " + bytes + " /dev/urandom > " + file);
		return file;
	}

	/**
	 * A COPY IS SENT SIGNED, WITH ITS BODY'S DIGEST SIGNED, AND ITS ARRIVAL IS ASKED OF THE BUCKET.
	 *
	 * <p>Read off what the stand-in actually received: a PUT to the bucket's path under the key, a
	 * version 4 signature for the region R2 asks for, the body's sha256 in a header that is ONE OF
	 * THE SIGNED ONES (so R2 refuses a body that is not the one hashed), and then a HEAD on the same
	 * key, which is how the script learns what arrived. The secret half of the key travels nowhere:
	 * a signature is made from it, and it is not in any request.
	 */
	@Test
	void aCopyIsSentSignedWithItsDigestAndItsArrivalIsAskedOfTheBucket() {
		Bucket bucket = aBucket();
		String file = aFile(bucket, "copy.gpg", 300_000);

		ExecResult sent = transfer(bucket, "put " + file + " daily/btl-2026-10-20T020000Z.gpg");

		assertThat(sent.getExitCode()).as("put failed: %s", sent.getStderr()).isZero();
		assertThat(sent.getStdout()).contains("arrived whole");

		String requests = out("cat " + bucket.folder() + "/requests");
		String digest = out("sha256sum " + file + " | cut -c1-64");
		List<String> lines = requests.lines().toList();

		assertThat(lines).as("one PUT and then one HEAD, in that order: %s", requests).hasSize(2);
		assertThat(lines.get(0))
				.startsWith("PUT /btl-kopije/daily/btl-2026-10-20T020000Z.gpg ")
				.contains("Authorization: AWS4-HMAC-SHA256 Credential=AKIDBKPTEST/")
				.contains("/auto/s3/aws4_request")
				.containsPattern("SignedHeaders=[a-z0-9;-]*x-amz-content-sha256")
				.contains("x-amz-content-sha256: " + digest);
		assertThat(lines.get(1)).startsWith("HEAD /btl-kopije/daily/btl-2026-10-20T020000Z.gpg ");
		assertThat(requests).as("the secret half of the key is in a request").doesNotContain("THE-SECRET-HALF");

		assertThat(out("md5sum " + file + " | cut -c1-32"))
				.as("what the stand-in holds is what was sent")
				.isEqualTo(out("md5sum " + bucket.folder() + "/objects/%2Fbtl-kopije%2Fdaily%2Fbtl-2026-10-20T020000Z.gpg | cut -c1-32"));
	}

	/**
	 * AN ARRIVAL THE BUCKET DOES NOT CONFIRM IS A FAILED RUN.
	 *
	 * <p>The stand-in answers an ETag that is not the MD5 of what it holds. A script that sent and
	 * took a 200 for an answer would report this copy as kept; this one has to fail and say why.
	 * And the same for a fetch: what comes back has to be what the bucket says it holds.
	 */
	@Test
	void anArrivalWhoseETagIsNotTheBodysFailsAndSoDoesAFetch() {
		Bucket bucket = aBucket();
		String file = aFile(bucket, "copy.gpg", 50_000);

		ExecResult first = transfer(bucket, "put " + file + " daily/a.gpg");
		assertThat(first.getExitCode()).as("the floor: an honest bucket takes it: %s", first.getStderr()).isZero();

		sh("touch " + bucket.folder() + "/wrong-etag");

		ExecResult sent = transfer(bucket, "put " + file + " daily/b.gpg");
		assertThat(sent.getExitCode()).as("a copy whose arrival is not confirmed was reported as sent").isNotZero();
		assertThat(sent.getStderr()).contains("did not arrive whole");

		ExecResult fetched = transfer(bucket, "get daily/a.gpg " + bucket.work() + "/back.gpg");
		assertThat(fetched.getExitCode()).as("a copy that may not be the bucket's was taken as brought back").isNotZero();
		assertThat(fetched.getStderr()).contains("did not come back whole");
	}

	/** A refusal from the bucket is a failed run, with the bucket's own words. */
	@Test
	void aRefusedSendFails() {
		Bucket bucket = aBucket();
		String file = aFile(bucket, "copy.gpg", 1000);
		sh("touch " + bucket.folder() + "/refuse-put");

		ExecResult sent = transfer(bucket, "put " + file + " daily/a.gpg");

		assertThat(sent.getExitCode()).isNotZero();
		assertThat(sent.getStderr()).contains("the bucket refused daily/a.gpg").contains("AccessDenied");
	}

	/**
	 * THE NEWEST COPY IS THE LAST BY TIME, UNDER ITS PREFIX ONLY, AND IT COMES BACK BYTE FOR BYTE.
	 *
	 * <p>Three keys, and the newest daily one is put FIRST, so that "the last one sent" and "the
	 * newest" are not the same answer; and a monthly key that sorts after both, so that the prefix
	 * is what keeps it out.
	 */
	@Test
	void theNewestIsTheLatestUnderItsPrefixAndComesBackWhole() {
		Bucket bucket = aBucket();
		String newer = aFile(bucket, "newer.gpg", 20_000);
		String older = aFile(bucket, "older.gpg", 20_000);
		String monthly = aFile(bucket, "monthly.gpg", 20_000);

		assertThat(transfer(bucket, "put " + newer + " daily/btl-2026-10-20T020001Z.gpg").getExitCode()).isZero();
		assertThat(transfer(bucket, "put " + older + " daily/btl-2026-10-19T020001Z.gpg").getExitCode()).isZero();
		assertThat(transfer(bucket, "put " + monthly + " monthly/btl-2026-11.gpg").getExitCode()).isZero();

		ExecResult newest = transfer(bucket, "newest daily/");
		assertThat(newest.getExitCode()).as(newest.getStderr()).isZero();
		assertThat(newest.getStdout().strip()).isEqualTo("daily/btl-2026-10-20T020001Z.gpg");
		assertThat(out("tail -1 " + bucket.folder() + "/requests")).contains("prefix=daily%2F");

		ExecResult back = transfer(bucket, "get daily/btl-2026-10-20T020001Z.gpg " + bucket.work() + "/back.gpg");
		assertThat(back.getExitCode()).as(back.getStderr()).isZero();
		assertThat(out("sha256sum " + bucket.work() + "/back.gpg | cut -c1-64"))
				.isEqualTo(out("sha256sum " + newer + " | cut -c1-64"));

		ExecResult none = transfer(bucket, "newest proofs/");
		assertThat(none.getExitCode()).as("an empty prefix named a newest copy").isNotZero();
	}

	/**
	 * THE SETTINGS BECOME FILES, THE EU ADDRESS IS THE BUCKET'S, THE RELAY IS REQUIRED TO ENCRYPT, AND
	 * EVERY SUPERADMIN IS A RECIPIENT.
	 *
	 * <p>Run as the service runs it: the values in the environment, the work folder as its argument.
	 */
	@Test
	void theSettingsBecomeFilesThatNobodyElseCanRead() {
		String work = out("mktemp -d /dev/shm/bkp-settings.XXXXXX");

		ExecResult written = sh("env BTL_BACKUP_R2_ACCOUNT_ID=0123abcd BTL_BACKUP_R2_BUCKET=btl-kopije"
				+ " BTL_BACKUP_R2_ACCESS_KEY_ID=AKID BTL_BACKUP_R2_SECRET_ACCESS_KEY=SECRET"
				+ " BTL_BACKUP_PASSPHRASE='a long passphrase' BTL_BACKUP_MAIL_HOST=smtp-relay.brevo.com"
				+ " BTL_BACKUP_MAIL_PORT=587 BTL_BACKUP_MAIL_USERNAME=login BTL_BACKUP_MAIL_PASSWORD=key"
				+ " BTL_BACKUP_MAIL_TO='one@primer.rs, two@primer.rs' BTL_BACKUP_MAIL_FROM=no-reply@primer.rs"
				+ " sh " + THERE + "/write-settings.sh " + work);

		assertThat(written.getExitCode()).as(written.getStderr()).isZero();
		assertThat(out("cat " + work + "/r2.base"))
				.as("the bucket is in R2's EU jurisdiction, which answers at .eu. (owner, 20.10.2026)")
				.isEqualTo("https://0123abcd.eu.r2.cloudflarestorage.com/btl-kopije");
		assertThat(out("cat " + work + "/r2.curl")).isEqualTo("user = \"AKID:SECRET\"");
		assertThat(out("cat " + work + "/passphrase")).isEqualTo("a long passphrase");
		assertThat(out("cat " + work + "/mail.curl").lines().toList())
				.as("STARTTLS required, as for the backend, and every superadmin a recipient")
				.contains("url = \"smtp://smtp-relay.brevo.com:587\"", "ssl-reqd", "user = \"login:key\"",
						"mail-from = \"no-reply@primer.rs\"", "mail-rcpt = \"one@primer.rs\"",
						"mail-rcpt = \"two@primer.rs\"");
		assertThat(out("stat -c %a " + work + "/r2.curl " + work + "/passphrase " + work + "/mail.curl").lines())
				.as("nobody but the owner reads a key")
				.containsOnly("600");
	}

	/**
	 * AN EMPTY SETTING IS NAMED, AND THE RELAY'S FILES ARE WRITTEN ANYWAY, so the run that refuses
	 * can still say so by mail.
	 */
	@Test
	void anEmptySettingIsNamedAndTheAlertCanStillGo() {
		String work = out("mktemp -d /dev/shm/bkp-settings.XXXXXX");

		ExecResult written = sh("env BTL_BACKUP_R2_ACCOUNT_ID=0123abcd BTL_BACKUP_R2_BUCKET="
				+ " BTL_BACKUP_R2_ACCESS_KEY_ID=AKID BTL_BACKUP_R2_SECRET_ACCESS_KEY="
				+ " BTL_BACKUP_PASSPHRASE= BTL_BACKUP_MAIL_HOST=smtp-relay.brevo.com"
				+ " BTL_BACKUP_MAIL_PORT=587 BTL_BACKUP_MAIL_USERNAME=login BTL_BACKUP_MAIL_PASSWORD=key"
				+ " BTL_BACKUP_MAIL_TO=one@primer.rs BTL_BACKUP_MAIL_FROM=no-reply@primer.rs"
				+ " sh " + THERE + "/write-settings.sh " + work);

		assertThat(written.getExitCode()).isEqualTo(3);
		assertThat(written.getStderr())
				.contains("PROD_BACKUP_R2_BUCKET")
				.contains("PROD_BACKUP_R2_SECRET_ACCESS_KEY")
				.contains("PROD_BACKUP_PASSPHRASE")
				.doesNotContain("PROD_BACKUP_R2_ACCOUNT_ID");
		assertThat(out("[ -s " + work + "/mail.curl ] && echo there")).isEqualTo("there");
		assertThat(out("[ -e " + work + "/passphrase ] || echo absent")).isEqualTo("absent");
	}

	/**
	 * A FAILED RUN IS MAILED TO EVERY SUPERADMIN, WITH THE LINE IT REFUSED WITH.
	 *
	 * <p>Through the stand-in relay, with the settings file write-settings.sh writes minus the one
	 * line the stand-in cannot honour ({@code ssl-reqd}, held by the case above). What is held is
	 * the envelope - both recipients - and the message: who it is from, who it is to, what failed,
	 * and why.
	 */
	@Test
	void aFailedRunIsMailedToEverySuperadminWithItsReason() {
		int port = NEXT_PORT.getAndIncrement();
		String work = out("mktemp -d /dev/shm/bkp-alert.XXXXXX");
		String relay = out("mktemp -d /dev/shm/bkp-relay.XXXXXX");
		sh("cd /tmp && nohup perl " + THERE + "/fake-relay.pl " + port + " " + relay + " > /dev/null 2>&1 &");
		sh("i=0; while [ ! -e " + relay + "/ready ] && [ $i -lt 100 ]; do sleep 0.1; i=$((i+1)); done");

		sh("printf 'url = \"smtp://127.0.0.1:" + port + "\"\\nuser = \"login:key\"\\n"
				+ "mail-from = \"no-reply@primer.rs\"\\nmail-rcpt = \"one@primer.rs\"\\n"
				+ "mail-rcpt = \"two@primer.rs\"\\n' > " + work + "/mail.curl");
		sh("printf 'no-reply@primer.rs\\n' > " + work + "/mail.from");
		sh("printf 'one@primer.rs, two@primer.rs\\n' > " + work + "/mail.to");
		sh("printf 'btl-prod\\n' > " + work + "/host");
		sh("printf 'pg_dump did not pass, and nothing was sent\\n' > " + work + "/failure");

		ExecResult sent = sh("sh " + THERE + "/alert.sh " + work + " 'nightly copy'");

		assertThat(sent.getExitCode()).as(sent.getStderr()).isZero();
		String transcript = out("cat " + relay + "/transcript");
		assertThat(transcript)
				.contains("RCPT TO:<one@primer.rs>")
				.contains("RCPT TO:<two@primer.rs>")
				.contains("From: no-reply@primer.rs")
				.contains("To: one@primer.rs, two@primer.rs")
				.contains("Subject: BTL backup FAILED: nightly copy")
				.contains("The nightly copy on btl-prod did not finish.")
				.contains("pg_dump did not pass, and nothing was sent");
	}
}
