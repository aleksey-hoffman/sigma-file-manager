// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const githubMainBranch = 'main';
const githubV2Branch = 'v2';
const githubUser = 'aleksey-hoffman';
const githubRepo = 'sigma-file-manager';
const githubFullRepoName = `${githubUser}/${githubRepo}`;
const githubBaseUrl = 'https://github.com';
const githubBaseApiUrl = 'https://api.github.com/repos';
const githubRawApiUrl = 'https://raw.githubusercontent.com';
const githubUserLink = `${githubBaseUrl}/${githubUser}`;
const githubRepoLink = `${githubBaseUrl}/${githubFullRepoName}`;
const githubRepoApiLink = `${githubBaseApiUrl}/${githubFullRepoName}`;
const githubLicenseLink = `${githubRepoLink}/blob/${githubV2Branch}/LICENSE.md`;
const githubChangelogLink = `${githubRepoLink}/blob/${githubV2Branch}/CHANGELOG.md`;
const githubIssuesLink = `${githubRepoLink}/issues/`;
const githubDiscussionsLink = `${githubRepoLink}/discussions/`;
const githubIssueTemplateProblemReport = `${githubRepoLink}/issues/new?template=Problem_report.md`;
const githubIssueTemplateFeatureRequest = `${githubRepoLink}/issues/new?template=Feature_request.md`;
const githubAllReleases = `${githubRepoLink}/releases`;
const githubLatestRelease = `${githubRepoLink}/releases/latest`;
const githubReadmeSupportSectionLink = `${githubRepoLink}#supporters`;
const githubLocalesLink = `${githubRawApiUrl}/${githubFullRepoName}/${githubMainBranch}/src/localization/locales`;

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
  githubLocalesLink
};