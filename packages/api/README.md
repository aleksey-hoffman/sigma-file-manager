# @sigma-file-manager/api

Types and manifest schema for Sigma File Manager extensions.

## Install

```bash
npm install -D @sigma-file-manager/api
```

## Use in JavaScript extensions

Use `// @ts-check` and JSDoc imports from the package:

```js
// @ts-check

/**
 * @typedef {import('@sigma-file-manager/api').ExtensionActivationContext} ExtensionActivationContext
 */

/**
 * @param {ExtensionActivationContext} context
 */
async function activate(context) {
  console.log(context.extensionPath);
}
```

## Manifest schema

Use this schema URL in your extension `package.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/aleksey-hoffman/sigma-file-manager/main/packages/api/manifest.schema.json"
}
```

## Release

API package versions are independent from app versions and tagged as `api-vX.Y.Z`.