import {useCallback, useEffect, useRef, type CSSProperties, type ReactNode} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import clsx from 'clsx';
import styles from './styles.module.css';

export interface FigureProps {
  /** Image path under static/, e.g. "/img/projects/create-project.png". */
  src: string;
  /** Required — describe what the screenshot shows, not "screenshot". */
  alt: string;
  caption?: ReactNode;
  /** 'plain' = simple frame, 'browser' = browser-chrome frame for app screenshots, 'none' = raw. */
  frame?: 'plain' | 'browser' | 'none';
  /** Click-to-expand lightbox (default on). */
  zoom?: boolean;
  width?: number | string;
}

export default function Figure({
  src,
  alt,
  caption,
  frame = 'plain',
  zoom = true,
  width,
}: FigureProps): ReactNode {
  const url = useBaseUrl(src);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Saved <html> overflow value while the lightbox scroll-lock is active;
  // null means no lock is held.
  const savedOverflow = useRef<string | null>(null);

  if (process.env.NODE_ENV !== 'production' && !alt) {
    // MDX usage isn't typechecked, so enforce the required alt text at runtime.
    console.warn(
      `[Figure] Missing required \`alt\` text for image "${src}" — describe what the screenshot shows.`,
    );
  }

  const restoreScroll = useCallback(() => {
    if (savedOverflow.current !== null) {
      document.documentElement.style.overflow = savedOverflow.current;
      savedOverflow.current = null;
    }
  }, []);

  const open = useCallback(() => {
    dialogRef.current?.showModal();
    savedOverflow.current = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
  }, []);
  const close = useCallback(() => dialogRef.current?.close(), []);

  // Safety net: unmounting while the lightbox is open (e.g. client-side
  // navigation) must not leave the page unscrollable.
  useEffect(() => restoreScroll, [restoreScroll]);

  const style: CSSProperties | undefined = width ? {maxWidth: width} : undefined;
  const img = <img className={styles.img} src={url} alt={alt} loading="lazy" />;

  return (
    <figure className={styles.figure} style={style}>
      <div
        className={clsx(
          styles.frameBox,
          frame === 'browser' && styles.browser,
          frame === 'none' && styles.noFrame,
        )}
      >
        {frame === 'browser' && (
          <div className={styles.chrome} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}
        {zoom ? (
          <button
            type="button"
            className={styles.zoomBtn}
            onClick={open}
            aria-label={`Expand image: ${alt}`}
          >
            {img}
          </button>
        ) : (
          img
        )}
      </div>
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
      {zoom && (
        <dialog
          ref={dialogRef}
          className={styles.lightbox}
          aria-label="Image viewer"
          onClose={restoreScroll}
          onClick={(e) => {
            if (e.target === dialogRef.current) close();
          }}
        >
          <img src={url} alt={alt} />
          <button type="button" className={styles.closeBtn} onClick={close} aria-label="Close">
            {/* Lucide "x" — same glyph the CodeBlock modal close button uses. */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </dialog>
      )}
    </figure>
  );
}
