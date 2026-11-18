# Contributing

## Development

```sh
npm ci
npm run build      # writes themes/*.json from build.mjs
npm run check      # oxlint, oxfmt --check and a test package (vsce validates the manifest)
```

All colors live in [build.mjs](build.mjs). The six numbers at the top (primary and accent as OKLCH) drive everything else; change them and rebuild to retint all three themes.

To try your changes, link the folder into VS Code's extensions and reload the window after each build:

```sh
ln -s "$PWD" ~/.vscode/extensions/weblogixx.sunny-theme-dev
```

The link uses the same extension ID as the published theme. If you have Sunny installed from the Marketplace, uninstall it first, or VS Code loads only one of the two.

`npm run package` builds a `.vsix` you can install with **Extensions: Install from VSIX…**.

## Releasing

Pushing a version tag creates a GitHub release with the `.vsix` attached (see [.github/workflows/release.yml](.github/workflows/release.yml)):

```sh
npm version patch
git push --follow-tags
```

Publishing to the stores is optional. Each store is switched on with a repository variable (Settings → Secrets and variables → Actions → Variables) once its one-time setup is done:

1. **VS Code Marketplace:** create the publisher `weblogixx` at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage). In the publisher's **Trusted Publishing** section, add a policy for the owner `weblogixx`, the repository `sunny-theme` and the workflow file `release.yml`. The workflow then publishes with an OIDC token, no secret needed (global Azure DevOps PATs are being retired). If the first automated publish is refused, upload the `.vsix` from the GitHub release once by hand on the manage page. Then set the variable `PUBLISH_MARKETPLACE` to `true`.
2. **Open VSX** (for VSCodium, Cursor and others): sign in at [open-vsx.org](https://open-vsx.org) with GitHub, sign the publisher agreement, create an access token and run `npx ovsx create-namespace weblogixx -p <token>` once. Store the token as the secret `OVSX_PAT` and set the variable `PUBLISH_OPENVSX` to `true`.
