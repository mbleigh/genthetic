import { describe, it } from "node:test";
import assert from "node:assert";
import { Genthetic } from "../src/genthetic.js";
import { z } from "zod";

describe("Genthetic", () => {
  it("should create a simple type definition", () => {
    const genthetic = new Genthetic();
    const type = genthetic.defineType({
      name: "Person",
      schema: z.object({
        name: z.string(),
        age: z.number(),
      }),
    });

    assert.strictEqual(type.name, "Person");
    assert.ok(type.jsonSchema);
  });

  it("should fill objects with static values", async () => {
    interface Person {
      name: string;
      age: number;
    }

    const genthetic = new Genthetic();
    const type = genthetic.defineType<Person>({
      name: "Person",
      schema: z.object({
        name: z.string(),
        age: z.number(),
      }),
    });

    type.fill({
      name: "John Doe",
      age: 30,
    });

    const job = genthetic.synthesize(type, { count: 5 });
    const result = await job.complete();

    assert.strictEqual(result.length, 5);
    assert.strictEqual(result[0].name, "John Doe");
    assert.strictEqual(result[0].age, 30);
  });

  it("should fill objects with function values", async () => {
    interface Counter {
      id: number;
      timestamp: string;
    }

    const genthetic = new Genthetic();
    const type = genthetic.defineType<Counter>({
      name: "Counter",
    });

    let counter = 0;
    type.fill({
      id: () => ++counter,
      timestamp: () => new Date().toISOString(),
    });

    const job = genthetic.synthesize(type, { count: 3 });
    const result = await job.complete();

    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].id, 1);
    assert.strictEqual(result[1].id, 2);
    assert.strictEqual(result[2].id, 3);
    assert.ok(result[0].timestamp); // Should be an ISO string
  });

  it("should handle multiple stages", async () => {
    interface ProcessedData {
      value: number;
      doubled: number;
      squared: number;
    }

    const genthetic = new Genthetic();
    const type = genthetic.defineType<ProcessedData>({
      name: "ProcessedData",
    });

    // First stage: Add basic data
    type.fill({
      value: 10,
    });

    // Second stage: Transform the data
    type.stage((batch) => {
      return batch.map((item) => ({
        ...item,
        doubled: (item.value ?? 0) * 2,
      }));
    });

    // Third stage: Add more derived data
    type.stage((batch) => {
      return batch.map((item) => ({
        ...item,
        squared: Math.pow(item.value ?? 0, 2),
      }));
    });

    const job = genthetic.synthesize(type, { count: 2 });
    const result = await job.complete();

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].value, 10);
    assert.strictEqual(result[0].doubled, 20);
    assert.strictEqual(result[0].squared, 100);
  });

  it("should track progress during synthesis", async () => {
    interface SlowData {
      processed: boolean;
      finalized: boolean;
    }

    const genthetic = new Genthetic();
    const type = genthetic.defineType<SlowData>({
      name: "SlowData",
      batchSize: 2,
    });

    // Add a slow processing stage
    type.stage(async (batch) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return batch.map((item) => ({
        ...item,
        processed: true,
      }));
    });

    // Add another stage
    type.stage(async (batch) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return batch.map((item) => ({
        ...item,
        finalized: true,
      }));
    });

    const progressEvents: any[] = [];
    const job = genthetic.synthesize(type, {
      batches: 2,
      onProgress: (progress) => {
        progressEvents.push({ ...progress });
      },
    });

    const result = await job.complete();

    assert.strictEqual(result.length, 4); // 2 batches of 2 items each
    assert.ok(result[0].processed);
    assert.ok(result[0].finalized);

    // Should have received multiple progress events
    assert.ok(progressEvents.length > 0);

    // Final event should show completion
    const finalEvent = progressEvents[progressEvents.length - 1];
    assert.strictEqual(finalEvent.batchesComplete, 2);
    assert.strictEqual(finalEvent.batchCount, 2);
  });
});
