import assert from "node:assert";
import { resolveObject } from "../src/genthetic.js";
import { describe, it } from "node:test";

describe("resolveObject", () => {
  it("should handle primitive values", async () => {
    // Test with various primitive types
    assert.strictEqual(await resolveObject("string"), "string");
    assert.strictEqual(await resolveObject(123), 123);
    assert.strictEqual(await resolveObject(true), true);
    assert.strictEqual(await resolveObject(null), null);
    assert.strictEqual(await resolveObject(undefined), undefined);
  });

  it("should resolve functions in objects", async () => {
    const obj = {
      a: () => "resolved a",
      b: "static b",
    };

    const result = await resolveObject(obj);
    assert.deepStrictEqual(result, {
      a: "resolved a",
      b: "static b",
    });
  });

  it("should resolve nested objects with functions", async () => {
    const obj = {
      a: {
        b: () => "resolved b",
        c: {
          d: () => "resolved d",
        },
      },
      e: "static e",
    };

    const result = await resolveObject(obj);
    assert.deepStrictEqual(result, {
      a: {
        b: "resolved b",
        c: {
          d: "resolved d",
        },
      },
      e: "static e",
    });
  });

  it("should resolve functions in arrays", async () => {
    const obj = {
      arr: [() => "item 1", "static item", () => "item 3"],
    };

    const result = await resolveObject(obj);
    assert.deepStrictEqual(result, {
      arr: ["item 1", "static item", "item 3"],
    });
  });

  it("should resolve nested arrays with functions", async () => {
    const obj = {
      arr: [[() => "nested 1"], [() => "nested 2", "static nested"]],
    };

    const result = await resolveObject(obj);
    assert.deepStrictEqual(result, {
      arr: [["nested 1"], ["nested 2", "static nested"]],
    });
  });

  it("should pass item and context to functions", async () => {
    const item = { id: 1, name: "test" };
    const context = { count: 10 };

    const obj = {
      a: (i: any, c: any) => `id: ${i.id}, count: ${c.count}`,
      b: (i: any) => i.name.toUpperCase(),
    };

    const result = await resolveObject(obj, item, context);
    assert.deepStrictEqual(result, {
      a: "id: 1, count: 10",
      b: "TEST",
    });
  });

  it("should handle async functions", async () => {
    const obj = {
      a: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "async result";
      },
      b: "static b",
    };

    const result = await resolveObject(obj);
    assert.deepStrictEqual(result, {
      a: "async result",
      b: "static b",
    });
  });

  it("should handle mixed sync and async functions", async () => {
    const obj = {
      sync: () => "sync result",
      async: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "async result";
      },
      nested: {
        syncNested: () => "sync nested",
        asyncNested: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "async nested";
        },
      },
    };

    const result = await resolveObject(obj);
    assert.deepStrictEqual(result, {
      sync: "sync result",
      async: "async result",
      nested: {
        syncNested: "sync nested",
        asyncNested: "async nested",
      },
    });
  });

  it("should handle array functions that return arrays", async () => {
    const obj = {
      arr: [() => [1, 2, 3], "static item"],
    };

    const result = await resolveObject(obj);
    assert.deepStrictEqual(result, {
      arr: [[1, 2, 3], "static item"],
    });
  });
});
