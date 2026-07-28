import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {createPortal} from 'react-dom';
import CodeBlock from '@theme-original/CodeBlock';
import styles from './styles.module.css';

type Props = ComponentProps<typeof CodeBlock>;

/** True when an element can actually receive focus (not disabled/hidden/collapsed). */
const isFocusable = (el: HTMLElement): boolean =>
  !el.hasAttribute('disabled') &&
  el.getAttribute('aria-hidden') !== 'true' &&
  el.closest('[aria-hidden="true"]') === null &&
  el.getClientRects().length > 0;

/** Make a capped/scrollable <pre> reachable and announceable for keyboard users. */
const makePreKeyboardScrollable = (root: HTMLElement | null) => {
  const pre = root?.querySelector('pre');
  if (!pre) return;
  pre.tabIndex = 0;
  pre.setAttribute('role', 'region');
  pre.setAttribute('aria-label', 'Code sample');
};

/**
 * Wraps every fenced code block: height is capped at --doc-code-max-height
 * (scrollbar beyond that), and a button expands the block into a full-screen
 * modal dialog (focus-trapped, Esc/backdrop to close, scroll-locked; the rest
 * of the page is inert/aria-hidden while the modal is open).
 */
export default function CodeBlockWrapper(props: Props): ReactNode {
  const [expanded, setExpanded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setExpanded(false), []);

  // The scrollable in-page <pre> must be keyboard-reachable (Tab + arrow keys).
  useEffect(() => {
    makePreKeyboardScrollable(wrapRef.current);
  });

  useEffect(() => {
    if (!expanded) return undefined;
    // Scroll-lock the page and move focus into the dialog.
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    // Hide the background page (including the in-page copy of this block) from
    // assistive tech and keyboard focus. The modal is portaled to <body>, so it
    // sits outside the app root and stays interactive.
    const appRoot = document.getElementById('__docusaurus');
    if (appRoot) {
      appRoot.inert = true;
      appRoot.setAttribute('aria-hidden', 'true');
    }
    makePreKeyboardScrollable(modalRef.current);
    closeBtnRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;
      // Trap Tab inside the dialog — only among elements that can take focus.
      const focusables = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(isFocusable);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = previousOverflow;
      if (appRoot) {
        appRoot.inert = false;
        appRoot.removeAttribute('aria-hidden');
      }
      triggerRef.current?.focus(); // restore focus to the expand button
    };
  }, [expanded, close]);

  return (
    <>
      {/* Belt-and-braces: the app-root inert above already covers this node,
          but mark the in-page copy explicitly while its modal twin is open. */}
      <div
        ref={wrapRef}
        className={styles.wrap}
        inert={expanded || undefined}
        aria-hidden={expanded || undefined}
      >
        <CodeBlock {...props} />
        <button
          ref={triggerRef}
          type="button"
          className={styles.expandBtn}
          onClick={() => setExpanded(true)}
          aria-label="Expand code block"
          aria-haspopup="dialog"
          title="Expand"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" x2="14" y1="3" y2="10" />
            <line x1="3" x2="10" y1="21" y2="14" />
          </svg>
        </button>
      </div>
      {expanded &&
        createPortal(
          <div className={styles.overlay} onClick={close} role="presentation">
            <div
              ref={modalRef}
              className={styles.modal}
              role="dialog"
              aria-modal="true"
              aria-label="Expanded code"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                ref={closeBtnRef}
                type="button"
                className={styles.closeBtn}
                onClick={close}
                aria-label="Close expanded code"
                title="Close (Esc)"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
              <CodeBlock {...props} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
