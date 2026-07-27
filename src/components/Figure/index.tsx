import React, {useCallback, useRef, type CSSProperties, type ReactNode} from 'react';
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

  const open = useCallback(() => {
    dialogRef.current?.showModal();
    document.documentElement.style.overflow = 'hidden';
  }, []);
  const close = useCallback(() => dialogRef.current?.close(), []);
  const onClose = useCallback(() => {
    document.documentElement.style.overflow = '';
  }, []);

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
          onClose={onClose}
          onClick={(e) => {
            if (e.target === dialogRef.current) close();
          }}
        >
          <img src={url} alt={alt} />
          <button type="button" className={styles.closeBtn} onClick={close} aria-label="Close">
            ✕
          </button>
        </dialog>
      )}
    </figure>
  );
}
