# Markdown/indexing golden corpus

`notes/` and `daily/` contain small Markdown files covering frontmatter,
titles, Unicode, broken YAML and line-ending edge cases. `scalars.json` holds
inputs for key folding and FTS query construction.

`packages/core/src/indexing/parity.test.ts` derives `expected.json` from the
real core pipeline and fails when behavior drifts. Regenerate intentionally:

  UPDATE_PARITY=1 pnpm --filter @reflect/core test --run parity

`.gitattributes` disables line-ending conversion because `crlf.md` deliberately
pins CRLF normalization behavior.
