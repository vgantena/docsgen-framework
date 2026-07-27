import MDXComponents from '@theme-original/MDXComponents';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import {Card, CardGrid} from '@site/src/components/Card';
import Figure from '@site/src/components/Figure';
import Video from '@site/src/components/Video';
import Steps from '@site/src/components/Steps';
import Expandable from '@site/src/components/Expandable';
import Badge from '@site/src/components/Badge';
import ApiEndpoint from '@site/src/components/ApiEndpoint';

/**
 * Global MDX scope: every component listed here is available in ALL docs
 * pages without an import line — <Card>, <Figure>, <Video>, <Steps>,
 * <Expandable>, <Badge>, <CardGrid>, <ApiEndpoint>, <Tabs>/<TabItem>.
 */
export default {
  ...MDXComponents,
  Card,
  CardGrid,
  Figure,
  Video,
  Steps,
  Expandable,
  Badge,
  ApiEndpoint,
  Tabs,
  TabItem,
};
