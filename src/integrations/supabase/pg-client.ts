/**
 * Self-hosted Supabase replacement: PostgreSQL query builder via node-postgres.
 *
 * Drop-in compatible with the `@supabase/supabase-js` query API:
 *
 *   const { data, error } = await supabase
 *     .from('my_table')
 *     .select('*')
 *     .eq('col', val)
 *     .single()
 *
 *   const { data, error } = await supabase
 *     .from('my_table')
 *     .insert({ col: 'val' })
 *     .select()
 *
 *   const { data, error } = await supabase.rpc('my_function', { param: 'val' })
 */
import pg from 'pg';

const { Pool } = pg as typeof pg & { Pool: typeof pg.Pool };

// ---------------------------------------------------------------------------
// Connection pool
// ---------------------------------------------------------------------------

export const pool = new Pool({
  host: process.env['PGHOST'] || 'localhost',
  port: Number(process.env['PGPORT'] || 5432),
  database: process.env['PGDATABASE'] || 'daddyai',
  user: process.env['PGUSER'] || 'daddyai',
  password: process.env['PGPASSWORD'] || '',
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  console.error('[PG] Unexpected error on idle client', err);
});

// ---------------------------------------------------------------------------
// Error helpers — matches Supabase's error shape
// ---------------------------------------------------------------------------

export interface PgError {
  message: string;
  code: string;
  details: string;
  hint: string;
}

function makeError(message: string, code = 'ERROR', details = '', hint = ''): PgError {
  return { message, code, details, hint };
}

function fromPgError(err: unknown): PgError {
  if (err && typeof err === 'object' && 'message' in err) {
    const e = err as { message?: string; code?: string; detail?: string; hint?: string };
    return {
      message: e.message ?? 'Unknown error',
      code: e.code ?? 'ERROR',
      details: e.detail ?? '',
      hint: e.hint ?? '',
    };
  }
  return makeError(String(err));
}

// ---------------------------------------------------------------------------
// Result shape — matches Supabase
// ---------------------------------------------------------------------------

export interface PgResult<T = unknown> {
  data: T;
  error: PgError | null;
}

// ---------------------------------------------------------------------------
// Internal: filter representation
// ---------------------------------------------------------------------------

interface FilterEntry {
  /** Raw column name (unquoted) */
  col: string;
  /** SQL operator */
  op: string;
  /** Parameter value(s) */
  val: unknown;
  /** Special marker for OR groups */
  isOr?: boolean;
}

// ---------------------------------------------------------------------------
// QueryBuilder
// ---------------------------------------------------------------------------

type QueryMode = 'select' | 'insert' | 'update' | 'upsert' | 'delete' | 'rpc';

export class QueryBuilder<TData = unknown> {
  private _table: string | null = null;
  private _mode: QueryMode = 'select';
  private _columns = '*';
  private _filters: FilterEntry[] = [];
  private _orGroups: FilterEntry[][] = [];
  private _order: { col: string; ascending: boolean }[] = [];
  private _limitN: number | null = null;
  private _offsetN: number | null = null;
  private _single = false;
  private _maybeSingle = false;
  private _body: unknown = null;
  private _rpcName: string | null = null;
  private _rpcParams: Record<string, unknown> | null = null;
  private _countMode: 'exact' | 'planned' | null = null;
  private _headOnly = false;

  // -- Table ----------------------------------------------------------------

  from(table: string): this {
    this._table = table;
    this._mode = 'select';
    return this;
  }

  // -- Mutating operations --------------------------------------------------

  select(columns = '*', opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): this {
    this._mode = 'select';
    this._columns = columns;
    if (opts?.count === 'exact') this._countMode = 'exact';
    if (opts?.head) this._headOnly = true;
    return this;
  }

  insert(body: unknown): this {
    this._mode = 'insert';
    this._body = body;
    return this;
  }

  update(body: unknown): this {
    this._mode = 'update';
    this._body = body;
    return this;
  }

