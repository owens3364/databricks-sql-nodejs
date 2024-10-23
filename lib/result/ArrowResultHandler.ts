import { TGetResultSetMetadataResp, TRowSet } from '../../thrift/TCLIService_types';
import IClientContext from '../contracts/IClientContext';
import IResultsProvider, { ResultsProviderFetchNextOptions } from './IResultsProvider';
import { ArrowBatch, hiveSchemaToArrowSchema } from './utils';

export default class ArrowResultHandler implements IResultsProvider<ArrowBatch> {
  private readonly context: IClientContext;

  private readonly source: IResultsProvider<TRowSet | undefined>;

  private readonly arrowSchema?: Buffer;

  constructor(
    context: IClientContext,
    source: IResultsProvider<TRowSet | undefined>,
    { schema, arrowSchema }: TGetResultSetMetadataResp,
  ) {
    this.context = context;
    this.source = source;
    // Arrow schema is not available in old DBR versions, which also don't support native Arrow types,
    // so it's possible to infer Arrow schema from Hive schema ignoring `useArrowNativeTypes` option
    this.arrowSchema = arrowSchema ?? hiveSchemaToArrowSchema(schema);
  }

  public async hasMore() {
    if (!this.arrowSchema) {
      return false;
    }
    return this.source.hasMore();
  }

  public async fetchNext(options: ResultsProviderFetchNextOptions) {
    if (!this.arrowSchema) {
      return {
        batches: [],
        rowCount: 0,
      };
    }

    const rowSet = await this.source.fetchNext(options);

    const batches: Array<Buffer> = [];
    let totalRowCount = 0;
    rowSet?.arrowBatches?.forEach(({ batch, rowCount }) => {
      if (batch) {
        batches.push(batch);
        totalRowCount += rowCount.toNumber(true);
      }
    });

    if (batches.length === 0) {
      return {
        batches: [],
        rowCount: 0,
      };
    }

    return {
      batches: [this.arrowSchema, ...batches],
      rowCount: totalRowCount,
    };
  }
}
