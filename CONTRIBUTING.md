# Contributing

- If you just want to fix a typo or do some other small change, please open a new issue instead and show the problem. It usually takes more effort to accept such contributions than to do them myself.

- If you are an experienced developer and want to improve this project, follow the guide.

## How to contribute

⚠️ Before you write any code, please create a new issue or a discussion and describe the feature / fix / changes you want to implement so we can discuss it first. If we decide it makes sense to add these changes, do them and send PR for review.

### Prerequisites

- Install Node.js version specified in the package.json > `engines.node`

- Install Rust and other required libs for your platform: https://v2.tauri.app/start/prerequisites

### Steps

1. Switch to required `Node` version.

2. Fork the project and clone it.

3. Change working directory and go to the `main` branch

```
cd sigma-file-manager && git checkout main
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

### Send your changes

1. Make sure you are on the `main` branch and pull the latest changes from git. Resolve conflicts if there are any.
```
git pull && npm i
```
2. Create a new branch for your feature / fix with a short meaningful name (without spaces), for example:
```
git checkout -b add-new-navigator-layout
```
3. Add all your changes to "staged":
```
git add .
```
4. Create a commit with your changes with a short descriptive message:
```
git commit -m "fixed problem X"
```
5. Push the commit to Github:
```
git push
```
6. Create a new pull request on Github. See their [docs](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request) if needed.

## Notes:

- Formatter: Use Eslint formatter to format the code. Disable prettier if it's enabled in your IDE.

- Try to stick to the project code style.

- If you are fixing a known problem (specific issue), reference the issue # that the PR resolves at the top of the body of the PR, for example: "Fixes #1234" or "Resolves #6458" (see [closing issues using keywords](https://help.github.com/en/github/managing-your-work-on-github/linking-a-pull-request-to-an-issue))

## Known issues with the app

### Linux

When running on proprietary Nvidia (or unsupported) drivers, you may encounter different visual issues.

To run the AppImage build on a Linux system with unsupported drivers, run the app with the compositing flag, for example:

```
env WEBKIT_DISABLE_COMPOSITING_MODE=1 ./sigma-file-manager-v2_2.0.0-alpha.1_amd64.AppImage
```