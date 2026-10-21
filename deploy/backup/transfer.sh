#!/bin/sh
# SENDS A FILE TO THE BUCKET, BRINGS ONE BACK, OR NAMES THE NEWEST, AND PROVES EACH ARRIVAL.
#
# Run by deploy/backup.sh and deploy/restore.sh in a container of eclipse-temurin:21-jre, which
# carries curl (measured 20.10.2026: curl 8.18 with SMTP and AWS signatures) and is the image the
# backend is built on, so it is already on the host. With the work folder mounted:
#
#   transfer.sh <work folder> put <file> <key>     send, then ask the bucket what arrived
#   transfer.sh <work folder> get <key> <file>     bring back, then compare with what the bucket says
#   transfer.sh <work folder> newest <prefix>      print the newest key under a prefix
#
# The address of the bucket is <work folder>/r2.base and the keys are <work folder>/r2.curl, both
# written by write-settings.sh. THE KEYS ARE READ BY curl WITH -K FROM THAT FILE AND ARE NEVER AN
# ARGUMENT: an argument is visible in `ps` to every user of the host.
#
# THE SIGNATURE is S3's version 4, which R2 speaks, with the region `auto` R2 asks for. The body's
# sha256 is SIGNED rather than declared unsigned, so R2 refuses a body that is not the one hashed
# here. What curl sends was measured against a stand-in on a loopback (BackupTransferTest): the
# x-amz-content-sha256 header goes into SignedHeaders. Whether R2 ACCEPTS that signature is not
# measurable from here and is the first step of the first real run (deploy/README.md).
#
# AN ARRIVAL IS PROVEN, NOT ASSUMED. After a PUT the bucket is asked with HEAD what it holds under
# the key, and its ETag must be the MD5 of the file sent; after a GET the file brought back must be
# the MD5 the bucket's ETag names. For an object sent in one PUT, S3 answers the MD5 of the body as
# its ETag, and R2 says it follows S3 there; that too is a step of the first real run, because a
# bucket that answered something else would make every run fail here, loudly, rather than pass.

set -eu
umask 077

WORK=${1:?transfer.sh needs the work folder}
ACTION=${2:?transfer.sh needs put, get or newest}

fail() { printf 'REFUSED: %s\n' "$*" >&2; exit 1; }

[ -s "$WORK/r2.curl" ] || fail "there are no R2 keys in $WORK"
[ -s "$WORK/r2.base" ] || fail "there is no R2 address in $WORK"
BASE=$(cat "$WORK/r2.base")

SIGN='aws:amz:auto:s3'

# The ETag the bucket answered for a key, without its quotes, lower case. The headers go to a file
# and are read from it: a status read through a pipe is the status of the last command in it.
etag_of() {
  if ! curl -sS --fail -K "$WORK/r2.curl" --aws-sigv4 "$SIGN" -I -o /dev/null -D "$WORK/head.txt" "$BASE/$1" 2> "$WORK/head.err"; then
    fail "the bucket did not answer for $1: $(cat "$WORK/head.err")"
  fi
  tr -d '\r' < "$WORK/head.txt" | sed -n 's/^[Ee][Tt][Aa][Gg]: *"\{0,1\}\([^"]*\)"\{0,1\}$/\1/p' | tail -1 | tr 'A-F' 'a-f'
}

md5_of() { md5sum "$1" | cut -c1-32; }

case "$ACTION" in
  put)
    FILE=${3:?put needs a file}
    KEY=${4:?put needs a key}
    [ -s "$FILE" ] || fail "there is nothing to send at $FILE"
    digest=$(sha256sum "$FILE" | cut -c1-64)
    if ! curl -sS --fail-with-body -K "$WORK/r2.curl" --aws-sigv4 "$SIGN" \
         -H "x-amz-content-sha256: $digest" -T "$FILE" -o "$WORK/put.body" "$BASE/$KEY" 2> "$WORK/put.err"; then
      fail "the bucket refused $KEY: $(cat "$WORK/put.err") $(head -c 300 "$WORK/put.body" 2>/dev/null || true)"
    fi
    sent=$(md5_of "$FILE")
    held=$(etag_of "$KEY")
    [ "$held" = "$sent" ] \
      || fail "the bucket holds under $KEY something whose ETag is '$held', and what was sent is $sent; the copy did not arrive whole"
    printf 'sent: %s, %s bytes, arrived whole (ETag %s)\n' "$KEY" "$(wc -c < "$FILE" | tr -d ' ')" "$held"
    ;;

  get)
    KEY=${3:?get needs a key}
    FILE=${4:?get needs a file}
    rm -f "$FILE"
    if ! curl -sS --fail -K "$WORK/r2.curl" --aws-sigv4 "$SIGN" -o "$FILE" "$BASE/$KEY" 2> "$WORK/get.err"; then
      fail "the bucket did not give back $KEY: $(cat "$WORK/get.err")"
    fi
    got=$(md5_of "$FILE")
    held=$(etag_of "$KEY")
    [ "$held" = "$got" ] \
      || fail "what came back for $KEY has MD5 $got and the bucket says '$held'; it did not come back whole"
    printf 'brought back: %s, %s bytes, whole (ETag %s)\n' "$KEY" "$(wc -c < "$FILE" | tr -d ' ')" "$held"
    ;;

  newest)
    PREFIX=${3:?newest needs a prefix}
    # The slash of the prefix is written %2F: version 4 signs the query in its encoded form, and an
    # unencoded slash is one more thing a server may canonicalise differently.
    encoded=$(printf '%s' "$PREFIX" | sed 's,/,%2F,g')
    if ! curl -sS --fail -K "$WORK/r2.curl" --aws-sigv4 "$SIGN" -o "$WORK/list.xml" \
         "$BASE?list-type=2&prefix=$encoded" 2> "$WORK/list.err"; then
      fail "the bucket did not list $PREFIX: $(cat "$WORK/list.err")"
    fi
    # The keys carry the moment in UTC, year first, so the newest is the last in byte order. A
    # listing answers up to a thousand keys, and the bucket keeps seven of these.
    tr '<' '\n' < "$WORK/list.xml" | sed -n 's/^Key>//p' | LC_ALL=C sort > "$WORK/list.keys"
    newest=$(tail -1 "$WORK/list.keys")
    [ -n "$newest" ] || fail "the bucket holds nothing under $PREFIX"
    printf '%s\n' "$newest"
    ;;

  *)
    fail "unknown action '$ACTION'; this takes put, get or newest"
    ;;
esac
