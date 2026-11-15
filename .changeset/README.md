# Changesets

Every PR that changes what the `fragiola` package ships (`changedFilePatterns` in `config.json`)
adds a changeset here: `pnpm changeset`, pick the bump and write the summary for the changelog.
The release workflow turns them into the Version Packages PR. See [`docs/releasing.md`](../docs/releasing.md).
