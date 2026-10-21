#!/bin/sh
# OPENS ONE ENCRYPTED COPY AND SAYS WHETHER IT IS WHOLE, WITHOUT TRUSTING ANYTHING OUTSIDE IT.
#
# Run by deploy/backup.sh twice: the same night, over the copy it has just made and before it is
# sent, and once a month in the proof, over the copy it has just brought back from R2. And by
# deploy/restore.sh before anything is written. Always in a container of the production database's
# image (gpg, GNU tar, sha256sum, pg_restore), with no network:
#
#   check.sh <work folder> <encrypted copy>
#
# It leaves in <work folder>/check: the dump and the manifest out of the copy, `photos` (every
# `photo` row the DUMP holds: id, size, digest), `files` (every photograph the ARCHIVE holds: id,
# size, the sha256 of its bytes) and `summary`.
#
# WHAT IS CHECKED, and against what:
#
#   1. gpg's integrity check, which fails on a changed byte and on a wrong passphrase (measured, see
#      pack.sh). Its status is read after the stream ends, from a file the left side of the pipe
#      writes: `sh` has no pipefail.
#   2. tar reads the archive to its end, and the archive holds the manifest, the dump, the photos
#      folder and nothing else.
#   3. the dump is the one the manifest names, by its sha256.
#   4. EVERY `photo` ROW READ OUT OF THE DUMP has a file in the archive of THE ROW'S size and THE
#      ROW'S digest. The expectation comes from the row and the measurement from the file, and that
#      direction is the point: a digest computed from the file and compared with the same file says
#      nothing about whether it is the picture the portal stored. The row's digest is the one
#      MePhotoApi wrote from the bytes the member sent.
#
# Exit 0: whole. Exit 1: the copy cannot be used (1 to 3 failed), named on the standard error.
# Exit 3: the copy is whole and decrypts, but at least one row has no matching file, named; the
# database in it is good, and the run that made it has to tell the superadmin.

set -eu
umask 077

WORK=${1:?check.sh needs the work folder}
COPY=${2:?check.sh needs the encrypted copy}
HERE=$(cd "$(dirname "$0")" && pwd)

fail() { printf 'REFUSED: %s\n' "$*" >&2; exit 1; }

[ -s "$COPY" ] || fail "there is no copy at $COPY"
[ -s "$WORK/passphrase" ] || fail "there is no passphrase in $WORK"

OUT="$WORK/check"
rm -rf "$OUT"
mkdir "$OUT" "$OUT/tree"
: > "$OUT/files"
: > "$OUT/unexpected"

GNUPGHOME=$(mktemp -d "$WORK/gnupg.XXXXXX")
export GNUPGHOME
finish() { gpgconf --kill gpg-agent >/dev/null 2>&1 || true; rm -rf "$GNUPGHOME"; }
trap finish EXIT

CHECK_OUT=$OUT
export CHECK_OUT

# --- 1 and 2: decrypt, and read the archive member by member ----------------------------------

# --to-command hands every regular file to member.sh, which writes no photograph anywhere, and
# makes no folder (measured: a folder in the archive is not created). tar runs in tree/ anyway, so
# that nothing it might write lands anywhere but the check folder.
if ! { if gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$WORK/passphrase" \
            --decrypt "$COPY" 2> "$OUT/gpg.err"; then
         printf '0\n' > "$OUT/gpg.status"
       else
         printf '%s\n' "$?" > "$OUT/gpg.status"
       fi; } \
     | tar -xf - -C "$OUT/tree" --to-command="sh $HERE/member.sh" 2> "$OUT/tar.err"; then
  [ "$(cat "$OUT/gpg.status")" = 0 ] \
    || fail "gpg refused the copy: $(grep -a 'gpg:' "$OUT/gpg.err" | head -3 | tr '\n' ' ')"
  fail "tar could not read the archive: $(head -3 "$OUT/tar.err" | tr '\n' ' ')"
fi
[ "$(cat "$OUT/gpg.status")" = 0 ] \
  || fail "gpg refused the copy, so it was changed or the passphrase is not the one it was made with: $(grep -a 'gpg:' "$OUT/gpg.err" | head -3 | tr '\n' ' ')"

