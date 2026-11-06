/*
 * A PICTURE STORED BEFORE THE PORTAL TOOK METADATA OFF MAY STILL CARRY IT, AND THE ROW SAYS SO.
 *
 * ADL, owner, 06.11.2026, chosen among the outcomes offered, with my recommendation: "Server pri svakom
 * otpremanju slike (član i administracija) skida sve metapodatke (EXIF, uključujući GPS, datum i model
 * uređaja) pre upisa, a pravilnu orijentaciju zadržava; postojeće slike na produkciji se jednom očiste."
 * The two doors that store a picture take it off from the release that carries this file on
 * (WithoutMetadata). The files already on the volume were stored as they were sent, and this column is
 * what tells the one-time clean-up (OldPicturesAreCleaned) which rows those are.
 *
 * EVERY ROW ALREADY STANDING IS TRUE, AND EVERY ROW WRITTEN AFTER THIS IS FALSE, and that is the whole of
 * the file: the column is added with the default true, which PostgreSQL gives to every existing row, and
 * the default is then turned to false for the rows to come. The clean-up turns a row false once its file
 * has been cleaned and its digest written again, so the column is also the record that a row was done.
 *
 * WHY THE DEFAULT IS FALSE AND THE TWO DOORS DO NOT WRITE IT: a row nobody stored through a door - a test
 * that inserts one, a pour from QA - is not a row this clean-up should rewrite behind its back, and the
 * clean-up runs at every start of every process, tests included. What the false of a NEW row rests on is
 * that both doors take the metadata off, and their own cases hold that.
 *
 * NOT NULL over rows already there: measured by PhotoMayCarryMetadataCarriedOverTest, which takes the
 * column away, writes a picture as a database in use holds it, and runs this file over it.
 */
alter table photo add column may_carry_metadata boolean not null default true;

alter table photo alter column may_carry_metadata set default false;
