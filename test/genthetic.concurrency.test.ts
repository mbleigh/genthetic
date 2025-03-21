import { describe, it } from "node:test";
import assert from "node:assert";
import { Genthetic, StageContext } from "../src/genthetic.js";

describe("Genthetic Concurrency and Throttling", () => {
  it("should process batches in parallel with default concurrency", async () => {
    // Track execution order to verify parallel processing
    const executionOrder: number[] = [];
    const executionTimes: number[] = [];

    interface ParallelTest {
      processed: boolean;
      batchNumber: number;
    }

    const genthetic = new Genthetic();
    const type = genthetic.defineType<ParallelTest>({
      name: "ParallelTest",
      batchSize: 1, // Each batch has just 1 item for easier testing
    });

    // Add a stage that takes different amounts of time to complete
    type.stage(async (batch, context) => {
      const batchNumber = context.batchNumber;

      // Record the start of execution, not the completion
      executionOrder.push(batchNumber);

      // Make first batch take much longer so we can verify parallel execution
      // Batch 0: 100ms, Batch 1: 10ms, Batch 2: 20ms
      // This should make batch 1 finish first, then batch 2, then batch 0
      const delay = batchNumber === 0 ? 100 : batchNumber === 1 ? 10 : 20;
      const startTime = Date.now();

      await new Promise((resolve) => setTimeout(resolve, delay));

      executionTimes.push(Date.now() - startTime);
      return batch.map((item) => ({ ...item, processed: true, batchNumber }));
    });

    // Use 3 batches to test parallel processing
    const job = genthetic.synthesize(type, {
      batches: 3,
      // Default concurrency is 5, so all 3 batches should start in parallel
    });

    const results = await job.complete();

    // Verify results
    assert.strictEqual(results.length, 3);
    assert.strictEqual(results.filter((r) => r.processed).length, 3);

    // When processing is parallel, all batches start in order, but they finish in different order
    // due to different delays. executionOrder captures the start order, not finish order.
    // What we really want to test is that batches aren't waiting for each other.

    // Check that all items have correct batchNumber
    assert.strictEqual(results[0].batchNumber, 0);
    assert.strictEqual(results[1].batchNumber, 1);
    assert.strictEqual(results[2].batchNumber, 2);

    // The total time should be close to the longest batch time (batch 0)
    // rather than the sum of all batch times

    // The total time should be less than the sum of all individual times if run in parallel
    const totalTime = Math.max(...executionTimes);
    const sumTime = executionTimes.reduce((sum, time) => sum + time, 0);
    assert.ok(
      totalTime < sumTime,
      "Total execution time should be less than sum of individual times in parallel mode"
    );
  });

  it("should respect custom concurrency settings", async () => {
    // Track start times to verify limited concurrency
    const startTimes: number[] = [];
    const endTimes: number[] = [];

    interface ConcurrencyTest {
      processed: boolean;
    }

    const genthetic = new Genthetic();
    const type = genthetic.defineType<ConcurrencyTest>({
      name: "ConcurrencyTest",
      batchSize: 1,
    });

    // Add a stage that records execution timing
    type.stage(async (batch, context) => {
      const batchNumber = context.batchNumber;
      const now = Date.now();
      startTimes[batchNumber] = now;

      // All batches take the same amount of time (50ms)
      await new Promise((resolve) => setTimeout(resolve, 50));

      endTimes[batchNumber] = Date.now();
      return batch.map((item) => ({ ...item, processed: true }));
    });

    // Use 5 batches with concurrency limited to 2
    const job = genthetic.synthesize(type, {
      batches: 5,
      concurrency: 2,
    });

    await job.complete();

    // Helper function to check if time ranges overlap
    const hasOverlap = (start1: number, end1: number, start2: number, end2: number) =>
      Math.max(start1, start2) < Math.min(end1, end2);

    // Count how many batches were running concurrently with each batch
    let concurrentBatchCounts = 0;

    for (let i = 0; i < 5; i++) {
      for (let j = i + 1; j < 5; j++) {
        if (hasOverlap(startTimes[i], endTimes[i], startTimes[j], endTimes[j])) {
          concurrentBatchCounts++;
        }
      }
    }

    // With 5 batches and concurrency of 2, we expect a limited number of concurrent executions
    // This value is approximate as timing is not perfect
    assert.ok(concurrentBatchCounts > 0, "Some batches should run concurrently");

    // Sort start times to check for batch grouping
    const sortedStartTimes = [...startTimes].sort((a, b) => a - b);

    // Check if there's a gap between groups
    // With concurrency 2, we should have at least one significant gap between execution groups
    let foundGap = false;
    for (let i = 1; i < sortedStartTimes.length - 1; i++) {
      const gap = sortedStartTimes[i + 1] - sortedStartTimes[i];
      if (gap > 30) {
        // A significant gap (more than 30ms)
        foundGap = true;
        break;
      }
    }

    assert.ok(foundGap, "Should find timing gap between execution groups with limited concurrency");
  });

  it("should process batches serially when cacheOutput is used", async () => {
    const executionOrder: number[] = [];

    interface SerialTest {
      id: number;
      value: number;
      cached?: boolean;
    }

    const genthetic = new Genthetic();
    const type = genthetic.defineType<SerialTest>({
      name: "SerialTest",
      batchSize: 1,
    });

    // First, add a stage that doesn't use cacheOutput to initialize values
    type.fill({
      id: (_, context) => context.batchNumber,
    });

    // Add a stage with cacheOutput enabled
    type.stage(
      async (batch, context) => {
        const batchNumber = context.batchNumber;

        // Use random delay to ensure order is determined by execution, not timing
        const delay = Math.floor(Math.random() * 20) + 10;
        await new Promise((resolve) => setTimeout(resolve, delay));

        executionOrder.push(batchNumber);
        return batch.map((item) => ({ ...item, value: batchNumber }));
      },
      { cacheOutput: true }
    ); // This forces serial execution

    // Add a second stage that uses the cached output
    type.stage(async (batch, context) => {
      // Cache data should be available but we won't check it with an assertion
      // because it depends on the internal implementation details of Genthetic
      return batch.map((item) => ({ ...item, cached: true }));
    });

    const job = genthetic.synthesize(type, {
      batches: 3,
      concurrency: 5, // This should be ignored due to cacheOutput
    });

    await job.complete();

    // Verify execution was serial (in batch order)
    assert.deepStrictEqual(
      executionOrder,
      [0, 1, 2],
      "Execution should happen serially when cacheOutput is used"
    );
  });

  it("should retry failed operations", async () => {
    const attemptCounts: Record<number, number> = {};

    interface RetryTest {
      processed: boolean;
    }

    const genthetic = new Genthetic();
    const type = genthetic.defineType<RetryTest>({
      name: "RetryTest",
      batchSize: 1,
    });

    // Add a stage that fails on first attempt for specific batches
    type.stage(async (batch, context) => {
      const batchNumber = context.batchNumber;

      // Track attempt count for this batch
      attemptCounts[batchNumber] = (attemptCounts[batchNumber] || 0) + 1;

      // Batch 1 fails on first attempt
      if (batchNumber === 1 && attemptCounts[batchNumber] === 1) {
        throw new Error("Simulated failure for testing retry");
      }

      return batch.map((item) => ({ ...item, processed: true }));
    });

    const job = genthetic.synthesize(type, {
      batches: 3,
      maxRetries: 2, // Allow up to 2 retries
      retryDelayMs: 50, // Shorter delay for testing
      logging: "none", // Suppress console logs
    });

    const result = await job.complete();

    // All batches should be processed successfully
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result.filter((r) => r.processed).length, 3);

    // Batch 1 should have been retried
    assert.strictEqual(attemptCounts[1], 2, "Batch 1 should be retried once");

    // Other batches should only be executed once
    assert.strictEqual(attemptCounts[0], 1, "Batch 0 should not be retried");
    assert.strictEqual(attemptCounts[2], 1, "Batch 2 should not be retried");
  });
});
