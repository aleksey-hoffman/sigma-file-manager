// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {ref} from 'vue';
import {defineStore} from 'pinia';
import {useUserPathsStore} from '@/stores/storage/userPaths';
import type {Runtime} from '@/types/runtime';

export const useRuntimeStore = defineStore('runtime', () => {
  const userPathsStore = useUserPathsStore();
  const runtime = ref<Runtime>({
    navigator: {
      infoPanel: {
        properties: []
      }
    }
  });

  return {
    userPaths: userPathsStore.userPaths,
    runtime
  };
});
