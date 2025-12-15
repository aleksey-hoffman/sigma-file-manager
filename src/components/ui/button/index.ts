// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { type VariantProps, cva } from 'class-variance-authority';

export { default as Button } from './button.vue';

export const buttonVariants = cva(
  'sigma-ui-button',
  {
    variants: {
      variant: {
        default: 'sigma-ui-button--default',
        destructive: 'sigma-ui-button--destructive',
        outline: 'sigma-ui-button--outline',
        secondary: 'sigma-ui-button--secondary',
        tertiary: 'sigma-ui-button--tertiary',
        ghost: 'sigma-ui-button--ghost',
        link: 'sigma-ui-button--link',
      },
      size: {
        default: 'sigma-ui-button--size-default',
        xs: 'sigma-ui-button--size-xs',
        sm: 'sigma-ui-button--size-sm',
        lg: 'sigma-ui-button--size-lg',
        icon: 'sigma-ui-button--size-icon',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
