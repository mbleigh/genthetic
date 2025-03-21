import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { setTimeout as sleep } from "node:timers/promises";
import { Throttler } from "../throttler.js";

describe("Throttler", () => {
  let throttler: Throttler;

  beforeEach(() => {
    // Create a fresh throttler for each test
    throttler = new Throttler();
  });

  afterEach(() => {
    // Clean up any timers
    throttler.dispose();
  });

  it("should execute tasks with default concurrency", async () => {
    const results: number[] = [];
    const executionOrder: number[] = [];

    // Create 10 tasks with minimal sleep time
    const promises = Array.from({ length: 10 }, (_, i) => {
      return throttler.run(async () => {
        executionOrder.push(i);
        await sleep(5); // Very minimal sleep time
        results.push(i);
        return i;
      });
    });

    // Wait for all tasks to complete
    const values = await Promise.all(promises);

    // With 5 concurrent tasks, we expect to see two batches in the execution order
    // First 5 tasks should start before the rest
    const firstBatch = executionOrder.slice(0, 5);
    const secondBatch = executionOrder.slice(5);

    // Every item in secondBatch should be greater than at least one item in firstBatch
    // (this checks that second batch started after at least some of first batch)
    assert.ok(
      secondBatch.every((val) => firstBatch.some((first) => first < val)),
      "Second batch should start after some of first batch"
    );

    // Ensure all tasks completed with the correct values
    assert.deepStrictEqual(values, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.strictEqual(results.length, 10);
  });

  it("should retry failed tasks with exponential backoff", async () => {
    let attempts = 0;
    const retryDelays: number[] = [];

    // Override setTimeout to track retry delay times without actually waiting
    const originalSetTimeout = global.setTimeout;

    try {
      global.setTimeout = ((callback: Function, delay: number, ...args: any[]) => {
        // Only track delays that look like retry backoffs (greater than 80ms)
        // This will capture our retry backoffs scheduled after failures
        if (delay > 80) {
          retryDelays.push(delay);
        }
        // Call the callback immediately to speed up test
        return originalSetTimeout(callback, 0, ...args) as any;
      }) as typeof setTimeout;

      // This function will fail the first 2 times, then succeed
      const flakeyFn = async () => {
        attempts++;
        if (attempts <= 2) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return "success";
      };

      // Create a throttler with a specific base delay to make testing easier
      // Turn on debug mode to get more visibility in test output
      const backoffThrottler = new Throttler({
        baseRetryDelayMs: 100,
        debug: true,
      });

      const result = await backoffThrottler.run(flakeyFn);

      // Verify retry count and result
      assert.strictEqual(attempts, 3, "Function should be attempted 3 times");
      assert.strictEqual(result, "success", "Function should eventually succeed");

      // Verify that delays use exponential backoff pattern
      assert.strictEqual(retryDelays.length, 2, "Should have captured 2 retry delays");

      // First retry should be around baseDelay (100ms ± jitter)
      assert.ok(
        retryDelays[0] >= 85 && retryDelays[0] <= 115,
        `First retry delay (${retryDelays[0]}ms) should be close to 100ms`
      );

      // Second retry should be around 2*baseDelay (200ms ± jitter)
      assert.ok(
        retryDelays[1] >= 170 && retryDelays[1] <= 230,
        `Second retry delay (${retryDelays[1]}ms) should be close to 200ms`
      );

      // Second delay should be larger than first (exponential growth)
      assert.ok(
        retryDelays[1] > retryDelays[0],
        "Successive retry delays should increase (exponential backoff)"
      );
    } finally {
      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
    }
  });

  it("should reject after maxRetries failures", async () => {
    let attempts = 0;

    // This function will always fail
    const failingFn = async () => {
      attempts++;
      throw new Error(`Always fails - attempt ${attempts}`);
    };

    try {
      await throttler.run(failingFn);
      assert.fail("Should have thrown an error");
    } catch (error) {
      assert.strictEqual(
        attempts,
        4,
        "Function should be attempted 4 times (original + 3 retries)"
      );
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes("Max retries (3) exceeded"));
    }
  });

  it("should respect custom concurrency limits", async () => {
    const customThrottler = new Throttler({ concurrency: 2 });
    const executionTracker: { running: number; max: number } = { running: 0, max: 0 };

    try {
      // Create 6 tasks that track concurrency directly
      const promises = Array.from({ length: 6 }, (_, i) => {
        return customThrottler.run(async () => {
          // Increment the counter of running tasks
          executionTracker.running++;

          // Keep track of the maximum number of concurrent executions
          executionTracker.max = Math.max(executionTracker.max, executionTracker.running);

          // Minimal sleep to allow task switching
          await sleep(5);

          // Decrement the counter when done
          executionTracker.running--;

          return i;
        });
      });

      // Wait for all tasks to complete
      await Promise.all(promises);

      // The maximum concurrent tasks should match our concurrency limit
      assert.strictEqual(executionTracker.max, 2, "Maximum concurrency should be respected");
    } finally {
      customThrottler.dispose();
    }
  });

  it("should provide queue and active task information", async () => {
    const testThrottler = new Throttler({ concurrency: 2 });
    const tasks: Promise<void>[] = [];
    const taskCompletionFlags: boolean[] = Array(5).fill(false);
    const allTasksStarted = new Promise<void>((resolveStarted) => {
      // We'll signal when all tasks have been submitted
      setTimeout(resolveStarted, 5);
    });

    try {
      // Add 5 tasks that will complete only when we signal them to
      for (let i = 0; i < 5; i++) {
        const taskPromise = testThrottler.run(async () => {
          // Wait until explicitly marked as complete
          while (!taskCompletionFlags[i]) {
            await sleep(1);
          }
        });
        tasks.push(taskPromise);
      }

      // Wait for all tasks to be submitted to the queue
      await allTasksStarted;

      // At this point, 2 tasks should be running and 3 should be queued
      assert.strictEqual(testThrottler.activeTaskCount, 2, "Should have 2 active tasks");
      assert.strictEqual(testThrottler.queueLength, 3, "Should have 3 tasks in queue");

      // Now complete all tasks
      taskCompletionFlags.fill(true);

      // Wait for all tasks to complete
      await Promise.all(tasks);

      // Verify that everything is done
      assert.strictEqual(
        testThrottler.activeTaskCount,
        0,
        "Should have 0 active tasks after completion"
      );
      assert.strictEqual(
        testThrottler.queueLength,
        0,
        "Should have 0 tasks in queue after completion"
      );
    } finally {
      // Signal completion to avoid hanging tests
      taskCompletionFlags.fill(true);
      testThrottler.dispose();
    }
  });
});
