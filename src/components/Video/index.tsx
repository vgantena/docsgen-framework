import {useCallback, useId, type CSSProperties, type ReactNode} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import clsx from 'clsx';
import styles from './styles.module.css';

export interface VideoProps {
  /** Video path under static/, e.g. "/video/projects/create-project.mp4". */
  src: string;
  /** Poster image shown before play, e.g. "/video/projects/create-project.jpg". */
  poster?: string;
  caption?: ReactNode;
  /** WebVTT captions file under static/, e.g. "/video/projects/create-project.vtt". */
  captions?: string;
  /** Accessible name for the video (aria-label), e.g. "Creating a project". */
  label?: string;
  /** 'plain' = simple frame, 'browser' = browser-chrome frame, 'none' = raw. */
  frame?: 'plain' | 'browser' | 'none';
  /** Autoplay muted (GIF-style silent loop). Controls stay visible so the loop
   *  can be paused (WCAG 2.2.2) — pass controls={false} to hide them explicitly. */
  autoPlay?: boolean;
  loop?: boolean;
  /** Start muted (implied by autoPlay). */
  muted?: boolean;
  /** Show player controls. Default: true (even with autoPlay). */
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
  captions,
  label,
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
  const captionsUrl = useBaseUrl(captions ?? '');
  const captionId = useId();
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
        {/* Controls default to visible even for autoplaying loops so motion can
            always be paused (WCAG 2.2.2). Autoplay stays muted + playsInline. */}
        <video
          ref={setupVideo}
          className={styles.video}
          src={startAt ? `${url}#t=${startAt}` : url}
          poster={poster ? posterUrl : undefined}
          controls={controls ?? true}
          autoPlay={autoPlay}
          muted={muted ?? autoPlay}
          loop={loop ?? autoPlay}
          playsInline
          preload="metadata"
          aria-label={label}
          aria-describedby={caption ? captionId : undefined}
        >
          {captions && <track kind="captions" src={captionsUrl} srcLang="en" label="Captions" default />}
        </video>
      </div>
      {caption && (
        <figcaption id={captionId} className={styles.caption}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
