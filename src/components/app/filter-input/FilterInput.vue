<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {ref, nextTick} from 'vue';
import {Button} from '@/components/ui/button';
import {MenuButton} from '@/components/ui/menu-button';

interface Props {
  modelValue: string;
}

interface Emits {
  (event: 'update:modelValue', value: string): void;
}

const props = defineProps<Props>();

const emit = defineEmits<Emits>();

const filterInput = ref<null | HTMLElement>(null);
const showField = ref(false);

if (props.modelValue.length) {
  showField.value = true;
  nextTick(() => {
    filterInput.value?.focus?.();
  });
}

function onInputClickOutside() {
  if (props.modelValue.length > 0) {
    return;
  }
  showField.value = false;
}

function onActivatorClick() {
  showField.value = true;
  nextTick(() => {
    filterInput.value?.focus?.();
  });
}
</script>

<template>
  <div
    v-click-outside="onInputClickOutside"
    class="filter-input"
  >
    <div
      class="filter-input__activator"
      :class="{ 'filter-input__activator--visible': !showField }"
    >
      <Button
        icon="mdi:search"
        :menu-items="[]"
        @click="onActivatorClick"
      />
    </div>
    <div
      class="filter-input__box"
      :class="{ 'filter-input__box--visible': showField }"
    >
      <input
        ref="filterInput"
        :value="props.modelValue"
        class="filter-input__input"
        :placeholder="$t('filter.filter')"
        type="text"
        maxlength="32"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value || '')"
        @keydown.esc.stop="onInputClickOutside"
      >
      <div class="filter-input__buttons">
        <div
          v-if="props.modelValue.length > 0"
          class="filter-input__clear-button"
        >
          <Button
            icon="mdi:backspace-outline"
            icon-size="16px"
            size="x-small"
            @click="emit('update:modelValue', '')"
          />
        </div>
        <MenuButton
          icon="mdi:filter-variant"
          :menu-items="[]"
        />
      </div>
    </div>
  </div>
</template>

<style>
.filter-input {
  position: relative;
  display: flex;
  min-height: var(--action-toolbar-height);
  align-items: center;
  justify-content: center;
}

.filter-input__box {
  position: absolute;
  top: calc(50% - 17px);
  right: 32px;
  display: flex;
  width: 300px;
  height: 34px;
  flex-shrink: 0;
  align-items: center;
  padding-top: 1px;
  border: 1px solid rgb(255 255 255 / 5%);
  margin-bottom: 1px;
  opacity: 0;
  pointer-events: none;
  transition: all 0.3s ease;
}

.filter-input__box--visible {
  opacity: 1;
  pointer-events: all;
  transform: translateX(32px);
}

.filter-input__activator {
  opacity: 0;
  transform: translateX(12px);
  transition: all 0.3s ease;
}

.filter-input__activator--visible {
  opacity: 1;
  transform: translateX(0);
}

.filter-input__box::after {
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 100%;
  height: 1px;
  background-color: rgb(var(--key-color-value) / 0%);
  box-shadow: 0 0 6px rgb(var(--key-color-value) / 0%);
  content: "";
}

.filter-input__box:has(input:focus)::after {
  background-color: rgb(var(--key-color-value) / 50%);
  box-shadow: 0 0 6px rgb(var(--key-color-value) / 100%);
}

.filter-input__input {
    width: 100%;
    height: 32px;
    padding-top: 0;
    padding-right: 68px;
    padding-left: 12px;
    border: 0 solid #B0BEC5;
    margin-left: 0;
    background: transparent;
    caret-color: var(--color);
    color: var(--color);
    -webkit-mask: linear-gradient(to left, transparent 35%, black 50%);
    mask: linear-gradient(to left, transparent 35%, black 50%);
    outline: none;
    transition: background-color 0.3s ease;
  }

.filter-input__box:hover {
  background-color: var(--background);
}


.filter-input__box
  input::placeholder {
    color: var(--color-darker-3);
    user-select: none;
  }

.filter-input__box
  input:focus::placeholder {
    opacity: 0.6;
  }

.filter-input__buttons {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  background-color: var(--background-2);
  gap: 4px;
  transition: background-color 0.3s ease;
}

.filter-input__box:hover
  .filter-input__buttons {
    background-color: var(--background);
  }
</style>