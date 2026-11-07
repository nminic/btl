package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V88 DOES TO THE PICTURES ALREADY STORED, AND TO THE ONES STORED AFTER IT, on a real database.
 *
 * <p>V88 adds {@code photo.may_carry_metadata}, NOT NULL, and the whole of what it means is in which rows get
 * which value: every row already standing is TRUE, because it was stored as it was sent and the one-time
 * clean-up (ADL, owner, 06.11.2026, „postojeće slike na produkciji se jednom očiste") must reach it; every row
 * written after it is FALSE, because the doors clean a picture before they store it. A migration that gave the
 * old rows false would leave every picture on production with the place it was taken, and the clean-up would
 * find nothing to do; one that left the default true would have the clean-up rewrite, behind its back, every
 * row a test or a pour from QA writes.
 *
 * <p>The shape is {@link MembershipCarriedOverTest}'s ({@code btl/CLAUDE.md}, after V35 failed on QA): take
 * away what the migration adds, write a picture the way a database in use holds one, and run THE FILE ITSELF
 * over it ({@link DatabaseTest#migrationSql}). All of it inside the test's transaction, rolled back.
 */
class APhotoMayCarryMetadataCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	@BeforeEach
	void whatThePortalHeldBeforeV88() {
		jdbc.execute("alter table photo drop column may_carry_metadata");
	}

	private long aPhoto(String digest) {
		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
						+ " values ('image/jpeg', 40960, ?, 0.3, 0.7, 0.45) returning id")
				.param(digest)
				.query(Long.class).single();
	}

	private boolean mayCarry(long photo) {
		return db.sql("select may_carry_metadata from photo where id = ?").param(photo).query(Boolean.class).single();
	}

	@Test
	void aPictureAlreadyStoredMayCarryMetadataAndOneStoredAfterDoesNot() {
		long before = aPhoto(String.format("%064x", 0xb3060001L));

		jdbc.execute(migrationSql("88"));

		long after = aPhoto(String.format("%064x", 0xb3060002L));

		assertThat(mayCarry(before)).as("a picture stored before V88 is not marked for the clean-up").isTrue();
		assertThat(mayCarry(after)).as("a picture stored after V88 is marked for the clean-up").isFalse();
	}
}
