# Notes

The app is in early development (prototyping) stage:
- The codebase hasn't been optimized yet. A large portion of the codebase has been written when I barely knew how to code.
- The whole codebase will be refactored and optimized in future updates.

# How to contribute

If you want to implement some changes into this project yourself, but you don't know how to do it yet, watch several video tutorials (at least 10) and look up a few "beginner guides to contributing to a GitHub project", then practice working with branches and commiting / pushing changes to your own test repository, make sure you understand what you are doing. When you've done this, you can try to contribute to this project.

## Steps:

1. Create a new issue or a discussion and describe the feature / fix / changes you want to implement.
2. When you are ready to modify the code, fork the project's repository.
3. Create a new branch for your feature / fix with a meaningful name:
```
git checkout -b my-new-feature-name
```
4. Implement your changes into the code.
5. Check the Github page of your fork and if it says "This branch is X commits behind PROJECT_NAME:main", then pull the changes from the main repository to your forked repository (look up a guide online, like this one: [update-github-repositories-with-changes-by-others](https://www.earthdatascience.org/courses/intro-to-earth-data-science/git-github/github-collaboration/update-github-repositories-with-changes-by-others)).
6. Make sure there's no conflicts between your changes and the pulled changes. Then commit your changes with a short descriptive message:
```
git commit -am "fixed X problem"
```
7. Push the commits to your forked repository on Github:
```
git push origin my-new-feature-name
```
8. Create a new pull request

## Notes:

- Bug fixes should be submitted (pull request) to the main branch.

- New features and breaking changes should be submitted (pull request) to the dev branch.

- Use a descriptive title for the pull request no more than 64 characters long. This will be used as the commit message when your PR is merged, for example: "improved navigator list layout"

- If you are fixing a known problem (specific issue), reference the issue # that the PR resolves at the top of the body of the PR, for example: "Fixes #1234" or "Resolves #6458" (see [closing issues using keywords](https://help.github.com/en/github/managing-your-work-on-github/linking-a-pull-request-to-an-issue))
