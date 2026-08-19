import { SourceItem } from '../source-item';

export const SOURCE_CONNECTORS = 'SOURCE_CONNECTORS';

export type ConnectorSource = {
  type: string;
  name: string;
  externalId: string | null;
  url: string | null;
  artistId: string | null;
};

export interface SourceConnector {
  canHandle(source: ConnectorSource): boolean;
  fetch(source: ConnectorSource): Promise<SourceItem[]>;
}
