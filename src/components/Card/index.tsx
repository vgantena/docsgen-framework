import {type CSSProperties, type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import clsx from 'clsx';
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
  if (!glyph) {
    if (process.env.NODE_ENV !== 'production') {
      // MDX usage isn't typechecked — surface typos instead of failing silent.
      console.warn(
        `[Card] Unknown icon "${name}". Valid names: ${Object.keys(CARD_ICONS).join(', ')}. ` +
          'Add new icons to src/components/Card/icons.tsx.',
      );
    }
    return null;
  }
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
      <Link to={href} className={clsx(styles.card, styles.clickable)}>
        {body}
        <span className={styles.arrow} aria-hidden="true">
          {/* Lucide "arrow-right" — keeps the outline icon style, no text glyphs. */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
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
