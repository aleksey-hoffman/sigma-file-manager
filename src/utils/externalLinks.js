// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const githubMainBranch = 'main'
const githubUser = 'aleksey-hoffman'
const githubRepo = `${githubUser}/sigma-file-manager`
const githubUserLink = `https://github.com/${githubUser}`
const githubRepoLink = `https://github.com/${githubRepo}`
const githubRepoApiLink = `https://api.github.com/repos/${githubRepo}`
const githubLicenseLink = `https://github.com/${githubRepo}/blob/${githubMainBranch}/LICENSE.md`
const githubChangelogLink = `https://github.com/${githubRepo}/blob/${githubMainBranch}/CHANGELOG.md`
const githubIssuesLink = `https://github.com/${githubRepo}/issues/`
const githubDiscussionsLink = `https://github.com/${githubRepo}/discussions/`
const githubIssueTemplateProblemReport = `https://github.com/${githubRepo}/issues/new?template=Problem_report.md`
const githubIssueTemplateFeatureRequest = `https://github.com/${githubRepo}/issues/new?template=Feature_request.md`
const githubAllReleases = `https://github.com/${githubRepo}/releases`
const githubLatestRelease = `https://github.com/${githubRepo}/releases/latest`
const githubReadmeSupportSectionLink = `https://github.com/${githubRepo}#supporters`

module.exports = {
  githubRepo,
  githubUserLink,
  githubRepoLink,
  githubRepoApiLink,
  githubLicenseLink,
  githubChangelogLink,
  githubIssuesLink,
  githubDiscussionsLink,
  githubIssueTemplateProblemReport,
  githubIssueTemplateFeatureRequest,
  githubAllReleases,
  githubLatestRelease,
  githubReadmeSupportSectionLink,
}
