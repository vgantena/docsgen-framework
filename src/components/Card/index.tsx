import React, {type CSSProperties, type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import {CARD_ICONS} from './icons';
import styles from './styles.module.css';

export interface CardProps {
  title: string;
  /** Internal path ('/getting-started') or external URL. Makes the whole card clickable. */
  href?: string;
  /** Lucide icon name from the registry (e.g. "rocket", "book-open", "code"). */
  icon?: string;
  children?: ReactNode;
}

function IconChip({name}: {name: string}): ReactNode {
  const glyph = CARD_ICONS[name];
  if (!glyph) return null;
  return (
    <span className={styles.iconChip} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {glyph}
      </svg>
    </span>
  );
}

export function Card({title, href, icon, children}: CardProps): ReactNode {
  const body = (
    <>
      <span className={styles.head}>
        {icon && <IconChip name={icon} />}
        <span className={styles.title}>{title}</span>
      </span>
      {children && <div className={styles.desc}>{children}</div>}
    </>
  );

  if (href) {
    return (
      <Link to={href} className={`${styles.card} ${styles.clickable}`}>
        {body}
        <span className={styles.arrow} aria-hidden="true">
          →
        </span>
      </Link>
    );
  }
  return <div className={styles.card}>{body}</div>;
}

export interface CardGridProps {
  children: ReactNode;
  /** Fixed column count; omit for responsive auto-fill based on --doc-card-min. */
  columns?: number;
}

export function CardGrid({children, columns}: CardGridProps): ReactNode {
  const style: CSSProperties | undefined = columns
    ? {gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`}
    : undefined;
  return (
    <div className={styles.grid} style={style}>
      {children}
    </div>
  );
}

export default Card;
