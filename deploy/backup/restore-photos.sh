#!/bin/sh
# PUTS THE PHOTOGRAPHS OF ONE COPY BACK INTO THE PHOTOGRAPH VOLUME, AFTER THE DATABASE.
#
# Run by deploy/restore.sh in a container of the production database's image, with no network, the
# work folder mounted read only and the photograph volume mounted WRITABLE, after the dump has been
# restored and while the backend is stopped:
#
#   restore-photos.sh <work folder> <encrypted copy> <photos folder>
#
# THE DATABASE FIRST, THE PHOTOGRAPHS AFTER IT, AND WITH THE BACKEND STOPPED. The backend deletes,
# once an hour, every file in that folder that no `photo` row names and that is older than ten
# minutes by its own time of last modification (ThePicturesFolderIsSwept). With the rows already
# restored, every file that has a row is a file the sweep keeps.
#
# AND `-m`, SO EVERY FILE IS AS YOUNG AS THE RESTORE, which is the half that does not depend on the
# order being kept. tar would otherwise give each file the time it had on the night of the copy, so a
# restore run in the other order, or a database restore that failed and was run again after the
# photographs, would hand the sweep files that look old and have no row yet, and it would delete
# them within the hour. It is the same reason deploy/pour-from-qa.sh copies without times.
#
# --numeric-owner, because the files belong to the backend's uid (1001, backend/Dockerfile), which
# has no name in this image; by number they go back to that uid and to nobody else.
#
# It overwrites a file of the same name and deletes nothing: a file in the volume that the copy does
# not carry stays, and the sweep removes it if no row names it.

set -eu
umask 077

WORK=${1:?restore-photos.sh needs the work folder}
COPY=${2:?restore-photos.sh needs the encrypted copy}
PHOTOS=${3:?restore-photos.sh needs the photos folder}

fail() { printf 'REFUSED: %s\n' "$*" >&2; exit 1; }

[ -s "$COPY" ] || fail "there is no copy at $COPY"
[ -d "$PHOTOS" ] || fail "$PHOTOS is not a folder, so the photograph volume is not mounted"
[ "$(basename "$PHOTOS")" = photos ] || fail "the volume has to be mounted at a folder called photos, which is the name the copy carries them under"

GNUPGHOME=$(mktemp -d "${TMPDIR:-/dev/shm}/gnupg.XXXXXX")
export GNUPGHOME
finish() { gpgconf --kill gpg-agent >/dev/null 2>&1 || true; rm -rf "$GNUPGHOME"; rm -f "${STATUS:-}"; }
trap finish EXIT
STATUS=$(mktemp "${TMPDIR:-/dev/shm}/gpg-status.XXXXXX")

if ! { if gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$WORK/passphrase" --decrypt "$COPY"; then
         printf '0\n' > "$STATUS"
       else
         printf '%s\n' "$?" > "$STATUS"
       fi; } \
     | tar -xf - -m --numeric-owner -C "$(dirname "$PHOTOS")" photos; then
  fail 'tar could not put the photographs back'
fi
[ "$(cat "$STATUS")" = 0 ] || fail 'gpg refused the copy, so what tar wrote may not be the copy; check it with check.sh before anything else'

printf 'restored %s photographs into %s\n' "$(find "$PHOTOS" -type f | wc -l | tr -d ' ')" "$PHOTOS"
