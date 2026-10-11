# Intent audit harness

Run from `client` with Node 22.18+:

```sh
node --experimental-strip-types scripts/intent-audit/run.mjs keyword baseline
node --experimental-strip-types scripts/intent-audit/run.mjs holdout improved
node --experimental-strip-types scripts/intent-audit/contracts.mjs
```

Opt-in network/provider calls using configured credentials:

```sh
node --experimental-strip-types --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/intent-audit/run.mjs live baseline
node --experimental-strip-types --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/intent-audit/run.mjs paced improved
```

`live` issues up to 64 synthetic requests with concurrency two; it intentionally stresses the provider and can hit rate limits. `paced` runs 16 component requests sequentially with 18 seconds between requests. Pacing cannot guarantee success if the account is shared, limits change, or networking fails. No Google/calendar writes or production record changes occur. Live evaluation uses the actual server endpoint logic through synthetic request/response streams, rather than a running browser HTTP transport.

The corpus contains 1,265 unique English/Hindi/Hinglish goals plus 65 held-out prompts. Most main cases are authored templates/combinations; they are not 1,265 unrelated user conversations. Expectations are authored independently of router outputs. Results apply plans to synthetic canonical workspace documents, test preservation/targeting, registered selections, workflows and selected bindings. Safety checks flag unauthorized removal; they do not claim full semantic compliance with every clause.

Outputs go to repository `audit/`: cases/expectations, raw safe endpoint results, per-case pass/fail, CSV failure lists and aggregate summaries. A changing source hash signals that rerunning the same case set on another version may give different results. The source hash covers the two intent-domain files, not the entire application or provider version.
