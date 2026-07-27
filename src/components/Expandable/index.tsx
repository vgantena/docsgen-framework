import React, {type ReactNode} from 'react';
import styles from './styles.module.css';

export interface ExpandableProps {
  title: ReactNode;
  /** Render expanded on page load. */
  open?: boolean;
  children: ReactNode;
}

/**
 * Collapsible section built on native <details>/<summary> — keyboard and
 * screen-reader accessible with zero JavaScript.
 */
export default function Expandable({title, open, children}: ExpandableProps): ReactNode {
  return (
    <details className={styles.expandable} open={open}>
      <summary className={styles.summary}>{title}</summary>
      <div className={styles.content}>{children}</div>
    </details>
  );
}
