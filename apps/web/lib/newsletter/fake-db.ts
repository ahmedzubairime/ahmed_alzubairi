/**
 * Test helper: `newsletter_subscribers` in memory, answering the calls the
 * newsletter code makes. `insert` refuses a repeated email the way the unique
 * index does. `fail` makes every call answer with that error.
 */

export type SubscriberRow = {
  email: string;
  status: string;
  confirm_token_hash: string | null;
  locale: string;
  source: string;
  consented_at: string | null;
};

type DbError = { code: string; message: string };
type Test = (row: SubscriberRow) => boolean;

export function fakeNewsletterDb(rows: SubscriberRow[], state: { fail?: DbError } = {}) {
  const chain = (patch: Partial<SubscriberRow>, tests: Test[] = []) => {
    const run = () => {
      if (state.fail) return { data: null, error: state.fail };
      const matching = rows.filter((row) => tests.every((test) => test(row)));
      for (const row of matching) Object.assign(row, patch);
      return { data: matching.map((row) => ({ ...row })), error: null };
    };
    return {
      eq: (column: keyof SubscriberRow, value: unknown) =>
        chain(patch, [...tests, (row) => row[column] === value]),
      neq: (column: keyof SubscriberRow, value: unknown) =>
        chain(patch, [...tests, (row) => row[column] !== value]),
      select: () => chain(patch, tests),
      then: (resolve: (value: ReturnType<typeof run>) => void) => resolve(run()),
    };
  };

  return {
    from(table: string) {
      if (table !== "newsletter_subscribers") throw new Error(`unexpected table ${table}`);
      return {
        insert: async (added: SubscriberRow[]) => {
          if (state.fail) return { error: state.fail };
          if (added.some((row) => rows.some((old) => old.email === row.email))) {
            return { error: { code: "23505", message: "duplicate key" } };
          }
          rows.push(...added.map((row) => ({ ...row })));
          return { error: null };
        },
        update: (patch: Partial<SubscriberRow>) => chain(patch),
      };
    },
  };
}
