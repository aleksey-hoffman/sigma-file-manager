# Contributing

⚠️ Before you write any code, keep in mind PRs are now only available to contibutors. If you want to become a contributor, create a new issue or a discussion and propose your changes so we can discuss it first. If we decide to proceed with these changes, then you might get the contributor role and create a PR.

## How to contribute

If you already have the contributor role, or you just want to run the app in dev mode, see the guide below

### Prerequisites

- Install Node.js version specified in the package.json > `engines.node`

- Install Rust and other required libs for your platform: https://v2.tauri.app/start/prerequisites

### Steps

1. Switch to required `Node` version.

2. Fork the project and clone it.

3. Change working directory and go to the `main` branch

```
cd sigma-file-manager
```

4. Install dependencies:

```
npm i
```

5. Don't forget to setup your git config locally (for this project) if you are not using the global config:

```
git config user.name "Your Name Here"
git config user.email your@email.example
```

6. Run the app in dev mode

```
npm run tauri:dev
```

On Linux, if you see any visual issues, try this

```
npm run tauri:dev:webkit-igpu
```

7. Implement your changes

8. Pull changes. The code base is updated frequently, so make sure you pull the latest changes from Github, install dependencies if they were updated, merge conflicts with your feature, before sending your changes or running / building the app:

```
git pull && npm i
```

9. Run this script to make sure there's no issues with code

```
npm run check
```

9. Build the app to make sure there's no issues with building

```
npm run tauri:build
```

The build can be configured in the `./vite.config.js` file.

## Known issues with the app

### Linux

When running on proprietary Nvidia (or unsupported) drivers, you may encounter different visual issues.

To run the AppImage build on a Linux system with unsupported drivers, run the app with the compositing flag, for example:

```
env WEBKIT_DISABLE_COMPOSITING_MODE=1 ./sigma-file-manager-v2_2.0.0-alpha.1_amd64.AppImage
```