# Releasing

Releasing is a merge. [Changesets](https://changesets.dev) versions the `fragiola` package and
writes its changelog. The release workflow, [`.github/workflows/release.yml`](../.github/workflows/release.yml),
publishes it with pnpm through npm **trusted publishing** (OIDC, with provenance): there is no npm
token anywhere. It is fragiola/dockable's pipeline, for a single package.

On every push to `main` the workflow does one of three things:

- **changesets are pending:** it opens or updates the **Version Packages** PR, which bumps the
  version, writes `CHANGELOG.md` and deletes the changesets;
- **no changeset, and `main`'s version is not on npm** (the Version Packages PR was just merged):
  it builds the package, packs it with pnpm, checks that tarball
  (`scripts/check-package.ts --tarballs`), publishes it from the `npm` environment, then pushes
  the git tag (`fragiola@0.1.0`) and creates the GitHub release;
- otherwise nothing.

## The first release (0.1.0)

npm can only trust a publisher for a package that already exists, so the first publish is a manual
`0.0.0` stub. Do these steps in order, once. Steps 1 to 4 come **before** merging the PR that adds
this runbook (the release PR): its merge starts the release.

1. **Let the workflow open PRs.** In the repository's _Settings → Actions → General → Workflow
   permissions_, enable **Allow GitHub Actions to create and approve pull requests**. In an
   organization this checkbox is greyed out until the organization allows it (_Settings →
   Actions → General → Workflow permissions_ of the `fragiola` organization, already enabled for
   Dockable). Without it, the workflow cannot open the Version Packages PR.

2. **The `npm` environment.** In the repository's _Settings → Environments_, create an environment
   named exactly `npm`. Under _Deployment branches and tags_, choose _Selected branches and tags_
   and add the rule `main`. The publish job runs in this environment, and npm will trust only a
   run of `release.yml` in it, so a run from any other branch cannot publish.

3. **The stub.** From a clean checkout of `main` (without the release PR yet), with the package at
   `0.0.0` and your npm account's 2FA enabled:

   ```sh
   git switch main && git pull && git status   # clean, up to date
   pnpm install --frozen-lockfile
   pnpm check:package                           # builds, packs and smoke-tests it
   pnpm publish --access public --dry-run       # what would be published
   pnpm publish --access public
   ```

   pnpm asks for your 2FA code. Always publish with pnpm, never `npm publish`. The stub is the
   real CLI at `0.0.0`: `npx fragiola@latest mcp` already works with it.

4. **The trusted publisher.** With npm 11.15 or later (`npm --version`; `npm install -g
   npm@latest` updates it) and your account's 2FA:

   ```sh
   npm trust github fragiola --file release.yml --repo fragiola/cli --environment npm --allow-publish
   npm trust list fragiola
   ```

   `--allow-publish` is required: a trusted publisher otherwise only gets staged publishing, which
   Changesets does not do. The repository, the filename and the environment are all part of the
   trust: never rename `release.yml` or its `npm` environment.

5. **Merge the release PR.** Its push to `main` runs the release workflow, which opens the
   **Version Packages** PR (`changeset-release/main`): `fragiola` at `0.1.0`, with its changelog.

6. **Merge the Version Packages PR.** A PR opened with the workflow's token starts no other
   workflow, so CI does not run on it by itself: close and reopen the PR (or run _CI_ on its
   branch from the Actions tab) to get the checks, then merge it. The release workflow publishes
   `0.1.0` with provenance. Merge nothing else until that run is over (see _While a release
   runs_). Then check the package on npm (`0.1.0` is `latest`, with provenance), the tag and the
   GitHub release.

7. **Lock it down.** On npm, _fragiola → Settings → Publishing access_: **Require two-factor
   authentication and disallow tokens**. From now on only the workflow publishes.

8. **Announce it.** Merge fragiola/www's MCP page (fragiola/www#27): it tells readers to run
   `npx fragiola@latest mcp`.

## Later releases

- **Every PR that changes what the package ships** adds a changeset: `pnpm changeset`, pick the
  bump and write the summary for the changelog (what changed and, for a break, how to update).
  Commit the `.changeset/*.md` file with the PR. "What the package ships" is `changedFilePatterns`
  in `.changeset/config.json`: `src/`, `package.json`, `README.md`, `LICENSE` and the build
  configs. A PR that touches only tests, docs, scripts or CI needs none. CI's _Changesets_ job
  fails a PR that should have one (the Version Packages PR is skipped).
- **The bump.** While the CLI is `0.x`, a breaking change (a removed command, tool or option, a
  changed output contract) is a `minor`, anything else a `patch`.
- **Releasing.** Merging such PRs keeps the Version Packages PR up to date. Merge it when you want
  to release (re-trigger its CI first, as in step 6). Never bump the version or edit the
  changelog by hand. `pnpm changeset status --verbose` shows what the next release contains.
- **A change to the agent index contract** (`docs/agent-index.md`) is released here before
  fragiola/www emits the new version, so the published CLI can read it.

## While a release runs

From the merge of the Version Packages PR until its _Release_ run has finished, merge nothing
else. Each push to `main` starts its own run, and each run decides on its own: a PR merged in the
meantime with no changeset would also be in publish mode, and could publish the same version from
a different commit. The publish of one commit is never cancelled by a later push.

## When a publish fails

After a failed publish, `main` holds the bumped version and no changeset, and npm lacks that
version. The release workflow publishes it on the next run **that finds no changeset on `main`**:

- **The cause was outside the repository** (npm down, the trusted publisher or the `npm`
  environment misconfigured): fix that, then open the failed _Release_ run and choose _Re-run all
  jobs_ (possible for 30 days).
- **The cause is in the repository** (the build or the tarball check fails): fix it in a PR that
  **adds no changeset**. Its merge leaves `main` with no changeset, so that run publishes the
  bumped version, fix included. CI's _Changesets_ job fails on that PR; that is expected here, and
  the check is not required: merge it anyway. Do not add an empty changeset to quiet it.
- **Until the stuck version is out, merge no PR that adds a changeset.** It would turn the next
  run into a version run, which bumps past the stuck version, and that version would never be
  published.
- **Published, but the tag or the release is missing** (the run failed after npm): create them by
  hand: the tag `fragiola@<version>` on the commit the publish ran from, and a GitHub release
  from it with the changelog's section.
- **`ENEEDAUTH`, `E404` or `E403` on publish:** the trusted publisher does not match the run.
  Check `npm trust list fragiola`: the repository `fragiola/cli`, the file `release.yml`, the
  environment `npm`, publishing allowed. `repository.url` in `package.json` must point to this
  repository.
- **A broken version went out:** npm versions cannot be reused. Deprecate it
  (`npm deprecate fragiola@<version> "<why>"`) and release a fix with a new changeset.
