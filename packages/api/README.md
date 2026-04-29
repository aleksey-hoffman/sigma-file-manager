# @sigma-file-manager/api

Type definitions and the extension manifest JSON schema for [Sigma File Manager](https://github.com/aleksey-hoffman/sigma-file-manager) extensions.

## Install

```bash
npm install -D @sigma-file-manager/api
```

Add a `devDependency` only; the host does not run `npm install` for installed extensions.

## TypeScript

Import types for entrypoints and helpers. The global `sigma` object is declared in this package.

```ts
import type { ExtensionActivationContext, ExtensionContextEntry, UIElement } from '@sigma-file-manager/api';

export async function activate(context: ExtensionActivationContext): Promise<void> {
  await sigma.i18n.mergeFromPath('locales');
}

export async function deactivate(): Promise<void> {}
```

When the extension runs code, point `package.json` `"main"` at your compiled file (for example `dist/index.js`), set `"type": "module"`, and build with `tsc` or your bundler. Manifest-only API extensions that only contribute themes can omit `"main"`. Commit build output if installs come from a Git tag archive without running a build on the client.

## i18n

Keep strings in `locales/*.json`, merge every locale from the extension root, and alias `sigma.i18n.extensionT` for extension-local keys:

```ts
const t = sigma.i18n.extensionT;
```

Call `await sigma.i18n.mergeFromPath('locales')` in `activate` before registering UI that uses `t`.

`sigma.i18n.formatMessage` is available when you need `{placeholder}` formatting outside the translator.

## Manifest schema

In extension `package.json`:

```json
{
  "$schema": "./node_modules/@sigma-file-manager/api/manifest.schema.json"
}
```

Run `npm install` first so the local schema file exists.

## Release

API package versions are independent from app releases and are published to npm as `@sigma-file-manager/api`.

## Resources

**[Docs](https://github.com/sigma-hub/sfm-marketplace/wiki)** - documentation for extension development
