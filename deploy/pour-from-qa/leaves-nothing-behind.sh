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
# WHY A COMMAND THAT CAN RUN LONG IS RUN IN THE BACKGROUND AND WAITED FOR. A shell runs a trap only
# after the command it is waiting for has ended, so a TERM sent to the shell while a `psql` is
# running used to be acted on when that psql returned: for the pour, a read of QA or a transaction
# that can last minutes, and for a command that hangs, never. Measured 21.10.2026 in dash, with a
# foreground child that took eight seconds and a signal sent one second in: the way out ran at the
# eighth second, for TERM and for INT alike (a Ctrl-C reaches the child as well, but a stop does
# not, and neither does a `kill` of the script). `wait` is the built-in that a trapped signal
# interrupts at once, so `step` runs the command in the background and waits for it. It is the same
# arrangement as `step` in deploy/backup/in-memory.sh, where the reasons for each line of it are
# written out; the one difference is that the pour has no mail to send.
#
# WHAT THE WAY OUT DOES ABOUT THE STEP: sends TERM to its docker client and removes every container
# of this run by its label, which needs nothing from the client (`container`, below, labels the
# ones this script starts with `docker run`). What it cannot do is reach the process a killed
# `docker exec` client leaves running inside the container. For the pour that is the one psql that
# is writing production, and it is safe by what the pour is: that psql reads the whole of the
# pour from the client's standard input, which closes with the client, and one transaction that
# lacks its commit is rolled back when the connection ends. A signal that arrives after the last
# byte was sent and while the commit is being executed can still commit, and then production holds
# all of the pour: that is the only other state there is, and `--check` tells the two apart, since
# it refuses a database that holds rows its migrations did not leave.
#
# WHAT STAYS BARE, and is named rather than left to be found: the calls that ask the docker daemon
# one short question (`ps`, `inspect`, `printenv`) and the ones that start or remove a container
# and return at once. A daemon that hangs would hang them, and then a signal waits, as it would for
# anything else that does not answer; the same boundary deploy/backup/stack.sh states.
#
# WHY A SECOND SIGNAL DURING THE WAY OUT IS IGNORED. A trap on a signal runs `exit`, which runs the
# EXIT trap, and a signal that arrives while that trap runs ran `exit` again from inside it, so the
# cleanup stopped where it was: after the reference container's removal had begun and before the
# work directory's. Measured 21.10.2026 by sending a second signal while `docker rm` of the
# way out was running: the work directory, with every table of the database in plain text, was
# still there. The way out is the one place a signal must not end the script, so it is the first
# thing the cleanup does to ignore them. It is the cleanup's and not the signal handler's, because
# the cleanup also runs after `fail` and after a plain exit, and a signal during a way out that no
# signal began is the same fault.
#
# WHAT THE TERMINAL IS TOLD when a signal ends the pour: one line, naming the signal and what is
# true afterwards (the work directory is being removed, and which two states production can be in).
# The status is 128 plus the signal number, as before.
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

# The label every container of this run carries, so that the way out can find and remove them
# whatever state the docker client that started them is in (container, below).
STEP_LABEL="btl-pour-run=$$"
# The docker client of the step in flight, empty between steps (step, below).
STEP=

cleanup() {
  # The way out cannot be ended by a signal: see "WHY A SECOND SIGNAL DURING THE WAY OUT IS IGNORED".
  trap '' HUP INT TERM
  stop_the_step
  docker rm -f "$REFERENCE" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}

# What a signal does: says what happened, and ends the script with 128 plus the signal's number,
# which runs the EXIT trap once, and the EXIT trap is what ignores the others. $1 is the name and $2
# the status.
stopped_by() {
  printf 'STOPPED: the pour was ended by %s. The work files in memory are being removed. If this came during\n'\
'step 9, production holds either all of the pour or none of it, and `sh pour-from-qa.sh --check` says\n'\
'which: it refuses a database that holds rows its migrations did not leave.\n' "$1" >&2
  exit "$2"
}

trap cleanup EXIT
trap 'stopped_by HUP 129' HUP
trap 'stopped_by INT 130' INT
trap 'stopped_by TERM 143' TERM

# One command, in the foreground as far as its caller can tell: waits for it, returns its status,
# takes its standard input from where the caller's comes from, and gives the shell back to a trapped
# signal at once. The input goes through descriptor 4 because dash replaces the standard input of a
# command started with & by /dev/null BEFORE it looks at that command's own redirections (measured
# 21.10.2026), and the pour feeds whole files to psql through this.
step() {
  { "$@" <&4 & } 4<&0
  STEP=$!
  step_status=0
  wait "$STEP" || step_status=$?
  STEP=
  return "$step_status"
}

# A container of this run, in the foreground. --rm so that none is left by a run that ends
# normally; --init and the label so that the way out can stop it whatever its client is doing.
container() {
  step docker run --rm --init --label "$STEP_LABEL" "$@"
}

# What the way out does about a step that was still running: stops its docker client, and removes
# every container that carries this run's label.
stop_the_step() {
  if [ -n "$STEP" ]; then
    kill -TERM "$STEP" 2>/dev/null || true
  fi
  leftovers=$(docker ps -q --filter "label=$STEP_LABEL" 2>/dev/null) || leftovers=''
  for one in $leftovers; do
    docker rm -f "$one" >/dev/null 2>&1 || true
  done
}

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