[ -s "$OUT/unexpected" ] && fail "the archive holds what a copy does not: $(head -5 "$OUT/unexpected" | tr '\n' ' ')"
[ -s "$OUT/manifest" ] || fail 'the archive holds no manifest'
[ -s "$OUT/btl.dump" ] || fail 'the archive holds no dump'
[ "$(sed -n 1p "$OUT/manifest")" = 'btl-backup 1' ] || fail 'the manifest is not one this script wrote'

# --- 3: the dump is the one the manifest names ------------------------------------------------

named=$(sed -n 's/^dump-sha256 //p' "$OUT/manifest")
found=$(sha256sum "$OUT/btl.dump" | cut -c1-64)
[ -n "$named" ] && [ "$named" = "$found" ] || fail "the dump is not the one the manifest names ($found, not $named)"

# --- 4: every photo row of the dump, against the file the archive carries ---------------------

if ! pg_restore --data-only --table=photo --file="$OUT/photo.copy" "$OUT/btl.dump" 2> "$OUT/pg_restore.err"; then
  fail "pg_restore could not read the photo rows out of the dump: $(grep -a 'error' "$OUT/pg_restore.err" | head -2 | tr '\n' ' ')"
fi

# The columns are found by NAME in the COPY line pg_restore writes, so a migration that adds a
# column to `photo` moves nothing here; one that renames id, byte_size or digest stops this run, and
# that is the right answer for a check whose whole point is those three.
awk -F '\t' -v out="$OUT/photos" '
  /^COPY public\.photo \(/ {
    head = $0
    sub(/^COPY public\.photo \(/, "", head)
    sub(/\) FROM stdin;$/, "", head)
    n = split(head, column, ", ")
    for (i = 1; i <= n; i++) {
      if (column[i] == "id") id = i
      if (column[i] == "byte_size") size = i
      if (column[i] == "digest") digest = i
    }
    if (!id || !size || !digest) { print "the photo table has no id, byte_size or digest column" > "/dev/stderr"; exit 2 }
    inside = 1
    printf "" > out
    next
  }
  inside && /^\\\.$/ { inside = 0; seen = 1; next }
  inside { print $id, $size, $digest > out }
  END { if (!seen) { print "the dump holds no photo table" > "/dev/stderr"; exit 2 } }
' "$OUT/photo.copy" 2> "$OUT/awk.err" || fail "the photo rows could not be read: $(cat "$OUT/awk.err")"

# Every row, by its id, against the file of that id. What a row expects is the ROW's size and the
# ROW's digest; what the file is, is what member.sh measured of its bytes.
awk -v disagree="$OUT/disagree" '
  FNR == NR { file[$1] = $2 " " $3; next }
  {
    if (!($1 in file)) { print "photo " $1 ": no file in the copy" > disagree; next }
    split(file[$1], got, " ")
    if (got[1] != $2) { print "photo " $1 ": the row says " $2 " bytes and the file has " got[1] > disagree; next }
    if (got[2] != $3) { print "photo " $1 ": the file is not the picture its row describes (its sha256 is not the row'"'"'s)" > disagree; next }
  }
' "$OUT/files" "$OUT/photos"

rows=$(wc -l < "$OUT/photos" | tr -d ' ')
files=$(wc -l < "$OUT/files" | tr -d ' ')
strays=$(awk 'FNR == NR { row[$1] = 1; next } !($1 in row)' "$OUT/photos" "$OUT/files" | wc -l | tr -d ' ')

{
  printf 'created %s\n' "$(sed -n 's/^created //p' "$OUT/manifest")"
  printf 'photos %s\n' "$rows"
  printf 'files %s\n' "$files"
  printf 'strays %s\n' "$strays"
} > "$OUT/summary"

printf 'checked: the copy decrypts, the dump is the one its manifest names, %s photo rows, %s files, %s files no row names\n' \
  "$rows" "$files" "$strays"

if [ -s "$OUT/disagree" ]; then
  printf 'BUT %s photo rows have no file that matches them:\n' "$(wc -l < "$OUT/disagree" | tr -d ' ')" >&2
  head -20 "$OUT/disagree" | sed 's/^/  /' >&2
  exit 3
fi
