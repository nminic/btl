# WHAT THIS TOOL LEAVES BEHIND ON THE HOST, AND WHAT IT SAYS ABOUT A FAILED POUR.
#
# SOURCED by deploy/pour-from-qa.sh, never run by itself, and run on its own - under signals, in a
# real Linux - by PouringFromQaLeavesNothingBehindTest. It is a file of its own for that reason:
# what it does on a signal is a fact about a shell, and the way to hold such a fact is to send the
# signal and look, which cannot be done to a script that needs two live database stacks.
#
# IT NEEDS THREE THINGS from the shell that sources it, and says so rather than hoping:
#   fail      prints its argument and exits non-zero
#   say       prints its argument
#   REFERENCE the name of the throwaway container that has to go on the way out
#
# ---------------------------------------------------------------------------------------------
# WHY THE WORK DIRECTORY IS IN MEMORY.
#
# pour.sql is every table of the database in plain text, and the database holds addresses,
# password hashes, the hashes of LIVE sessions and reset links, names, birth dates, phone and
# document numbers, and the address a parent consented from. A work directory on a disk keeps all
# of it after a SIGKILL, which no trap can catch, and on a Debian host /tmp is emptied by the age
# of a file and not at boot, so the window is days. In memory the same leftover is gone at the next
# reboot and has never been on a disk.
#
# THE FILESYSTEM IS ASKED WHAT IT IS, and the name of a directory is not trusted: TMPDIR is
# whatever the environment says, and /dev/shm on some hosts is not memory. `stat -f` says tmpfs or
# it says something else, and the tool refuses on something else.
#
# WHAT THIS DOES NOT CLOSE, written down rather than left to be found: tmpfs pages can be swapped
# out, so on a host with swap and without encrypted swap a page of the dump could still reach a
# disk. That is a much smaller window than a file, and it is not nothing.
#
# `umask 077` goes first because nothing this tool writes may be readable by another user, and the
# log it keeps after a failure is created OUTSIDE the 0700 directory mktemp makes.
#
# ---------------------------------------------------------------------------------------------
# WHY EACH SIGNAL ENDS THE SCRIPT ITSELF.
#
# A trap on EXIT runs on every ordinary way out, `fail` and `set -e` included. A trap on a SIGNAL
# runs and then the shell CARRIES ON with the next line, so a handler that only cleans up would
# remove the work files and let the pour go on without them. Each one therefore ends the script,
# which runs the EXIT trap once, with the conventional status 128 plus the signal number.
#
# A shell runs a trap when the command it is waiting for has finished, so a TERM sent only to the
# shell while psql is running is acted on when psql returns. A Ctrl-C reaches psql as well and
# takes effect at once.
#
# WHAT NO TRAP CAN DO is catch SIGKILL. What survives it is the work directory, which is in memory
# and private, and the reference container, which has no network and holds nothing but what the
# migrations seed. The script prints where the work directory is, so that whoever killed it knows
# what to remove by hand.
#
# ---------------------------------------------------------------------------------------------
# WHAT REACHES THE TERMINAL WHEN A POUR FAILS.
#
# PostgreSQL puts the offending row in the message of a failed COPY: a CONTEXT line carries the
# whole line of data, and the DETAIL of a check or not-null violation carries the failing row. The
# terminal's history and every log that captures its output would keep a member's row for good. So
# the terminal gets the ERROR lines, which name the table and the constraint and are what an
# operator needs first, and the whole log is kept in memory for whoever has to read the rest.
#
# THE BOUNDARY: an ERROR line is the server's one-line statement and not a row, but a value that
# cannot be read as its column's type is quoted in it. Both databases have the type of every
# column checked against the migrations before any of this runs, so that cannot happen to rows
# that came out of QA, and the whole log is where it would be read if it did.
#
# AND THE FILTER GOES BY THE SHAPE OF A LINE, which is the same boundary from the other side: a
# value that itself holds a line beginning with ERROR: would pass it wherever PostgreSQL prints a
# value on lines of its own, as it does in the DETAIL of a check violation. That takes a member
# having typed such a line into a free text field AND the pour failing on that very row. It is
# written here and not closed, because closing it would mean parsing PostgreSQL's messages, and
# the whole log, kept in memory, is where it would be read.

umask 077

MEMORY=/dev/shm
[ -d "$MEMORY" ] && [ -w "$MEMORY" ] \
  || fail "there is no writable $MEMORY on this host. The dump of every table goes to memory and never to a disk, so this tool does not run without it."
memory_kind=$(stat -f -c %T "$MEMORY" 2>/dev/null) || memory_kind=unknown
[ "$memory_kind" = tmpfs ] \
  || fail "$MEMORY is '$memory_kind' and not tmpfs, so a file written there can reach a disk, and the dump of every table is written in plain text. This tool will not."

WORK=$(mktemp -d "$MEMORY/btl-pour.XXXXXX")

cleanup() {
  docker rm -f "$REFERENCE" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

# The lines of psql's complaint that may be shown: the server's ERROR line, which psql prefixes
# with the script it was reading and the line it had reached when that script comes from a file or
# from standard input. `-a` because the log can carry bytes that are not text.
show_errors() {
  shown=$(grep -aE '^(psql:[^ ]*:[0-9]+: )?ERROR:' "$1" | sed 's/^/  /' || true)
  if [ -n "$shown" ]; then
    printf '%s\n' "$shown"
  else
    say '  (there is no ERROR line in it)'
  fi
}

# $1 is the file psql wrote its complaint to and $2 says what it was doing. Shows the ERROR lines
# and keeps the whole of it, in memory, under a name it prints.
report_failure() {
  say "what $2 said, the ERROR lines only:"
  show_errors "$1"
  kept=$(mktemp "$MEMORY/btl-pour-failed.XXXXXX")
  cat "$1" > "$kept"
  say "The whole of it is in $kept, in memory, because the lines left out can carry member rows."
  say 'Read it there, and delete it when you have.'
}
