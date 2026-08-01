import {useCallback, useId, useState, type CSSProperties, type ReactNode} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import clsx from 'clsx';
import styles from './styles.module.css';

export interface CarouselSlide {
  /** Image path under static/, e.g. "/img/items/add-item-1.png". */
  src: string;
  /** Required — describe what the screenshot shows, not "screenshot". */
  alt: string;
  /** Per-slide caption shown under the image (the step's instruction). */
  caption?: string;
}

export interface CarouselProps {
  /** Ordered slides; each is one step of the walkthrough. */
  slides: CarouselSlide[];
  /** 'plain' = simple frame, 'browser' = browser-chrome frame for app screenshots. */
  frame?: 'plain' | 'browser';
  /** Overall caption under the carousel (what the sequence teaches). */
  caption?: ReactNode;
  width?: number | string;
}

/**
 * User-paced step slideshow — the lightweight alternative to a <Video> when a
 * task is better taught as discrete captioned screenshots. Keyboard: ← / →.
 */
export default function Carousel({slides, frame = 'browser', caption, width}: CarouselProps): ReactNode {
  const [index, setIndex] = useState(0);
  const liveId = useId();

  if (process.env.NODE_ENV !== 'production') {
    // MDX usage isn't typechecked — surface bad props in dev.
    if (!Array.isArray(slides) || slides.length === 0) {
      console.warn('[Carousel] `slides` must be a non-empty array of {src, alt, caption?}.');
    } else {
      for (const s of slides) {
        if (!s.alt) console.warn(`[Carousel] Missing required \`alt\` text for slide "${s.src}".`);
      }
    }
  }

  const count = slides?.length ?? 0;
  const clamp = useCallback((i: number) => Math.min(Math.max(i, 0), count - 1), [count]);
  const go = useCallback((i: number) => setIndex(clamp(i)), [clamp]);

  if (count === 0) return null;
  const slide = slides[clamp(index)];

  const style: CSSProperties | undefined = width ? {maxWidth: width} : undefined;

  return (
    <figure
      className={styles.carousel}
      style={style}
      aria-roledescription="carousel"
      aria-label={typeof caption === 'string' ? caption : 'Step-by-step screenshots'}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(index - 1);
        if (e.key === 'ArrowRight') go(index + 1);
      }}
    >
      <div className={clsx(styles.frameBox, frame === 'browser' && styles.browser)}>
        {frame === 'browser' && (
          <div className={styles.chrome} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}
        <div id={liveId} aria-live="polite">
          <Slide slide={slide} position={index + 1} count={count} />
        </div>
      </div>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Previous step"
          aria-controls={liveId}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {/* Lucide "chevron-left" */}
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className={styles.dots} role="tablist" aria-label="Steps">
          {slides.map((s, i) => (
            <button
              key={s.src}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Step ${i + 1} of ${count}`}
              className={clsx(styles.dot, i === index && styles.dotActive)}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <span className={styles.counter}>
          {index + 1} / {count}
        </span>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => go(index + 1)}
          disabled={index === count - 1}
          aria-label="Next step"
          aria-controls={liveId}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {/* Lucide "chevron-right" */}
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
    </figure>
  );
}

function Slide({slide, position, count}: {slide: CarouselSlide; position: number; count: number}): ReactNode {
  const url = useBaseUrl(slide.src);
  return (
    <div role="group" aria-roledescription="slide" aria-label={`Step ${position} of ${count}`}>
      <img className={styles.img} src={url} alt={slide.alt} loading="lazy" />
      {slide.caption && <div className={styles.slideCaption}>{slide.caption}</div>}
    </div>
  );
}
