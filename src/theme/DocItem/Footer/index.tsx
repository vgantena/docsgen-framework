import type {ReactNode} from 'react';
import Footer from '@theme-original/DocItem/Footer';
import PageFeedback from '@site/src/components/PageFeedback';

/**
 * Wraps the original doc-page footer (edit link, last-updated line) and mounts
 * the page-feedback widget beneath it on every doc page. The widget itself
 * renders nothing until site.config.ts feedback.endpoint is set.
 */
export default function FooterWrapper(): ReactNode {
  return (
    <>
      <Footer />
      <PageFeedback />
    </>
  );
}
