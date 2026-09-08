/* The first migration of the portal: what every table after it may assume.
 *
 * The conventions themselves are decisions and live in ../btl-produkt/ADL.md,
 * section A36. They are named here, in the file that puts them into effect, so
 * that whoever writes the next migration reads them before the schema and not
 * after a review.
 *
 *   O1  A key is a bigserial, and where a thing already has a mark people speak
 *       out loud - a member number, a slug, a country code - that mark stands
 *       beside the key as its own unique column. A row number is never shown
 *       outside the portal.
 *
 *   O2  The day a race is run is a DATE with no zone, because it is a day and
 *       not an instant. Every technical instant is a timestamptz held in UTC.
 *       A season is worked out in Europe/Belgrade, and that is the backend's
 *       job: nothing in this schema stores a season boundary, and no column may
 *       carry a local time as if it were an instant.
 *
 *   O18 Schema changes are V<number>__description.sql, repeatable views are
 *       R__, and a codebook is its own V migration written by a generator that
 *       lives in the repository: backend/tools/generate_reference_migrations.py.
 *
 *   O21 Names sort by the Serbian Latin alphabet, through the ICU collation
 *       created below.
 *
 *
 * WHAT postgres:18 ACTUALLY OFFERS, measured rather than assumed
 * -------------------------------------------------------------
 * Measured on 08.09.2026 against the image the tests run against, PostgreSQL
 * 18.6 (Debian 18.6-1.pgdg13+2):
 *
 *   - Forty six extensions are available. Everything the schema is likely to
 *     reach for is among them: unaccent, pg_trgm, citext, btree_gist,
 *     btree_gin, pgcrypto, uuid-ossp, fuzzystrmatch, hstore, tablefunc,
 *     pg_stat_statements.
 *
 *   - PostGIS is NOT among them, and that is worth knowing before it is needed.
 *     ADL A12 gives an event a pin and the calendar a map; on this image that
 *     is two numeric columns and arithmetic, not a geography type. Adding
 *     PostGIS means a different image, not a CREATE EXTENSION.
 *
 *   - ICU is compiled in: 871 ICU collations are present, against five from
 *     libc and three built in. The collation below therefore creates, and the
 *     predefined "sr-Latn-x-icu" exists as well.
 *
 * NO EXTENSION IS CREATED HERE, and that is a decision rather than an omission.
 * None of the three tables this increment adds needs one, and an extension
 * installed against a use that has not arrived is a footprint on the production
 * database with no test over it. The first migration that needs one creates it.
 */

/* The Serbian Latin alphabet, as its own name.
 *
 * The database the tests and the server run against is created with whatever
 * locale the image defaults to - en_US.utf8 here - and under that collation
 * Cacak, Cacak with a caron and Cvetko come out in an order no Serbian reader
 * would accept. The alphabet has C, C-caron and C-acute as three separate
 * letters, not one letter wearing marks, and only a tailored collation knows
 * that: under the ICU root locale a caron is an accent, so "Cvetko" sorts after
 * "Cacak with a caron" and the two orders differ on real town names.
 *
 * Named here rather than written as "sr-Latn-x-icu" at each column for the
 * usual reason: one fact, one home. The schema says sr_latn, and the day the
 * locale identifier or the provider changes, it changes in this one line.
 *
 * Deterministic on purpose. A non-deterministic collation would make equality
 * ignore case and accents, which sounds useful for searching towns and is not:
 * PostgreSQL will not run LIKE or a regular expression against one, and prefix
 * search over the town codebook is exactly what the field does.
 */
create collation sr_latn (provider = icu, locale = 'sr-Latn', deterministic = true);
