#!/bin/sh
# MAKES THE ONE ENCRYPTED OBJECT OF THE NIGHT: THE DUMP, A MANIFEST AND EVERY PHOTOGRAPH.
#
# Run by deploy/backup.sh in a container of the production database's own image (which carries
# gpg, tar and sha256sum, and the pg_restore check.sh needs), with no network, the work folder
# mounted and the photograph volume mounted READ ONLY:
#
#   pack.sh <work folder> <photos folder> <encrypted copy>
#
# The work folder already holds `btl.dump`, which deploy/backup.sh took with `pg_dump -Fc` BEFORE
# this runs, and `passphrase`, which write-settings.sh wrote. The encrypted copy is written to the
# path of the third argument, which is NOT in the work folder: ciphertext does not need memory, and
# held there it was one more whole production in the host's RAM (in-memory.sh).
#
# THE DUMP CAME FIRST AND THE PHOTOGRAPHS COME NOW, and the order is the whole of what makes the copy
# consistent without stopping the portal. A photograph's file is written once and never changed,
# under a name that is its row's bigserial id, so a file that exists when the dump is taken still
# exists, unchanged, when tar reads it a moment later; a file uploaded in between belongs to a row
# the dump does not have, and after a restore it is a file nothing names, which the backend's hourly
# sweep removes (ThePicturesFolderIsSwept). The other order would be the harmful one: a row whose
# file was not there when tar passed, which after a restore is a picture that 404s. What can still
# happen in this order is a file DELETED between the two (a member removing a picture), which leaves
# a row in the dump with no file in the archive; check.sh names every such row and the run fails, so
# the superadmin is told.
#
# THE PHOTOGRAPHS ARE NEVER WRITTEN OUT IN PLAIN TEXT. They go from the read-only volume through tar
# straight into gpg. Only the dump and the manifest are in the work folder, and it is memory.
#
# ONE OBJECT AND NOT TWO, because a database and its photographs that travel apart can be restored
# apart, from two different nights. The manifest is inside the encryption, so its claims (when the
# copy was made, what the dump's digest is) are as authenticated as the dump.
#
# gpg: symmetric, AES256, with an integrity check (measured on postgres:18 20.10.2026: packet tag 18,
# a modification detection code, "WARNING: encrypted message has been manipulated!" and exit 2 on
# one changed byte, exit 2 on a wrong passphrase). No compression: the dump is compressed already
# and a photograph does not compress.

set -eu
umask 077

WORK=${1:?pack.sh needs the work folder}
PHOTOS=${2:?pack.sh needs the photos folder}
COPY=${3:?pack.sh needs the path the encrypted copy is written to}

fail() { printf 'REFUSED: %s\n' "$*" >&2; exit 1; }

[ -s "$WORK/btl.dump" ] || fail "there is no dump in $WORK, and the dump is taken before the photographs"
[ -s "$WORK/passphrase" ] || fail "there is no passphrase in $WORK"
[ -d "$PHOTOS" ] || fail "$PHOTOS is not a folder, so the photographs are not mounted"
# The archive names the photographs `photos/<id>`, the name check.sh and restore-photos.sh read, so
# the folder they come out of has to be called that too.
[ "$(basename "$PHOTOS")" = photos ] || fail "the photographs have to be mounted at a folder called photos, not $PHOTOS"

GNUPGHOME=$(mktemp -d "$WORK/gnupg.XXXXXX")
export GNUPGHOME
finish() { gpgconf --kill gpg-agent >/dev/null 2>&1 || true; rm -rf "$GNUPGHOME"; }
trap finish EXIT

# What the dump is, said once, inside the encryption.
dump_digest=$(sha256sum "$WORK/btl.dump" | cut -c1-64)
{
  printf 'btl-backup 1\n'
  printf 'created %s\n' "$(date -u +%s)"
  printf 'dump-sha256 %s\n' "$dump_digest"
  printf 'dump-bytes %s\n' "$(wc -c < "$WORK/btl.dump" | tr -d ' ')"
} > "$WORK/manifest"

rm -f "$COPY" "$WORK/tar.status"

# `sh` has no pipefail, so tar's exit status is written to a file by the left side of the pipe and
# read after it; the status of the pipeline itself is gpg's. --numeric-owner because the files are
# owned by the backend's uid, which has no name in this image, and a restore must give them back to
# that uid and not to whoever has the name somewhere else.
if ! { if tar --numeric-owner -cf - -C "$WORK" manifest btl.dump -C "$(dirname "$PHOTOS")" photos; then
         printf '0\n' > "$WORK/tar.status"
       else
         printf '%s\n' "$?" > "$WORK/tar.status"
       fi; } \
     | gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$WORK/passphrase" \
           --symmetric --cipher-algo AES256 -z 0 -o "$COPY"; then
  fail 'gpg did not encrypt the copy'
fi
[ "$(cat "$WORK/tar.status")" = 0 ] || fail "tar did not read everything (exit $(cat "$WORK/tar.status")), so the copy is not whole"
[ -s "$COPY" ] || fail 'the encrypted copy is empty'

printf 'packed: %s bytes\n' "$(wc -c < "$COPY" | tr -d ' ')"
