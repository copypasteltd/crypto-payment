export interface PostgresQueryExecutor {
  query<TResult extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{
    rows: TResult[];
    rowCount: number | null;
  }>;
}

export interface PostgresRepositoryOptions {
  ensureReady?: () => Promise<void>;
  getQueryable: () => PostgresQueryExecutor;
}
