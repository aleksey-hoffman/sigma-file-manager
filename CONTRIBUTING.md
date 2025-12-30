# Contributing

If you'd like to contribute your skills to improve this project, follow this guide.

## How to contribute

⚠️ Before you write any code, please create a new issue or a discussion and describe the feature / fix / changes you want to implement so we can discuss it first.

Then, follow one of the following 2 methods, to add the changes.

After you send your changes, I will review and merge it into the project, if they are beneficial.

## Method 1

`For new developers`

If you are new to contributing code and development, and you want to do a small change, try this method. 

### Steps

1. Go to the [main project page (v2 branch)](https://github.com/aleksey-hoffman/sigma-file-manager/tree/v2), press `.` (dot) button on your keyboard. Github will open an online code editor and allow you to modify any file and commit the changes for review.
2. Implement your changes into the code.
3. Commit the code changes with a short descriptive message, for example: "improved navigator list layout"

## Method 2

`For experienced developers`

### Prerequisites

- Install Node.js version >= `20.10.0` (you can use tools like volta or nvm to install and manage multiple Node versions on your computer).

- Install Rust and other required libs for your platform: https://v2.tauri.app/start/prerequisites

### Steps

1. Switch to `Node v20` or newer.
2. Clone the project
```
git clone https://github.com/aleksey-hoffman/sigma-file-manager.git
```
3. Change working directory
```
cd sigma-file-manager
```
3. Change branch to v2
```
git checkout v2
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

⚠️ These are publicly visible and will be used in your changes.

6. Run the app in dev mode

```
npm run tauri:dev
```

Or the following, on Linux, if you see any visual issues

```
npm run tauri:dev:webkit-igpu
```

### Create build

This is optional. Run this command if you want to create the production build with yor changes and install the app.

```
npm run tauri:build
```

The build can be configured in the `./vite.config.js` file.

### ⚡ Pull changes

The code base is updated frequently, so make sure you pull the latest changes from Github, install dependencies if they were updated, merge conflicts with your feature, before sending your changes or running / building the app:

```
git checkout v2 && git pull && npm i
```

### Send your changes

1. Pull the latest changes from git
```
git checkout v2 && git pull && npm i
```
2. Make sure you are on the v2 branch. Create a new branch for your feature / fix with a short meaningful name (without spaces), for example:
```
git checkout -b add-new-navigator-layout
```
3. Make sure there's no conflicts between your changes and the pulled changes. 

4. Add all your changes to "staged":
```
git add .
```
5. Create a commit with your changes with a short descriptive message:
```
git commit -m "fixed problem X"
```
6. Push the commit to Github:
```
git push
```
7. Create a new pull request on Github.

## Notes:

These notes are mostly relevant when you are contributing via `method 2` described above.

- Formatter: Use Eslint formatter plugin to format the code. Disable prettier if it's enabled in your IDE.

- Try to stick to the project code style. 

- If you are fixing a known problem (specific issue), reference the issue # that the PR resolves at the top of the body of the PR, for example: "Fixes #1234" or "Resolves #6458" (see [closing issues using keywords](https://help.github.com/en/github/managing-your-work-on-github/linking-a-pull-request-to-an-issue))

## Known issues with the app

### Linux

When running on proprietary Nvidia (or unsupported) drivers, you may encounter different visual issues.

To run the AppImage build on a Linux system with unsupported drivers, run the app with the compositing flag, for example:

```
env WEBKIT_DISABLE_COMPOSITING_MODE=1 ./sigma-file-manager-v2_2.0.0-alpha.1_amd64.AppImage
```