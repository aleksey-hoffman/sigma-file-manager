# Contributing

The app is in early development (prototyping) stage, the codebase hasn't been optimized yet. I'm gradually refactoring it, changing and breaking some things, so you might encounter a lot of code conflicts.

## How to contribute

If you want to implement some changes into this project, you can do so in one of the following 2 ways.

After a review, I will merge the changes into the project, if the changes are beneficial.

#### ⚠ Before contributing

Create a new issue or a discussion and describe the feature / fix / changes you want to implement so we can discuss it first.

### Method 1

Go to the [main project page](https://github.com/aleksey-hoffman/sigma-file-manager), press `.` (dot) button on your keyboard. Github will open an online code editor and allow you to modify any file and commit the changes.

#### Steps

1. Implement your changes into the code.
2. Commit the code changes with a short descriptive message, for example: "improved navigator list layout"

### Method 2

If you are new to contributing code, try the `method 1` instead or, if you want to learn and try this more advanced method, watch several video tutorials about "Git" and look up a few "beginner guides to contributing to a GitHub project", then practice working with branches and committing / pushing changes to your own test repository, make sure you understand what you are doing. Then you can download the project, implement the changes locally and then push them to this project:

#### Steps

First, install the Node.js version specified in the notes below, setup your git locally (for this project) or globally and set your `user.email` and `user.name`, then:

1. Download the project to your local computer:

```
git clone https://github.com/aleksey-hoffman/sigma-file-manager.git
```

2. Install the dependencies and start dev server:

```
cd ./sigma-file-manager && npm install && npm run dev
```

To build the project for your current platform, run this command:

```
npm run build
```

The build can be configured in the `./vue.config.js` file

3. Create a new branch for your feature / fix with a meaningful name:
```
git checkout -b my-new-feature-name
```
4. Implement your changes on the branch.
5. Check the Github page of your fork and if it says "This branch is X commits behind PROJECT_NAME:main", then pull the changes from the main repository to your forked repository (look up a guide online, like this one: [update-github-repositories-with-changes-by-others](https://www.earthdatascience.org/courses/intro-to-earth-data-science/git-github/github-collaboration/update-github-repositories-with-changes-by-others)).
6. Make sure there's no conflicts between your changes and the pulled changes. Then commit your changes with a short descriptive message:
```
git commit -m "fixed problem X"
```
7. Push the commits to your forked repository on Github:
```
git push origin my-new-feature-name
```
8. Create a new pull request from your fork to this project.

## Notes:

These notes are mostly relevant when you are contributing via `method 2` described above.

- Node.js version: <= `v15.14.0` (you can use nvm to install and manage multiple Node versions).

- Build tools: Windows: `Visual Studio build tools`; Linux: `sudo apt-get install build-essential`.

- Formatter: Use Eslint formatter plugin to format the code. Disable prettier if it's enabled in your IDE.

- Try to stick to the project code style. 

- Bug fixes should be submitted (pull request) to the main branch.

- New features and breaking changes should be submitted (pull request) to the dev branch.

- Use a descriptive title for the pull request no more than 64 characters long. This will be used as the commit message when your PR is merged, for example: "improved navigator list layout"

- If you are fixing a known problem (specific issue), reference the issue # that the PR resolves at the top of the body of the PR, for example: "Fixes #1234" or "Resolves #6458" (see [closing issues using keywords](https://help.github.com/en/github/managing-your-work-on-github/linking-a-pull-request-to-an-issue))
