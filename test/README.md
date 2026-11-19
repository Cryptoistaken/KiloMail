# Detector workbench

Real mail, not fixtures. The corpus is pulled from production Redis and kept out of git.

```bash
node test/pull-mail.mjs       # SCAN inbox:* -> HGETALL -> GET body:<id>  -> test/data/
bun  test/check-detectors.ts  # what the detectors return, and what they miss
bun  test/verify.ts           # every code/link checked against the mail it came from
```

`check-detectors.ts` counts what is found. `verify.ts` is the one that matters: a code has to
appear in the body, must not be a slice of a longer number, a URL, or the sender's own address;
a link must not be an unsubscribe / privacy / social / image / tracking URL, and its path has to
say something about verification. Anything that fails is printed with the sender and subject.

Useful flags:

```bash
bun test/check-detectors.ts --miss   # mails that ask for a code and get nothing
bun test/check-detectors.ts --odd    # codes that look like prose
```

`test/data/extracted.json` is the last run's output (id, inbox, code, link) — diff it after a change.

Current baseline on 10,132 messages in 6,514 inboxes:

| | |
| --- | --- |
| code found | 7,804 |
| link found | 149 |
| bad codes | 0 |
| bad links | 7 (all real verification links, flagged only because the sender is a bounce address) |

Credentials are read from `.dev.vars` / `.env.local` and never printed. `test/data/` is
gitignored — it is other people's mail.
