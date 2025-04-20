# Contributing

First of all, thanks for your interest in helping out! 😃

# Submitting an Issue

Before you submit an issue, please search the issue tracker, maybe an issue for your problem already exists and the discussion might inform you of workarounds readily available.

We want to fix all the issues as soon as possible and a minimal reproduction scenario allows us to quickly confirm a bug (or point out a coding problem) as well as confirm that we are fixing the right problem.

# Submitting a Pull Request

## Prerequisites

-   [git](https://git-scm.com/)
-   [node](https://nodejs.org/en/)
-   [vscode](https://code.visualstudio.com/)

### Note

This project uses `eslint` and `prettier` to lint and format code. I would recommend that you use `vscode` for this project because the repo already contains the extension settings for autofixing linting errors and formatting code on save. So, make sure to **download the recommended workspace extensions** in vscode after cloning the repo.

## Steps

1. Fork the repo
2. Clone your fork
3. Download the recommended workspace extensions in vscode
4. Create a new branch (`git checkout -b my-fix-branch master`)
5. Install packages via `npm i`
6. Make changes
7. Build the library `npm run build`
8. Run tests `npm run test`
9. Commit your changes using a descriptive commit message
10. Push your branch to GitHub `git push origin my-fix-branch`
11. Start a pull request from GitHub

That's it! 🎉 Thank you for your contribution! 😃

## Working on your first Pull Request?

Check out this [tutorial](https://github.com/firstcontributions/first-contributions/blob/master/github-windows-vs-code-tutorial.md)

Also, [How to Contribute to an Open Source Project on GitHub](https://egghead.io/series/how-to-contribute-to-an-open-source-project-on-github) for a more in depth (video) tutorial
