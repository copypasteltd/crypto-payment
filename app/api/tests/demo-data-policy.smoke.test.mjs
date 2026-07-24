import test from "node:test";
import assert from "node:assert/strict";

test("demo data requires an explicit opt-in", async () => {
  const previous = process.env.LINGBAN_ENABLE_DEMO_DATA;
  const { isDemoDataEnabled } = await import("../dist/app/demo-data.js");

  try {
    delete process.env.LINGBAN_ENABLE_DEMO_DATA;
    assert.equal(isDemoDataEnabled(), false);

    process.env.LINGBAN_ENABLE_DEMO_DATA = "0";
    assert.equal(isDemoDataEnabled(), false);

    process.env.LINGBAN_ENABLE_DEMO_DATA = "true";
    assert.equal(isDemoDataEnabled(), false);

    process.env.LINGBAN_ENABLE_DEMO_DATA = "1";
    assert.equal(isDemoDataEnabled(), true);
  } finally {
    if (previous === undefined) {
      delete process.env.LINGBAN_ENABLE_DEMO_DATA;
    } else {
      process.env.LINGBAN_ENABLE_DEMO_DATA = previous;
    }
  }
});