  upsert(body: unknown): this {
    this._mode = 'upsert';
    this._body = body;
    return this;
  }

  delete(): this {
    this._mode = 'delete';
    return this;
  }

  // -- RPC ------------------------------------------------------------------

  rpc(name: string, params?: Record<string, unknown>): Promise<PgResult<TData>> {
    this._mode = 'rpc';
    this._rpcName = name;
    this._rpcParams = params ?? null;
    return this._execute();
  }

  // -- Filters --------------------------------------------------------------

  eq(col: string, val: unknown): this {
    this._filters.push({ col, op: '=', val });
    return this;
  }

  neq(col: string, val: unknown): this {
    this._filters.push({ col, op: '!=', val });
    return this;
  }

  gt(col: string, val: unknown): this {
    this._filters.push({ col, op: '>', val });
    return this;
  }

  gte(col: string, val: unknown): this {
    this._filters.push({ col, op: '>=', val });
    return this;
  }

  lt(col: string, val: unknown): this {
    this._filters.push({ col, op: '<', val });
    return this;
  }

  lte(col: string, val: unknown): this {
    this._filters.push({ col, op: '<=', val });
    return this;
  }

  like(col: string, val: string): this {
    this._filters.push({ col, op: 'LIKE', val });
    return this;
  }

  ilike(col: string, val: string): this {
    this._filters.push({ col, op: 'ILIKE', val });
    return this;
  }

  in_(col: string, vals: unknown[]): this {
    this._filters.push({ col, op: 'IN', val: vals });
    return this;
  }

  is(col: string, val: null): this {
    this._filters.push({ col, op: 'IS', val });
    return this;
  }

  not(col: string, op: string, val: unknown): this {
    this._filters.push({ col, op: `NOT ${op}`, val });
    return this;
  }

  /**
   * OR conditions.  Format: "col.op.val,col2.op2.val2"
   * Supported ops: eq, neq, gt, gte, lt, lte, like, ilike, in, is
   */
  or(conditions: string): this {
    const parts = conditions.split(',');
    const group: FilterEntry[] = [];
    for (const part of parts) {
      const trimmed = part.trim();
      const m = trimmed.match(
        /^(\w+)\.(eq|neq|gt|gte|lt|lte|like|ilike|in|is)\.(.+)$/,
      );
      if (m) {
        const col = m[1]!;
        const op = m[2]!;
        const rawVal = m[3]!;
        let val: unknown = rawVal;
        if (op === 'in') val = rawVal.split('|');
        else if (rawVal === 'null') val = null;
        else if (rawVal === 'true') val = true;
        else if (rawVal === 'false') val = false;
        else if (!Number.isNaN(Number(rawVal)) && rawVal !== '') val = Number(rawVal);
        group.push({ col, op, val });
      }
    }
    if (group.length > 0) this._orGroups.push(group);
    return this;
  }

  // -- Ordering / pagination ------------------------------------------------

