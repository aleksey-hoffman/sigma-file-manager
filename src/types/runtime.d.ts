// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export type Runtime = {
  navigator: Navigator;
}

export type Navigator = {
  infoPanel: NavigatorInfoPanel;
}

export type NavigatorInfoPanel = {
  properties: NavigatorInfoPanelProperty[];
};

export type NavigatorInfoPanelProperty = {
  propName: string;
  title: string;
  value: string;
  tooltip: string;
};