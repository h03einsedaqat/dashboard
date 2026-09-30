# Migration and upgrades

This section is for when you receive a new version of the template and want to upgrade without losing your own changes.

## Before you start

1. Create a branch in your project: `git checkout -b upgrade/novaadmin-1.1`
2. Write down your own changes (which files have you touched?).
3. Run `npm run qa:all` on the current state to make sure the starting point is healthy.

## Files that are rewritten in a new version

| Path | Status | Recommendation |
| --- | --- | --- |
| `src/pages/**` | Generated | Never edit |
| `src/locales/generated.js` | Generated | Never edit |
| `src/data/navigation.js` | Generated | Never edit |
| `src/partials/docs/*.html` | Generated from `docs/` | Edit `docs/*.md` (and `docs/en`, `docs/ar`) instead |
| `public/robots.txt`, `public/sitemap.xml` | Generated | Configure in `src/config/config.js` |
| `tools/**` | Tooling | Compare your changes with a diff |
| `src/scss/**`, `src/js/**` | Source | Keep your changes and merge them with the new version |

## Upgrade procedure (step by step)

```bash
# 1. extract the new version into a separate folder
unzip NOVAADMIN-1.1.0.zip -d /tmp/nova-1.1

# 2. update tools, styles and scripts
rsync -av --exclude=node_modules /tmp/nova-1.1/tools/ ./tools/
rsync -av /tmp/nova-1.1/src/scss/ ./src/scss/
rsync -av /tmp/nova-1.1/src/js/core/ ./src/js/core/

# 3. refresh dependencies
npm install

# 4. rebuild pages and assets
npm run gen:all && npm run build

# 5. quality control
npm run qa:all
```

## Comparing your own changes

If you keep the project in git, the simplest approach is to keep your changes in a few limited paths:

```text
src/partials/pages/**      custom page bodies
src/js/pages/**            custom controllers
src/data/**                your real data
src/config/config.js       brand and defaults
src/scss/base/_palettes.scss   brand palette
```

Record any change outside this list in your project's own `UPGRADE-NOTES.md` so you remember it when upgrading.

## How do I spot breaking changes?

| Symptom | Meaning | Action |
| --- | --- | --- |
| Import error in the console | A file name or path changed | Check the difference with `git log` and fix the path |
| Unstyled class | A class was removed or renamed | `npm run qa:links` gives you the list |
| A `{{...}}` token in the output | A new token was added | Update the token map in `tools/nova-plugin.mjs` |
| Doubled animation or behaviour | Two copies of one module were loaded | Remove the duplicate import |

## Rolling back

```bash
git checkout -- .
# or
git reset --hard upgrade/novaadmin-1.0      # if you created the branch before upgrading
```

> Tip: before every upgrade, run `npm run build` once and keep the `dist/` output; if something goes wrong, you can put that output on the host while you investigate.

> Warning: do not commit generated files to git (except when building the final package), otherwise you will face large conflicts on every upgrade.
