import { describe, it } from "vitest";

describe("account API key", () => {
  it.skipIf(!process.env.DATABASE_URL)("placeholder — POST /api/account/create-key with session", () => {});
});
