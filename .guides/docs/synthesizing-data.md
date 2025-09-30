---
title: Synthesizing Data
description: read this when you need to understand how to use genthetic types to generate synthetic data
---

## Synthesizing Data

Once you've defined your type, use `.synthesize()` to generate the data:

```typescript
MyType.synthesize({
  // Number of items to generate (alternative to batches)
  count: 100,

  // Number of batches to generate (alternative to count)
  batches: 10,

  // Size of each batch (overrides type's default)
  batchSize: 20,

  // Callback for tracking progress
  onProgress: (progress) => {
    console.log(`Batch ${progress.batchesComplete}/${progress.batchCount} completed`);
  },

  // Callback for accessing each completed batch
  onBatch: (batch, { batchNumber }) => {
    console.log(`Batch ${batchNumber} generated ${batch.length} items`);
  },

  // Control logging verbosity (none, warning, info, debug)
  logging: "info",

  // Write results to a file incrementally
  outFile: "generated-data.json",

  // Concurrency control
  concurrency: 3, // Maximum concurrent batches (default: 5)
  maxRetries: 5, // Maximum retries for failed operations (default: 3)
  retryDelayMs: 500, // Base delay for retry backoff (default: 200)
});

// Wait for completion and get results
const results = await complete();
```

### Synthesis Options

The `.synthesize()` method accepts these options:

| Option         | Type     | Description                                                 |
| -------------- | -------- | ----------------------------------------------------------- |
| `count`        | number   | Total number of items to generate                           |
| `batches`      | number   | Number of batches to generate (use either count or batches) |
| `batchSize`    | number   | Size of each generation batch                               |
| `onProgress`   | function | Callback for tracking overall progress                      |
| `onBatch`      | function | Callback for processing each completed batch                |
| `logging`      | string   | Log level: "none", "warning", "info", or "debug"            |
| `outFile`      | string   | Path to save results incrementally                          |
| `concurrency`  | number   | Maximum concurrent batch operations                         |
| `maxRetries`   | number   | Maximum retries for failed operations                       |
| `retryDelayMs` | number   | Base delay for retry backoff                                |

## Advanced Features

### Using Hints for AI Guidance

The special `__hints` property allows you to provide guidance to the AI without affecting the final output:

```typescript
MovieType.fill({
  genre: "Sci-Fi",
  __hints: {
    setting: "Distant future",
    inspiration: "Blade Runner and Dune",
    avoid: "Time travel tropes",
  },
});
```

Hints will guide AI generation but won't appear in the final data.

### Caching Stage Outputs

Enable `cacheOutput` for stages that should inform future generation:

```typescript
CharacterType.stage(
  (batch) => {
    // Process characters
    return batch;
  },
  { cacheOutput: true }
); // Enable caching
```

When `cacheOutput` is turned on in a stage (this is also true of `unique: true` for generated stages), batches will be processed serially and not in parallel.

### Handling Functions in Fill Shapes

Functions in `.fill()` receive:

- The current item being processed
- The stage context

```typescript
ProductType.fill({
  // Use the current item to derive values
  displayName: (item) => `${item.brand} ${item.model}`,

  // Use context for batch-aware logic
  featured: (_, context) => context.batchNumber === 0,
});
```
