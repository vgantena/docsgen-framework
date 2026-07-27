import React, {type CSSProperties, type ReactNode, useCallback} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import clsx from 'clsx';
import styles from './styles.module.css';

export interface VideoProps {
  /** Video path under static/, e.g. "/video/projects/create-project.mp4". */
  src: string;
  /** Poster image shown before play, e.g. "/video/projects/create-project.jpg". */
  poster?: string;
  caption?: ReactNode;
  /** 'plain' = simple frame, 'browser' = browser-chrome frame, 'none' = raw. */
  frame?: 'plain' | 'browser' | 'none';
  /** GIF-style silent loop: autoplays muted, hides controls. */
  autoPlay?: boolean;
  loop?: boolean;
  /** Start muted (implied by autoPlay). */
  muted?: boolean;
  /** Show player controls. Default: true, unless autoPlay. */
  controls?: boolean;
  /** Skip intro: start playback at this many seconds in. */
  startAt?: number;
  /** Playback speed, e.g. 1.5 for slightly-sped-up walkthroughs. */
  playbackRate?: number;
  width?: number | string;
}

export default function Video({
  src,
  poster,
  caption,
  frame = 'plain',
  autoPlay = false,
  loop,
  muted,
  controls,
  startAt,
  playbackRate,
  width,
}: VideoProps): ReactNode {
  const url = useBaseUrl(src);
  const posterUrl = useBaseUrl(poster ?? '');
  const style: CSSProperties | undefined = width ? {maxWidth: width} : undefined;

  const setupVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      if (!el) return;
      if (playbackRate) el.playbackRate = playbackRate;
      // React doesn't serialize `muted` into static HTML, so on first paint the
      // browser blocks unmuted autoplay. Set it imperatively and retry play().
      if (muted ?? autoPlay) {
        el.muted = true;
        el.defaultMuted = true;
      }
      if (autoPlay && el.paused) {
        el.play().catch(() => {
          /* user gesture required — controls remain available */
        });
      }
    },
    [playbackRate, muted, autoPlay],
  );

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
        <video
          ref={setupVideo}
          className={styles.video}
          src={startAt ? `${url}#t=${startAt}` : url}
          poster={poster ? posterUrl : undefined}
          controls={controls ?? !autoPlay}
          autoPlay={autoPlay}
          muted={muted ?? autoPlay}
          loop={loop ?? autoPlay}
          playsInline
          preload="metadata"
        />
      </div>
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
    </figure>
  );
}
