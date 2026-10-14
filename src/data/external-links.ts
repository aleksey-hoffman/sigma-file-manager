// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-14：品牌化。此前全部指向上游 aleksey-hoffman/sigma-file-manager，
// 会把用户带到别人的仓库。设置页外链菜单只用这一组常量，改这里不影响同文件里的
// extensionsRegistryUrl / extensionsDevelopmentWikiUrl / updateChannelSiteUrl。
const githubMainBranch = 'main';
const githubUser = 'kizemo';
const githubRepo = 'alpha-file-manager';
const githubFullRepoName = `${githubUser}/${githubRepo}`;
const githubBaseUrl = 'https://github.com';
const githubBaseApiUrl = 'https://api.github.com/repos';
const githubRawApiUrl = 'https://raw.githubusercontent.com';
const githubUserLink = `${githubBaseUrl}/${githubUser}`;
const githubRepoLink = `${githubBaseUrl}/${githubFullRepoName}`;
const githubRepoApiLink = `${githubBaseApiUrl}/${githubFullRepoName}`;
const githubLicenseLink = `${githubRepoLink}/blob/${githubMainBranch}/LICENSE.md`;
const githubChangelogLink = `${githubRepoLink}/blob/${githubMainBranch}/CHANGELOG.md`;
const githubIssuesLink = `${githubRepoLink}/issues/`;
const githubDiscussionsLink = `${githubRepoLink}/discussions/`;
const githubIssueTemplateProblemReport = `${githubRepoLink}/issues/new?template=Problem_report.md`;
const githubIssueTemplateFeatureRequest = `${githubRepoLink}/issues/new?template=Feature_request.md`;
const githubAllReleases = `${githubRepoLink}/releases`;
const githubLatestRelease = `${githubRepoLink}/releases/latest`;
const githubReadmeSupportSectionLink = `${githubRepoLink}#supporters`;

const extensionsRegistryRepo = 'sfm-marketplace';
const extensionsRegistryOrg = 'sigma-hub';
const extensionsRegistryFullRepoName = `${extensionsRegistryOrg}/${extensionsRegistryRepo}`;
const extensionsRegistryBaseUrl = `${githubRawApiUrl}/${extensionsRegistryFullRepoName}/main`;
const extensionsRegistryUrl = `${extensionsRegistryBaseUrl}/registry.json`;
const extensionsSubmissionGuideUrl = `${githubBaseUrl}/${extensionsRegistryFullRepoName}#readme`;
const extensionsDevelopmentWikiUrl = `${githubBaseUrl}/${extensionsRegistryFullRepoName}/wiki`;
const extensionsApiBaseUrl = `${githubRawApiUrl}/${githubFullRepoName}/${githubMainBranch}/packages/api`;
const extensionsTypesUrl = `${extensionsApiBaseUrl}/index.d.ts`;
const extensionsManifestSchemaUrl = `${extensionsApiBaseUrl}/manifest.schema.json`;

// 更新渠道的**人机入口页面**（下载 + 全部历史版本）。
//
// 这里只放 UI 要跳转的页面 URL，不要再复制一份 version.json / releases API 的地址：
// 那些由 Rust 侧 app_updater.rs 的常量唯一定义，复制过来必然漂移。
// 站点页会读取 version.json 并渲染 history[]，所以「查看所有版本」指向它。
const updateChannelSiteUrl = 'https://www.aiec.fun/alpha-file-manager';

// 「段燚的学习笔记」入口。人名 + 自定义标题，属专有名词，17 个语言包统一写同一字符串、不做英译。
const learningNotesUrl = 'http://www.aiec.fun';

export default {
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
  extensionsRegistryUrl,
  extensionsSubmissionGuideUrl,
  extensionsDevelopmentWikiUrl,
  extensionsTypesUrl,
  extensionsManifestSchemaUrl,
  updateChannelSiteUrl,
  learningNotesUrl,
};
