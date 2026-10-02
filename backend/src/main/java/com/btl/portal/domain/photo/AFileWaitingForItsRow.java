package com.btl.portal.domain.photo;

import java.time.Duration;
import java.time.Instant;
import java.util.OptionalLong;

/**
 * WHAT IN THE PICTURES FOLDER MAY BE A PICTURE'S FILE, AND HOW LONG SUCH A FILE MAY STAND
 * THERE BEFORE ITS ROW.
 *
 * <p><b>THE DECISION THIS CARRIES</b> is the owner's choice, among the outcomes offered with my
 * recommendation beside the one he took, that a leftover picture file is swept by the server
 * itself (the journal's „Zaostao fajl slike brise automatski cistac"). The sentence under it is
 * mine and the choice is his, and it says the server deletes „fajlove slika koji nemaju svoj
 * red" once they are older than ten minutes. This class is the two questions that sentence
 * asks of a single file and that need no database and no disk: <i>whose picture is this
 * file</i> and <i>has it stood long enough</i>. Whether a row exists is the database's to
 * say and is asked in {@code ThePicturesFolderIsSwept}, which is also what reads the disk.
 *
 * <p><b>A FILE HAS A ROW BEFORE IT HAS A COMMITTED ONE, AND THAT IS WHY THERE IS A LIMIT AT
 * ALL.</b> The route that writes a picture inserts its {@code photo} row, writes the file under
 * the key the database issued, and only then lets the transaction commit. For that moment a
 * perfectly good picture is a file that no row can be found for. A sweep that deleted at once
 * would take pictures that are being uploaded. Ten minutes is the number in the sentence the
 * owner chose; that it is there to cover this moment is my reading of it, and that it is far
 * beyond any request this portal answers is my reasoning and not a measurement.
 *
 * <p><b>THE AGE IS THE FILE'S OWN LAST WRITE, AND THAT IS MY READING AND NOT THE OWNER'S WORD
 * ABOUT IT.</b> The sentence says „stariji", not by what. A file is written once and never
 * again by this portal, so its time of last modification is the time it was put there, it is
 * what every file system keeps, and it is what a case can set without waiting. <b>What it costs
 * is named below and in {@code ThePicturesFolderIsSwept}:</b> a copy that keeps the times
 * arrives looking as old as the file it copies.
 *
 * <p><b>STRICTLY OLDER.</b> Older than ten minutes is exactly that: a file exactly ten minutes
 * old is not older than that. A file dated in the future - a clock that stepped back, a volume
 * copied from a machine that was ahead - is not older than anything, so it stays.
 *
 * <p><b>A NAME IS A KEY WHEN IT IS WHAT THE WRITER WRITES.</b> The route names a file
 * {@code String.valueOf(photo)} of the key the database issued, so a name belongs to a picture
 * exactly when it is the {@code String.valueOf} of a positive {@code long}. That is asked of the
 * writer's own call and not of a pattern: {@code Long.parseLong} alone would also accept a
 * leading zero, a sign, and a digit of another alphabet, none of which the writer can produce,
 * and a sweep that deleted by „looks like a number" would take files that are nobody's picture.
 * Anything else in the folder - another name, an extension, a number no {@code bigserial} will
 * reach - is not this portal's picture and is never a candidate.
 *
 * <p>Nothing under {@code domain} touches a database, a disk or a framework, and nothing here
 * does: the same arrangement {@link WhatAPictureIs} has for the questions that can be asked of
 * a file's bytes.
 */
public final class AFileWaitingForItsRow {

	/**
	 * HOW LONG A FILE MAY STAND BEFORE ITS ROW IS VISIBLE, and no longer than this before it
	 * counts as a leftover. The number is in the sentence the owner chose: it came to him with
	 * that sentence, so it is his by choice and mine by origin.
	 */
	private static final Duration MAY_WAIT = Duration.ofMinutes(10);

	private AFileWaitingForItsRow() {
	}

	/**
	 * WHOSE PICTURE A FILE IS, by its name, or nobody's.
	 *
	 * @param name the name of one entry in the pictures folder, never null
	 * @return the key the name stands for, or empty for any name the writer cannot have written
	 */
	public static OptionalLong keyOf(String name) {
		long key;

		try {
			key = Long.parseLong(name);
		}
		catch (NumberFormatException notANumber) {
			return OptionalLong.empty();
		}

		return key > 0 && String.valueOf(key).equals(name) ? OptionalLong.of(key) : OptionalLong.empty();
	}

	/**
	 * WHETHER A FILE WRITTEN AT {@code modified} HAS STOOD LONGER THAN TEN MINUTES AT
	 * {@code now}. Strictly: exactly ten minutes is not longer.
	 */
	public static boolean hasWaitedLongEnough(Instant modified, Instant now) {
		return modified.isBefore(now.minus(MAY_WAIT));
	}
}
