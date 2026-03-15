// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export type WorkerResponseMessage = {
  type: 'bridge-response';
  id: string;
  result?: unknown;
  error?: string;
};

export type WorkerHandlerInvokeMessage = {
  type: 'invoke-worker-handler';
  callId: string;
  handlerId: string;
  args: unknown[];
};

export type WorkerListenerEmitMessage = {
  type: 'emit-worker-listener';
  handlerId: string;
  args: unknown[];
};

export type WorkerModalEventMessage = {
  type: 'emit-modal-event';
  resourceId: string;
  eventName: 'close';
};

export type WorkerProgressCancelMessage = {
  type: 'emit-progress-cancel';
  resourceId: string;
};

export type WorkerShellProgressMessage = {
  type: 'emit-shell-progress';
  resourceId: string;
  payload: unknown;
};

export type WorkerShellCompleteMessage = {
  type: 'emit-shell-complete';
  resourceId: string;
  result?: unknown;
  error?: string;
};

export type HostToWorkerMessage
  = | WorkerResponseMessage
    | WorkerHandlerInvokeMessage
    | WorkerListenerEmitMessage
    | WorkerModalEventMessage
    | WorkerProgressCancelMessage
    | WorkerShellProgressMessage
    | WorkerShellCompleteMessage
    | HostInitializeMessage
    | HostActivateMessage
    | HostDeactivateMessage;

export type HostBridgeCallMessage = {
  type: 'bridge-call';
  id: string;
  method: string;
  args: unknown[];
};

export type HostRegisterCommandMessage = {
  type: 'register-command';
  id: string;
  resourceId: string;
  command: unknown;
  handlerId: string;
};

export type HostRegisterContextMenuItemMessage = {
  type: 'register-context-menu-item';
  id: string;
  resourceId: string;
  item: unknown;
  handlerId: string;
};

export type HostRegisterToolbarDropdownMessage = {
  type: 'register-toolbar-dropdown';
  id: string;
  resourceId: string;
  dropdown: unknown;
  handlers: Record<string, string>;
};

export type HostRegisterSidebarPageMessage = {
  type: 'register-sidebar-page';
  id: string;
  resourceId: string;
  page: unknown;
};

export type HostSubscribeContextPathMessage = {
  type: 'subscribe-context-path';
  id: string;
  resourceId: string;
  handlerId: string;
};

export type HostSubscribeContextSelectionMessage = {
  type: 'subscribe-context-selection';
  id: string;
  resourceId: string;
  handlerId: string;
};

export type HostSubscribeSettingsChangeMessage = {
  type: 'subscribe-settings-change';
  id: string;
  resourceId: string;
  key: string;
  handlerId: string;
};

export type HostCreateModalMessage = {
  type: 'create-modal';
  id: string;
  resourceId: string;
  options: unknown;
  submitHandlerId: string;
  valueChangeHandlerId: string;
};

export type HostModalCloseMessage = {
  type: 'modal-close';
  id: string;
  resourceId: string;
};

export type HostModalUpdateElementMessage = {
  type: 'modal-update-element';
  id: string;
  resourceId: string;
  elementId: string;
  updates: unknown;
};

export type HostModalSetContentMessage = {
  type: 'modal-set-content';
  id: string;
  resourceId: string;
  content: unknown;
};

export type HostModalSetButtonsMessage = {
  type: 'modal-set-buttons';
  id: string;
  resourceId: string;
  buttons: unknown;
};

export type HostProgressStartMessage = {
  type: 'progress-start';
  id: string;
  resourceId: string;
  options: unknown;
};

export type HostProgressReportMessage = {
  type: 'progress-report';
  id: string;
  resourceId: string;
  value: unknown;
};

export type HostProgressFinishMessage = {
  type: 'progress-finish';
  id: string;
  resourceId: string;
};

export type HostProgressErrorMessage = {
  type: 'progress-error';
  id: string;
  resourceId: string;
  error?: string;
};

export type HostShellRunWithProgressStartMessage = {
  type: 'shell-run-with-progress-start';
  id: string;
  resourceId: string;
  commandPath: string;
  args?: string[];
};

export type HostShellRunWithProgressCancelMessage = {
  type: 'shell-run-with-progress-cancel';
  id: string;
  resourceId: string;
};

export type HostDisposeResourceMessage = {
  type: 'dispose-resource';
  id: string;
  resourceId: string;
};

export type HostInvokeWorkerHandlerResultMessage = {
  type: 'invoke-worker-handler-result';
  callId: string;
  result?: unknown;
  error?: string;
};

export type HostInitializeMessage = {
  type: 'initialize';
  id: string;
  entryUrl: string;
};

export type HostActivateMessage = {
  type: 'activate';
  id: string;
  context: unknown;
};

export type HostDeactivateMessage = {
  type: 'deactivate';
  id: string;
};

export type WorkerToHostMessage
  = | WorkerResponseMessage
    | HostBridgeCallMessage
    | HostRegisterCommandMessage
    | HostRegisterContextMenuItemMessage
    | HostRegisterToolbarDropdownMessage
    | HostRegisterSidebarPageMessage
    | HostSubscribeContextPathMessage
    | HostSubscribeContextSelectionMessage
    | HostSubscribeSettingsChangeMessage
    | HostCreateModalMessage
    | HostModalCloseMessage
    | HostModalUpdateElementMessage
    | HostModalSetContentMessage
    | HostModalSetButtonsMessage
    | HostProgressStartMessage
    | HostProgressReportMessage
    | HostProgressFinishMessage
    | HostProgressErrorMessage
    | HostShellRunWithProgressStartMessage
    | HostShellRunWithProgressCancelMessage
    | HostDisposeResourceMessage
    | HostInvokeWorkerHandlerResultMessage;

export type WorkerRuntimeMessage = HostToWorkerMessage | WorkerToHostMessage;

export function createRequestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
