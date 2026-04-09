import { describe, it } from "vitest";

describe("reserve concurrency (integration)", () => {
  it.skipIf(!process.env.DATABASE_URL)(
    "placeholder — run with DATABASE_URL + migrated schema for 20 parallel reserves at cap-1",
    () => {},
  );
});
