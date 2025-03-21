import { Throttler } from "../src/throttler.js";
import { setTimeout as sleep } from "node:timers/promises";

/**
 * This example demonstrates how to use the Throttler class to manage
 * concurrent operations and retry logic with exponential backoff.
 */
async function main() {
  console.log("Throttler Examples");
  console.log("=================");

  // Example 1: Basic concurrency limiting
  await basicConcurrencyExample();

  // Example 2: Retry logic with exponential backoff
  await retryExample();
}

/**
 * Example 1: Basic concurrency limiting
 * This demonstrates how the throttler executes tasks with limited concurrency
 */
async function basicConcurrencyExample() {
  console.log("\n--- Basic Concurrency Example ---");

  // Create a throttler with concurrency of 2
  const throttler = new Throttler({ concurrency: 2 });
  console.log("Created throttler with concurrency of 2");

  try {
    const startTime = Date.now();

    // Create 6 tasks that each take 500ms to complete
    const tasks = Array.from({ length: 6 }, (_, i) => {
      return throttler.run(async () => {
        console.log(`Task ${i + 1} started at ${Date.now() - startTime}ms`);
        await sleep(500); // Simulate work
        console.log(`Task ${i + 1} completed at ${Date.now() - startTime}ms`);
        return i;
      });
    });

    console.log("Submitted 6 tasks to the throttler");

    // Wait for all tasks to complete
    const results = await Promise.all(tasks);

    console.log(`All tasks completed in ${Date.now() - startTime}ms`);
    console.log("Results:", results);

    // With concurrency of 2, we expect 3 "waves" of execution
    // So the time should be around 3 * 500ms = 1500ms
  } finally {
    throttler.dispose();
  }
}

/**
 * Example 2: Retry logic with exponential backoff
 * This demonstrates how the throttler automatically retries failed operations
 */
async function retryExample() {
  console.log("\n--- Retry Logic Example ---");

  // Create a throttler with 2 max retries and a 200ms base delay
  const throttler = new Throttler({
    maxRetries: 2,
    baseRetryDelayMs: 200,
  });

  console.log("Created throttler with maxRetries of 2 and 200ms base retry delay");

  try {
    // First create a function that will fail the first 2 times, then succeed
    let attempts = 0;
    const flakeyFunction = async () => {
      attempts++;
      console.log(`Attempt ${attempts} of flakeyFunction`);

      if (attempts <= 2) {
        // First two attempts fail
        console.log(`Attempt ${attempts} failing intentionally`);
        throw new Error(`Intentional failure on attempt ${attempts}`);
      }

      // Third attempt succeeds
      console.log(`Attempt ${attempts} succeeding`);
      return "Success after retries";
    };

    console.log("Running a function that fails twice then succeeds");
    console.log("Notice the exponential backoff between retry attempts:");

    // The throttler should retry automatically with exponential backoff
    const result = await throttler.run(flakeyFunction);
    console.log(`Final result: ${result}`);
    console.log(`Total attempts: ${attempts}`);

    // Reset attempts counter
    attempts = 0;

    // Now run a function that always fails
    const alwaysFailsFunction = async () => {
      attempts++;
      console.log(`Attempt ${attempts} of alwaysFailsFunction (always fails)`);
      throw new Error(`Always fails on attempt ${attempts}`);
    };

    console.log("\nRunning a function that always fails (should give up after maxRetries)");

    try {
      await throttler.run(alwaysFailsFunction);
      console.log("This line should not be reached");
    } catch (error) {
      console.log(`Caught expected error: ${error.message}`);
      console.log(`Total attempts before giving up: ${attempts}`);
    }
  } finally {
    throttler.dispose();
  }
}

// Run the examples
main().catch(console.error);
