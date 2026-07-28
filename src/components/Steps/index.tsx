import {useEffect, useRef, type ReactNode} from 'react';
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
  const ref = useRef<HTMLDivElement>(null);

  // The styling removes list markers (list-style: none), which makes Safari/
  // VoiceOver drop list semantics. MDX renders the <ol> for us, so restore the
  // semantics on the child element via an explicit role.
  useEffect(() => {
    ref.current?.querySelector(':scope > ol')?.setAttribute('role', 'list');
  }, []);

  return (
    <div ref={ref} className={styles.steps}>
      {children}
    </div>
  );
}
