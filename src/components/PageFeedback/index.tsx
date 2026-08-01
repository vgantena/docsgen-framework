import {useEffect, useState, type ReactNode} from 'react';
import {useLocation} from '@docusaurus/router';
import site from '@site/site.config';
import styles from './styles.module.css';

/** localStorage key prefix — one entry per route so each page asks once. */
const STORAGE_PREFIX = 'docs-feedback:';

const readStored = (route: string): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + route) !== null;
  } catch {
    // localStorage unavailable (private mode, blocked storage) — ask again.
    return false;
  }
};

const writeStored = (route: string, helpful: boolean) => {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + route, helpful ? 'up' : 'down');
  } catch {
    // Best-effort only — losing the memo just means the page asks next visit.
  }
};

/**
 * "Was this page helpful?" row shown under every doc page (mounted by the
 * DocItem/Footer theme wrapper — never referenced from MDX). Hidden until
 * site.config.ts feedback.endpoint is set; each vote POSTs JSON
 * {route, helpful, ts} to that endpoint, fire-and-forget.
 */
export default function PageFeedback(): ReactNode {
  const endpoint = site.feedback.endpoint;
  const {pathname} = useLocation();
  const [submitted, setSubmitted] = useState(false);

  // Read localStorage only after mount — it doesn't exist during SSR, and
  // reading it during render would make hydration mismatch the server HTML.
  useEffect(() => {
    setSubmitted(readStored(pathname));
  }, [pathname]);

  if (!endpoint) return null;

  const submit = (helpful: boolean) => {
    // Fire-and-forget: never block or break the page on a failed beacon.
    fetch(endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({route: pathname, helpful, ts: Date.now()}),
      keepalive: true,
    }).catch(() => {});
    writeStored(pathname, helpful);
    setSubmitted(true);
  };

  return (
    <div className={styles.feedback} aria-live="polite">
      {submitted ? (
        <span className={styles.thanks}>Thanks for the feedback.</span>
      ) : (
        <>
          <span className={styles.prompt}>Was this page helpful?</span>
          <button
            type="button"
            className={styles.voteBtn}
            onClick={() => submit(true)}
            aria-label="Yes, this page was helpful"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {/* Lucide "thumbs-up" */}
              <path d="M7 10v12" />
              <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.voteBtn}
            onClick={() => submit(false)}
            aria-label="No, this page was not helpful"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {/* Lucide "thumbs-down" */}
              <path d="M17 14V2" />
              <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
