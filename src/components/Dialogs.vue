<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <ErrorDialog />
    <ConfirmationDialog />
    <AppGuideDialog />
    <ShortcutEditorDialog />
    <RenameDirItemDialog />
    <NewDirItemDialog />
    <DirItemPermissionManagerDialog />
    <HomeBannerPickerDialog />
    <HomeBannerPositionDialog />
    <HomeBannerHeightDialog />
    <HomeBannerOverlayDialog />
    <UserDirectoryEditorDialog />
    <ProgramEditorDialog />
    <ImagePickerDialog />
    <MathEditorDialog />
    <ExternalDownloadDialog />
    <LocalShareManagerDialog />
    <NoteEditorDialog />
    <WorkspaceEditorDialog />
    <ArchiveCompressionDialog />
    <ArchiveExtractionDialog />
    <DownloadTypeSelectorDialog />
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'

import ErrorDialog from '@/components/dialogs/ErrorDialog.vue'
import ConfirmationDialog from '@/components/dialogs/ConfirmationDialog.vue'
import AppGuideDialog from '@/components/dialogs/AppGuideDialog.vue'
import ShortcutEditorDialog from '@/components/dialogs/ShortcutEditorDialog.vue'
import RenameDirItemDialog from '@/components/dialogs/RenameDirItemDialog.vue'
import NewDirItemDialog from '@/components/dialogs/NewDirItemDialog.vue'
import DirItemPermissionManagerDialog from '@/components/dialogs/DirItemPermissionManagerDialog.vue'
import HomeBannerPickerDialog from '@/components/dialogs/HomeBannerPickerDialog.vue'
import HomeBannerPositionDialog from '@/components/dialogs/HomeBannerPositionDialog.vue'
import HomeBannerHeightDialog from '@/components/dialogs/HomeBannerHeightDialog.vue'
import HomeBannerOverlayDialog from '@/components/dialogs/HomeBannerOverlayDialog.vue'
import UserDirectoryEditorDialog from '@/components/dialogs/UserDirectoryEditorDialog.vue'
import ProgramEditorDialog from '@/components/dialogs/ProgramEditorDialog.vue'
import ImagePickerDialog from '@/components/dialogs/ImagePickerDialog.vue'
import MathEditorDialog from '@/components/dialogs/MathEditorDialog.vue'
import ExternalDownloadDialog from '@/components/dialogs/ExternalDownloadDialog.vue'
import LocalShareManagerDialog from '@/components/dialogs/LocalShareManagerDialog.vue'
import DownloadTypeSelectorDialog from '@/components/dialogs/DownloadTypeSelectorDialog.vue'
import WorkspaceEditorDialog from '@/components/dialogs/WorkspaceEditorDialog.vue'
import ArchiveCompressionDialog from '@/components/dialogs/ArchiveCompressionDialog.vue'
import ArchiveExtractionDialog from '@/components/dialogs/ArchiveExtractionDialog.vue'
import NoteEditorDialog from '@/components/dialogs/NoteEditorDialog.vue'

export default {
  components: {
    ErrorDialog,
    ConfirmationDialog,
    AppGuideDialog,
    ShortcutEditorDialog,
    RenameDirItemDialog,
    NewDirItemDialog,
    DirItemPermissionManagerDialog,
    HomeBannerPickerDialog,
    HomeBannerPositionDialog,
    HomeBannerHeightDialog,
    HomeBannerOverlayDialog,
    UserDirectoryEditorDialog,
    ProgramEditorDialog,
    ImagePickerDialog,
    MathEditorDialog,
    ExternalDownloadDialog,
    LocalShareManagerDialog,
    DownloadTypeSelectorDialog,
    WorkspaceEditorDialog,
    ArchiveCompressionDialog,
    ArchiveExtractionDialog,
    NoteEditorDialog,
  },
  mounted () {
    this.dialogsDefaultData = this.$utils.cloneDeep(this.dialogs)
  },
  computed: {
    ...mapFields({
      dialogs: 'dialogs',
      dialogsDefaultData: 'dialogsDefaultData',
    }),
  },
}
</script>

<style>
.program-icon-set__container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 24px;
}

.program-icon-set__container
  .v-btn[is-selected="true"] {
    background-color: var(--highlight-color-4);
    border: 1px solid var(--icon-color-1);
    border-radius: 4px;
  }

.program-icon-set__container
  .v-btn
    .v-icon {
      color: var(--icon-color-2) !important;
    }

.program-icon-set__container
  .v-btn[is-selected="true"]
    .v-icon {
      color: var(--icon-color-1) !important;
    }
</style>
