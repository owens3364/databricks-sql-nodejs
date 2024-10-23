import fetch, { RequestInfo, RequestInit, Request } from 'node-fetch';
import { TRowSet, TSparkArrowResultLink } from '../../thrift/TCLIService_types';
import IClientContext from '../contracts/IClientContext';
import IResultsProvider, { ResultsProviderFetchNextOptions } from './IResultsProvider';
import { ArrowBatch } from './utils';

export default class CloudFetchResultHandler implements IResultsProvider<ArrowBatch> {
  private readonly context: IClientContext;

  private readonly source: IResultsProvider<TRowSet | undefined>;

  private pendingLinks: Array<TSparkArrowResultLink> = [];

  private downloadTasks: Array<Promise<ArrowBatch>> = [];

  constructor(context: IClientContext, source: IResultsProvider<TRowSet | undefined>) {
    this.context = context;
    this.source = source;
  }

  public async hasMore() {
    if (this.pendingLinks.length > 0 || this.downloadTasks.length > 0) {
      return true;
    }
    return this.source.hasMore();
  }

  public async fetchNext(options: ResultsProviderFetchNextOptions) {
    const data = await this.source.fetchNext(options);

    data?.resultLinks?.forEach((link) => {
      this.pendingLinks.push(link);
    });

    const clientConfig = this.context.getConfig();
    const freeTaskSlotsCount = clientConfig.cloudFetchConcurrentDownloads - this.downloadTasks.length;

    if (freeTaskSlotsCount > 0) {
      const links = this.pendingLinks.splice(0, freeTaskSlotsCount);
      const tasks = links.map((link) => this.downloadLink(link));
      this.downloadTasks.push(...tasks);
    }

    const batch = await this.downloadTasks.shift();
    if (!batch) {
      return {
        batches: [],
        rowCount: 0,
      };
    }
    return batch;
  }

  private async downloadLink(link: TSparkArrowResultLink): Promise<ArrowBatch> {
    if (Date.now() >= link.expiryTime.toNumber()) {
      throw new Error('CloudFetch link has expired');
    }

    const response = await this.fetch(link.fileLink);
    if (!response.ok) {
      throw new Error(`CloudFetch HTTP error ${response.status} ${response.statusText}`);
    }

    const result = await response.arrayBuffer();
    return {
      batches: [Buffer.from(result)],
      rowCount: link.rowCount.toNumber(true),
    };
  }

  private async fetch(url: RequestInfo, init?: RequestInit) {
    const connectionProvider = await this.context.getConnectionProvider();
    const agent = await connectionProvider.getAgent();
    const retryPolicy = await connectionProvider.getRetryPolicy();

    const requestConfig: RequestInit = { agent, ...init };
    const result = await retryPolicy.invokeWithRetry(() => {
      const request = new Request(url, requestConfig);
      return fetch(request).then((response) => ({ request, response }));
    });
    return result.response;
  }
}
