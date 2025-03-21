/**
 * Throttler class that manages concurrency for asynchronous operations
 * with built-in retry logic using exponential backoff.
 */
export class Throttler {
  private queue: Array<{
    fn: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    retries: number;
  }> = [];

  private runningTasks = 0;

  /**
   * Create a new Throttler instance
   *
   * @param options Configuration options for the throttler
   */
  constructor(
    private options: {
      /**
       * Maximum number of concurrent tasks (default: 5)
       */
      concurrency?: number;

      /**
       * Maximum number of retries for failed tasks (default: 3)
       */
      maxRetries?: number;

      /**
       * Base delay for exponential backoff in milliseconds (default: 200)
       */
      baseRetryDelayMs?: number;

      /**
       * Enable debug logging (default: false)
       */
      debug?: boolean;
    } = {}
  ) {
    this.options.concurrency = options.concurrency ?? 5;
    this.options.maxRetries = options.maxRetries ?? 3;
    this.options.baseRetryDelayMs = options.baseRetryDelayMs ?? 200;
    this.options.debug = options.debug ?? false;
  }

  /**
   * Run a function through the throttler, queuing it if necessary based on
   * concurrency limits. Will retry failed operations with exponential backoff
   * up to maxRetries times.
   *
   * @param fn Function that returns a promise to execute
   * @returns Promise that resolves with the result of fn or rejects if max retries are exceeded
   */
  run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Add the task to the queue
      this.queue.push({
        fn,
        resolve,
        reject,
        retries: 0,
      });

      // Process the queue
      this.processQueue();
    });
  }

  /**
   * Process the queue of tasks, respecting concurrency limits
   */
  private processQueue(): void {
    // If no tasks are waiting, return
    if (this.queue.length === 0) {
      return;
    }

    // Check if we're at concurrency limit
    if (this.runningTasks >= (this.options.concurrency ?? 5)) {
      return;
    }

    // Get the next task
    const task = this.queue.shift();
    if (!task) {
      return;
    }

    // Increment counters
    this.runningTasks++;

    // Execute the task
    const executeTask = () => {
      task
        .fn()
        .then((result) => {
          // Decrement running tasks counter
          this.runningTasks--;

          // Resolve the promise with the result
          task.resolve(result);

          // Try to process more tasks
          setTimeout(() => this.processQueue(), 0);
        })
        .catch((error) => {
          // Decrement running tasks counter
          this.runningTasks--;

          // Check if we should retry
          if (task.retries < (this.options.maxRetries ?? 3)) {
            // Increment retry counter
            task.retries++;

            // Calculate exponential backoff delay
            // Formula: baseDelay * 2^(retryAttempt - 1)
            const backoffDelay =
              (this.options.baseRetryDelayMs ?? 200) * Math.pow(2, task.retries - 1);

            // Add some jitter (± 15%) to prevent thundering herd problems
            const jitter = 0.15;
            const minDelay = backoffDelay * (1 - jitter);
            const maxDelay = backoffDelay * (1 + jitter);
            const actualDelay = minDelay + Math.random() * (maxDelay - minDelay);

            // Debug logging is optional, but always log in the console during testing
            if (this.options.debug) {
              console.log(
                `Retrying task (attempt ${task.retries}/${
                  this.options.maxRetries ?? 3
                }) after ${Math.round(actualDelay)}ms:`,
                error
              );
            }

            // Schedule retry after backoff delay
            setTimeout(() => {
              // Add back to the front of the queue
              this.queue.unshift({
                ...task,
                retries: task.retries,
              });
              this.processQueue();
            }, actualDelay);
          } else {
            // Max retries exceeded, reject the promise
            task.reject(
              new Error(
                `Max retries (${this.options.maxRetries ?? 3}) exceeded: ${error.message || error}`
              )
            );

            // Try to process more tasks
            setTimeout(() => this.processQueue(), 0);
          }
        });
    };

    // Execute immediately
    executeTask();

    // Process additional tasks from the queue, but don't exceed concurrency limit
    const remainingSlots = (this.options.concurrency ?? 5) - this.runningTasks;

    // Only continue if we have more room for tasks and there are tasks waiting
    if (remainingSlots > 0 && this.queue.length > 0) {
      // Use setTimeout to avoid stack overflow with deep recursion
      setTimeout(() => this.processQueue(), 0);
    }
  }

  /**
   * Get the current queue length
   */
  get queueLength(): number {
    return this.queue.length;
  }

  /**
   * Get the number of currently running tasks
   */
  get activeTaskCount(): number {
    return this.runningTasks;
  }

  /**
   * Dispose of the throttler, clearing any internal state
   */
  dispose(): void {
    // Nothing to dispose without rate limiting timers
  }
}
