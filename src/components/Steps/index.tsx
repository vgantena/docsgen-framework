import React, {type ReactNode} from 'react';
import styles from './styles.module.css';

/**
 * Wrap a plain Markdown ordered list to render it as numbered step circles
 * with a connecting line:
 *
 *   <Steps>
 *   1. Open **Settings**.
 *   2. Click **New API key**.
 *   </Steps>
 */
export default function Steps({children}: {children: ReactNode}): ReactNode {
  return <div className={styles.steps}>{children}</div>;
}
