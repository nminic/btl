/* THE CROP IS THREE FRACTIONS, AND THE THIRD OF THEM IS A DIAMETER.
 *
 * ADL A17, owner's decision of 15.08.2026: "Isecak se pamti kao tri broja
 * izmedju 0 i 1, nikad kao pravougaonik u pikselima." The third number is the
 * side of the square as a fraction of the picture's SHORTER edge, and `x` and
 * `y` are where that square sits along whatever room is left over: 0 flush
 * against the start, 1 against the end, 0.5 in the middle.
 *
 * Why fractions and not pixels, in the decision's own words: a pixel has to be
 * clamped against a width nobody has yet. The file is chosen in one browser,
 * cropped in another and looked at by a moderator in a third, and a rectangle
 * written in pixels is wrong in all but the first the moment anybody resizes a
 * window. A fraction means the same thing at every size, the limit is always 0
 * and 1, and there is nothing to clamp.
 *
 * V8 wrote the three as `integer`, which cannot hold a fraction at all: the only
 * values an integer column can take between 0 and 1 are 0 and 1. So the columns
 * were in pixels, which is exactly what A17 forbids, and its own CHECK
 * (`crop_x >= 0 and crop_y >= 0 and crop_side > 0`) said so out loud by being
 * the only bound a pixel offset can have. A migration is immutable once merged
 * (ADL A2), so V8 is left exactly as it is and the correction is here.
 *
 * AND THE SHAPE IS A CIRCLE, NOT A SQUARE. Owner, 23.08.2026: "isecak je krug,
 * ne kvadrat". The whole picture is still kept and the member chooses a circular
 * crop out of it. What does NOT change is how many numbers that takes: a circle
 * is described by the same three, so `crop_side` is renamed rather than replaced.
 *
 * `crop_diameter` AND NOT `crop_radius`, and that is the whole reason for the
 * name. The circle is the one inscribed in the old square, so its DIAMETER is
 * the old side: the number means exactly what it has meant all along, and
 * `crop_x` and `crop_y` go on meaning "where the bounding square sits along what
 * is left over" without being touched. A radius would describe the same crop with
 * a different number and would quietly change the meaning of the other two.
 *
 * NUMERIC AND NOT DOUBLE PRECISION, decided here rather than left to taste.
 * ADL A12 already settles the principle twice for this schema - amounts are
 * "NUMERIC, nikad double", and the distance comparison must be over a decimal
 * type "jer bi tada 21.1 umelo da promasi samo sebe" - and the crop is the same
 * question wearing different clothes. The rule this migration adds is about the
 * EXACT boundaries 0 and 1, and `double precision` cannot be trusted at a
 * boundary: a value that left the browser as the decimal text "1" can come back
 * from binary rounding a hair above it, so a crop would be accepted or refused by
 * an accident of representation instead of by the rule. Exact decimal also means
 * what the member chose is what is stored and what is read back, byte for byte,
 * on every trip through JSON.
 *
 * `numeric(9, 8)` gives one digit before the point, so 0 and 1 are exact, and
 * eight after it. Eight is not a shrug: it is a hundred millionth of the shorter
 * edge, which on a picture of ten thousand pixels is a ten thousandth of a pixel,
 * far finer than any crop a browser can express and far coarser than the
 * seventeen digits of floating point noise a browser would otherwise hand over.
 * Declaring the scale says out loud how finely two crops may be told apart.
 *
 * WHAT HAPPENS TO ROWS THAT ARE ALREADY THERE. Nothing writes this table yet, so
 * in practice there are none, but a migration has to be right when there are.
 * The old numbers are PIXELS measured against a width this table never stored,
 * which is precisely why A17 exists: they cannot be converted, not by this
 * migration and not by anything else, because the fact needed to convert them was
 * never written down. Converting them by cast would also fail outright - 512
 * does not fit in `numeric(9, 8)` - so every existing row is set to the whole
 * picture instead, and the loss is said here rather than discovered later. The
 * value is the portal's own `WHOLE` (`frontend/src/components/crop.ts`): the
 * largest circle there is, centred in what it cannot cover. That is what a
 * picture with no crop of its own already means everywhere in the portal, so a
 * row that loses its crop lands on the default rather than on a number nobody
 * chose.
 *
 * AND THAT HALF HAS NO TEST OVER IT, which is written down here rather than left
 * to be found. Every test database is handed over empty by
 * Testcontainers, so the suite only ever runs these statements against a `photo`
 * with nothing in it: what it measures is the schema afterwards, never the
 * conversion. It was measured by hand instead, on `postgres:18`, against a table
 * of this shape holding two pixel-era rows - (0, 0, 512) and (37, 12, 256) - and
 * both came out as the whole picture with every rule below in place. A guard that
 * would say this on every build has to build a V8-era table of its own and re-run
 * this file against it, which is a larger thing than the migration it would be
 * guarding.
 *
 * THE OLD CHECK GOES AND THE HALF OF IT THAT WAS ALIVE STAYS. V8's
 * `photo_crop_inside` said three things: an offset is never negative, and a side
 * is never nothing. The first two are replaced by a bound on both ends. The third
 * is kept, and deliberately: `crop_diameter` is `> 0` and not `>= 0`, because a
 * circle of no diameter is not a crop of a photograph, it is the absence of one.
 * The portal is stricter still - it refuses a circle under 240 real pixels
 * (`SMALLEST_PIXELS`) - and the schema cannot say that, because it would have to
 * know the shape of the picture. So the schema says the part it can know, and the
 * part it cannot is written down here as a boundary rather than left to be found.
 */

/* First, because it names `crop_side` and speaks of pixels. Its live half is
   carried on by `photo_crop_diameter_in_range` below. */
alter table photo
    drop constraint photo_crop_inside;

/* The USING expression throws the old value away instead of casting it, which is
   the honest reading of "these are pixels and nothing here can convert them".
   Written per column rather than as an UPDATE afterwards because a cast of a
   pixel value would fail before any UPDATE could run. */
alter table photo
    alter column crop_x    type numeric(9, 8) using 0.5,
    alter column crop_y    type numeric(9, 8) using 0.5,
    alter column crop_side type numeric(9, 8) using 1;

alter table photo
    rename column crop_side to crop_diameter;

/* A column rename leaves the names of its constraints alone, so the NOT NULL
   that PostgreSQL generated for `crop_side` would go on carrying the old word
   for a column that no longer has it. */
alter table photo
    rename constraint photo_crop_side_not_null to photo_crop_diameter_not_null;

alter table photo
    /* Both ends closed, on each number separately: a crop wrong in one axis is
       not the same fault as a crop wrong in the other, and one rule covering all
       three could not say which. `between` is inclusive, which is the point -
       0 and 1 are legal positions and not edge cases. */
    add constraint photo_crop_x_in_range check (crop_x between 0 and 1),
    add constraint photo_crop_y_in_range check (crop_y between 0 and 1),
    /* And nothing is not a circle. See the head of this file. */
    add constraint photo_crop_diameter_in_range check (crop_diameter > 0 and crop_diameter <= 1);