  order(col: string, opts?: { ascending?: boolean }): this {
    this._order.push({ col, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(n: number): this {
    this._limitN = n;
    return this;
  }

  range(from: number, to: number): this {
    this._offsetN = from;
    this._limitN = to - from + 1;
    return this;
  }

  // -- Terminal shaping ------------------------------------------------------

  single(): Promise<PgResult<TData>> {
    this._single = true;
    return this._execute();
  }

  maybeSingle(): Promise<PgResult<TData>> {
    this._maybeSingle = true;
    return this._execute();
  }

  // -- Thenable so `await builder` works -------------------------------------

  then<TResult1 = PgResult<TData>, TResult2 = never>(
    onfulfilled?: ((value: PgResult<TData>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this._execute().then(onfulfilled, onrejected);
  }

  // -----------------------------------------------------------------------
  // Internal SQL construction
  // -----------------------------------------------------------------------

  /**
   * Build WHERE clause.  Returns { clause, params } where `clause` already
   * starts with " WHERE " (or is empty string if no filters).
   * All positional placeholders in `clause` are numbered starting at `startIdx`.
   */
  private _buildWhere(startIdx = 1): { clause: string; params: unknown[] } {
    const clauses: string[] = [];
    const params: unknown[] = [];
    let idx = startIdx;

    for (const f of this._filters) {
      switch (f.op) {
        case 'IS':
          clauses.push(`"${f.col}" IS NULL`);
          break;
        case 'IN': {
          const vals = f.val as unknown[];
          if (vals.length === 0) {
            clauses.push('FALSE');
          } else {
            const phs = vals.map(() => `$${idx++}`).join(', ');
            clauses.push(`"${f.col}" IN (${phs})`);
            params.push(...vals);
          }
          break;
        }
        default: {
          if (f.op.startsWith('NOT ')) {
            const inner = f.op.slice(5);
            clauses.push(`NOT ("${f.col}" ${inner} $${idx})`);
          } else {
            clauses.push(`"${f.col}" ${f.op} $${idx}`);
          }
          params.push(f.val);
          idx++;
          break;
        }
      }
    }

    for (const group of this._orGroups) {
      const orParts: string[] = [];
      for (const f of group) {
        switch (f.op) {
          case 'is':
            orParts.push(`"${f.col}" IS NULL`);
            break;
          case 'in': {
            const vals = f.val as unknown[];
            if (vals.length > 0) {
              const phs = vals.map(() => `$${idx++}`).join(', ');
              orParts.push(`"${f.col}" IN (${phs})`);
              params.push(...vals);
            } else {
              orParts.push('FALSE');
            }
            break;
          }
          default: {
            const sqlOp =
              f.op === 'eq' ? '=' :
              f.op === 'neq' ? '!=' :
              f.op === 'gt' ? '>' :
              f.op === 'gte' ? '>=' :
              f.op === 'lt' ? '<' :
              f.op === 'lte' ? '<=' :
              f.op.toUpperCase();
            orParts.push(`"${f.col}" ${sqlOp} $${idx}`);
            params.push(f.val);
            idx++;
            break;
          }
        }
      }
      if (orParts.length > 0) {
        clauses.push(`(${orParts.join(' OR ')})`);
      }
    }

    return {
      clause: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '',
      params,
    };
  }

  private _buildOrder(): string {
    if (this._order.length === 0) return '';
    return (
      ' ORDER BY ' +
      this._order.map((o) => `"${o.col}" ${o.ascending ? 'ASC' : 'DESC'}`).join(', ')
    );
  }

  private _buildLimitOffset(): string {
    let s = '';
    if (this._limitN !== null) s += ` LIMIT ${this._limitN}`;
    if (this._offsetN !== null) s += ` OFFSET ${this._offsetN}`;
    return s;
  }

  /** Shape rows array according to single/maybeSingle flags. */
  private _shapeResult(rows: unknown[], count?: number): PgResult<TData> {
    if (this._maybeSingle) {
      const data = rows.length > 0 ? (rows[0] as TData) : null;
      const result: PgResult<TData> = { data: data as TData, error: null };
      if (count !== undefined) (result as PgResult<TData> & { count: number }).count = count;
      return result;
    }
    if (this._single) {
      if (rows.length === 0) {
        return {
          data: null as TData,
          error: makeError('Row not found', 'PGRST116', 'The result contains 0 rows'),
        };
      }
      const result: PgResult<TData> = { data: rows[0] as TData, error: null };
      if (count !== undefined) (result as PgResult<TData> & { count: number }).count = count;
      return result;
    }
    // Default: return the full array
    const result: PgResult<TData> = { data: rows as TData, error: null };
    if (count !== undefined) (result as PgResult<TData> & { count: number }).count = count;
    return result;
  }

  // -----------------------------------------------------------------------
  // Execution paths
  // -----------------------------------------------------------------------

  private async _execute(): Promise<PgResult<TData>> {
    try {
      switch (this._mode) {
        case 'select':
          return await this._execSelect();
        case 'insert':
          return await this._execInsert();
        case 'update':
          return await this._execUpdate();
        case 'upsert':
          return await this._execUpsert();
        case 'delete':
          return await this._execDelete();
        case 'rpc':
          return await this._execRpc();
        default:
          return { data: null as TData, error: makeError('Unknown action', 'UNKNOWN') };
      }
    } catch (err) {
      return { data: null as TData, error: fromPgError(err) };
    }
  }

  // -- SELECT ---------------------------------------------------------------

  private async _execSelect(): Promise<PgResult<TData>> {
    const { clause: where, params: whereParams } = this._buildWhere();
    const order = this._buildOrder();
    const limitOffset = this._buildLimitOffset();
    const cols = this._columns || '*';

    // Head-only count query
    if (this._headOnly) {
      const countSql = `SELECT COUNT(*) AS count FROM "${this._table}"${where}`;
      const { rows } = await pool.query(countSql, whereParams);
      return {
        data: null as TData,
        error: null,
        count: parseInt(String(rows[0]?.['count'] ?? '0'), 10),
      } as PgResult<TData>;
    }

    const sql = `SELECT ${cols} FROM "${this._table}"${where}${order}${limitOffset}`;
    const { rows } = await pool.query(sql, whereParams);

    // Optional exact count
    let count: number | undefined;
    if (this._countMode === 'exact') {
      const countSql = `SELECT COUNT(*) AS count FROM "${this._table}"${where}`;
      const { rows: cr } = await pool.query(countSql, whereParams);
      count = parseInt(String(cr[0]?.['count'] ?? '0'), 10);
    }

    return this._shapeResult(rows as TData[], count);
  }

  // -- INSERT ---------------------------------------------------------------

  private async _execInsert(): Promise<PgResult<TData>> {
    const body = this._body;
    const items: Record<string, unknown>[] = Array.isArray(body) ? body : [body];
    if (items.length === 0) {
      return { data: [] as TData, error: null };
    }

    // Collect all distinct column names across all items.
    const colSet = new Set<string>();
    for (const item of items) {
      for (const k of Object.keys(item)) colSet.add(k);
    }
    const cols = Array.from(colSet);
    const colStr = cols.map((c) => `"${c}"`).join(', ');

    // Build a multi-row INSERT:  INSERT INTO t (c1, c2) VALUES ($1,$2), ($3,$4), ...
    const placeholders: string[] = [];
    const allVals: unknown[] = [];
    let idx = 1;
    for (const item of items) {
      const rowPlaceholders = cols.map((c) => {
        const v = item[c];
        allVals.push(v === undefined ? null : v);
        return `$${idx++}`;
      });
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
    }

    const sql = `INSERT INTO "${this._table}" (${colStr}) VALUES ${placeholders.join(', ')} RETURNING *`;
    const { rows } = await pool.query(sql, allVals);
    return this._shapeResult(rows as TData[]);
  }

  // -- UPDATE ---------------------------------------------------------------

  private async _execUpdate(): Promise<PgResult<TData>> {
    const body = this._body as Record<string, unknown>;
    const { clause: where, params: whereParams } = this._buildWhere();

    const setCols = Object.keys(body);
    const setVals = Object.values(body);

    // SET part uses $1..$N
    const setParts = setCols.map((c, i) => `"${c}" = $${i + 1}`);

    // WHERE placeholders need to be renumbered to start after SET params
    const offset = setCols.length;
    const renumberedWhere = where.replace(/\$(\d+)/g, (_, num) => `$${Number(num) + offset}`);

    const allParams = [...setVals, ...whereParams];
    const sql = `UPDATE "${this._table}" SET ${setParts.join(', ')}${renumberedWhere} RETURNING *`;
    const { rows } = await pool.query(sql, allParams);
    return this._shapeResult(rows as TData[]);
  }

  // -- UPSERT ---------------------------------------------------------------

  private async _execUpsert(): Promise<PgResult<TData>> {
    const body = this._body;
    const items: Record<string, unknown>[] = Array.isArray(body) ? body : [body];
    if (items.length === 0) {
      return { data: [] as TData, error: null };
    }

    const colSet = new Set<string>();
    for (const item of items) {
      for (const k of Object.keys(item)) colSet.add(k);
    }
    const cols = Array.from(colSet);
    const colStr = cols.map((c) => `"${c}"`).join(', ');

    // Build conflict target from columns that likely form the PK/unique.
    // Prefer 'id' if present; otherwise use all columns (safe for full-row upserts).
    const conflictCols = cols.includes('id') ? ['id'] : cols;
    const onConflict = `(${conflictCols.map((c) => `"${c}"`).join(', ')})`;

    // UPDATE SET all non-conflict columns
    const updateCols = cols.filter((c) => !conflictCols.includes(c));
    const updateSet =
      updateCols.length > 0
        ? updateCols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')
        : ' NOTHING'; // edge case: all columns are conflict columns

    const placeholders: string[] = [];
    const allVals: unknown[] = [];
    let idx = 1;
    for (const item of items) {
      const rowPlaceholders = cols.map((c) => {
        const v = item[c];
        allVals.push(v === undefined ? null : v);
        return `$${idx++}`;
      });
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
    }

    const doClause = updateCols.length > 0 ? `DO UPDATE SET ${updateSet}` : `DO ${updateSet}`;
    const sql = `INSERT INTO "${this._table}" (${colStr}) VALUES ${placeholders.join(', ')} ON CONFLICT ${onConflict} ${doClause} RETURNING *`;
    const { rows } = await pool.query(sql, allVals);
    return this._shapeResult(rows as TData[]);
  }

  // -- DELETE ---------------------------------------------------------------

  private async _execDelete(): Promise<PgResult<TData>> {
    const { clause: where, params } = this._buildWhere();
    const sql = `DELETE FROM "${this._table}"${where} RETURNING *`;
    const { rows } = await pool.query(sql, params);
    return this._shapeResult(rows as TData[]);
  }

  // -- RPC ------------------------------------------------------------------

  private async _execRpc(): Promise<PgResult<TData>> {
    const rpcParams = this._rpcParams ?? {};
    const keys = Object.keys(rpcParams);
    if (keys.length === 0) {
      const sql = `SELECT * FROM "${this._rpcName}"()`;
      const { rows } = await pool.query(sql);
      return this._shapeResult(rows as TData[]);
    }
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const values = keys.map((k) => rpcParams[k]);
    const sql = `SELECT * FROM "${this._rpcName}"(${placeholders})`;
    const { rows } = await pool.query(sql, values);
    return this._shapeResult(rows as TData[]);
  }
}

// ---------------------------------------------------------------------------
// Drop-in Supabase-compatible client
// ---------------------------------------------------------------------------

export interface SupabaseCompat {
  /** Start a query on a table: `supabase.from('my_table').select('*')` */
  from<TData = Record<string, unknown>>(table: string): QueryBuilder<TData>;
  /** Call a Postgres function: `supabase.rpc('my_fn', { arg: val })` */
  rpc<TData = unknown>(fn: string, params?: Record<string, unknown>): Promise<PgResult<TData>>;
}

export function createClient(): SupabaseCompat {
  return {
    from<TData = Record<string, unknown>>(table: string): QueryBuilder<TData> {
      return new QueryBuilder<TData>().from(table);
    },
    rpc<TData = unknown>(
      fn: string,
      params?: Record<string, unknown>,
    ): Promise<PgResult<TData>> {
      return new QueryBuilder<TData>().rpc(fn, params);
    },
  };
}
