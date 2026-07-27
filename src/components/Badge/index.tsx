import React, {type ReactNode} from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

export type BadgeVariant = 'new' | 'beta' | 'pro' | 'admin' | 'info';

export interface BadgeProps {
  /** 'new' | 'beta' | 'pro' (plan gate) | 'admin' (role gate) | 'info'. */
  variant?: BadgeVariant;
  children: ReactNode;
}

/** Small inline pill for plan tiers, roles, and feature states. */
export default function Badge({variant = 'info', children}: BadgeProps): ReactNode {
  return <span className={clsx(styles.badge, styles[variant])}>{children}</span>;
}
