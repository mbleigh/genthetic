import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { Genthetic } from "../src/genthetic.js";
import { z } from "zod";

describe("TypeDefinition", () => {
  it("should allow calling .synthesize() directly", async () => {
    const genthetic = new Genthetic();

    const testType = genthetic.defineType({
      name: "TestType",
      schema: z.object({
        id: z.number(),
        name: z.string(),
      }),
      batchSize: 2,
    });

    // Add a simple fill stage for testing
    testType.fill({
      id: (_, ctx) => ctx.batchNumber * 2 + 1,
      name: "Test",
    } as any);

    // Test the new synthesize method on TypeDefinition
    const job = testType.synthesize({ count: 4 });
    const results = await job.complete();

    // Check results
    assert.equal(results.length, 4);
    assert.deepEqual(results[0], { id: 1, name: "Test" });
    assert.deepEqual(results[2], { id: 3, name: "Test" });
  });
  it("should pass through .synthesize() options correctly", async () => {
    const genthetic = new Genthetic();

    const testType = genthetic.defineType({
      name: "TestOptionsType",
      schema: z.object({
        id: z.number(),
      }),
      batchSize: 5, // default batch size
    });

    testType.fill({
      id: (_, ctx) => ctx.batchNumber + 1,
    } as any);

    // Override batch size with options
    const job = testType.synthesize({
      count: 3,
      batchSize: 1, // Should override the default of 5
    });

    const results = await job.complete();

    // Check results - with batchSize=1, we should get incrementing batch numbers
    assert.equal(results.length, 3);
    assert.deepEqual(results[0], { id: 1 });
    assert.deepEqual(results[1], { id: 2 });
    assert.deepEqual(results[2], { id: 3 });
  });
});
