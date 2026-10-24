/** Narrow synchronous SQLite surface used at typed JavaScript/TypeScript boundaries. */
export interface SqliteStatement {
  get(...parameters: unknown[]): any;
  all(...parameters: unknown[]): any[];
  run(...parameters: unknown[]): { changes: number; lastInsertRowid: number | bigint };
}

export interface SqliteDatabase {
  prepare(sql: string): SqliteStatement;
  transaction<Result>(callback: () => Result): () => Result;
}
