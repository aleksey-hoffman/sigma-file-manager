<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {Icon} from '@iconify/vue';
import {reactive, computed, onMounted} from 'vue';
import {useI18n} from 'vue-i18n';
import {useRouter} from 'vue-router';
import Button from '@/components/ui/button/Button.vue';
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
  <div class="settings__content-area-title">
    {{ $t('pages.settings') }}
  </div>
  <div class="settings__page-header">
    <img
      class="settings__logo"
      src="@/assets/icons/logo-1024x1024.png"
      alt="Sigma File Manager Logo"
      width="87px"
    >
    <div class="settings__content-area-header-content">
      <strong>"{{ $t('app.name') }}"</strong>
      {{ $t('app.description') }}
      <br>
      {{ $t('app.copyright') }}

      <div class="settings__content-area-header-buttons">
        <template
          v-for="(item, index) in headerButtons"
          :key="'header-button-' + index"
        >
          <Button
            icon-class="mr-3"
            :icon="item.icon"
            @click="router.push(item.link)"
          >
            <template #tooltip>
              <div class="settings__buttons_tooltip">
                <Icon
                  class="mr-3"
                  size="16px"
                  icon="mdi-open-in-new"
                />
                {{ item.link }}
              </div>
            </template>
            {{ item.title }}
          </Button>
        </template>
      </div>
    </div>
  </div>
</template>

<style>
.settings__content-area-title {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--divider-color);
  font-size: 28px;
}

.settings__page-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-top: 30px;
  gap: 48px;
}

.settings__content-area-header-content {
  margin-left: 50px;
}

.settings__content-area-header-buttons {
  display: flex;
  align-items: center;
  margin-top: 20px;
  gap: 12px;
}

.settings__buttons_tooltip {
  display: flex;
  align-items: center;
}
</style>
