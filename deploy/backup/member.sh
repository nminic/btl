#!/bin/sh
# WHAT check.sh DOES WITH ONE MEMBER OF THE ARCHIVE, run by GNU tar's --to-command once per file,
# with the member's bytes on standard input and its name and size in TAR_FILENAME and TAR_SIZE.
#
# A photograph is never written anywhere: its bytes go into sha256sum and only the digest is kept,
# beside the name and the size the archive gives it. The dump and the manifest are written into
# the check folder, which is in the work folder, which is memory. Anything else in the archive is
# read to its end, so tar can go on, and named as unexpected.

set -eu

case "$TAR_FILENAME" in
  manifest | btl.dump)
    cat > "$CHECK_OUT/$TAR_FILENAME"
    ;;
  photos/?*)
    digest=$(sha256sum | cut -c1-64)
    printf '%s %s %s\n' "${TAR_FILENAME#photos/}" "$TAR_SIZE" "$digest" >> "$CHECK_OUT/files"
    ;;
  *)
    cat > /dev/null
    printf '%s\n' "$TAR_FILENAME" >> "$CHECK_OUT/unexpected"
    ;;
esac
