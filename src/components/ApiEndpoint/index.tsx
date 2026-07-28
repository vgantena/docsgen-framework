import {type ReactNode} from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

const VALID_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export interface ApiEndpointProps {
  /** HTTP method — colors the badge. */
  method: (typeof VALID_METHODS)[number];
  /** Endpoint path, e.g. "/v1/projects/{id}". */
  path: string;
  /** Optional one-line description shown after the path. */
  children?: ReactNode;
}

/**
 * API endpoint header line: method badge + monospace path.
 * Method colors reuse the Badge token palette (GET=green, POST=blue,
 * PUT/PATCH=amber, DELETE=red).
 */
export default function ApiEndpoint({method, path, children}: ApiEndpointProps): ReactNode {
  if (
    process.env.NODE_ENV !== 'production' &&
    !VALID_METHODS.includes(String(method).toUpperCase() as (typeof VALID_METHODS)[number])
  ) {
    // MDX usage isn't typechecked — an unknown method renders an unstyled badge.
    console.warn(
      `[ApiEndpoint] Unknown method "${method}". Valid methods: ${VALID_METHODS.join(', ')}.`,
    );
  }
  return (
    <div className={styles.endpoint}>
      <span className={clsx(styles.method, styles[method.toLowerCase()])}>{method}</span>
      <code className={styles.path}>{path}</code>
      {children && <span className={styles.desc}>{children}</span>}
    </div>
  );
}
