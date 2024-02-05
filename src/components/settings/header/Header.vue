<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {Icon} from '@iconify/vue';
import {reactive, computed, onMounted} from 'vue';
import {useI18n} from 'vue-i18n';
import {useRouter} from 'vue-router';
import externalLinks from '@/data/external-links';

const router = useRouter();
const {t} = useI18n();

interface RepoData {
  stargazers_count: number;
}

const githubProjectData = reactive({
  stars: 0
});

async function fetchGithubProjectData(): Promise<RepoData | null> {
  try {
    const response = await fetch(externalLinks.githubRepoApiLink);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const repoData: RepoData = await response.json();
    githubProjectData.stars = repoData.stargazers_count;
    return repoData;
  } catch (error) {
    console.error('Failed to fetch GitHub project data:', error);
    return null;
  }
}

const headerButtons = computed(() => [
  {
    title: t('projectGithubButtons.projectPage'),
    link: externalLinks.githubRepoLink
  },
  {
    title: t('projectGithubButtons.requestsIssues'),
    link: externalLinks.githubIssuesLink
  },
  {
    title: t('projectGithubButtons.discussions'),
    link: externalLinks.githubDiscussionsLink
  },
  {
    title: t('projectGithubButtons.stars', {n: githubProjectData.stars}),
    icon: 'mdi-star-outline',
    link: externalLinks.githubRepoLink
  }
]);

onMounted(() => {
  fetchGithubProjectData();
});
</script>

<template>
  <div class="content-area__title">
    {{ $t('pages.settings') }}
    <VDivider class="my-3" />
  </div>
  <div class="settings-page-header">
    <img
      class="settings-page-header__logo"
      src="@/assets/icons/logo-1024x1024.png"
      alt="Sigma File Manager Logo"
      width="87px"
    >
    <div class="content-area__header__content">
      <strong>"{{ $t('app.name') }}"</strong>
      {{ $t('app.description') }}
      <br>
      {{ $t('app.copyright') }}

      <div class="content-area__header__buttons">
        <VTooltip
          v-for="(item, index) in headerButtons"
          :key="'header-button-' + index"
          location="bottom"
        >
          <template #activator="{ props }">
            <VBtn
              class="content-area__header__buttons__item button-1"
              variant="flat"
              small
              v-bind="props"
              @click="router.push(item.link)"
            >
              <Icon
                v-if="item.icon"
                class="mr-2"
                size="16px"
                :icon="item.icon"
              />
              {{ item.title }}
            </VBtn>
          </template>
          <span>
            <VLayout align-center>
              <Icon
                class="mr-3"
                size="16px"
                icon="mdi-open-in-new"
              />
              {{ item.link }}
            </VLayout>
          </span>
        </VTooltip>
      </div>
    </div>
  </div>
</template>

<style scoped>
.content-area__title {
  font-size: 28px;
}

.settings-page-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-bottom: 30px;
  gap: 48px;
}

.content-area__header__content {
  margin-left: 50px;
}

.content-area__header__buttons {
  display: flex;
  align-items: center;
  margin-top: 20px;
  gap: 12px;
}
</style>
