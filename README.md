# Genthetic

Generate realistic synthetic data using a combination of Google's Gemini AI models and customizable data pipelines. Genthetic enables you to create high-quality synthetic datasets with control and flexibility.

- **Schema-based typing** - Define your data structure using Zod schemas
- **AI-powered generation** - Leverage Google's Gemini models to create realistic, contextually-aware data
- **Customizable pipelines** - Create multi-stage data generation processes with fine-grained control
- **Concurrency handling** - Generate large datasets efficiently with built-in throttling and batch processing
- **Progress tracking** - Monitor generation progress with detailed updates

## Installation

Install Genthetic using your preferred package manager:

```bash
# Faker.js is a recommended companion to Genthetic
npm install genthetic zod @faker-js/faker
# Genthetic requires a Gemini API key to function
export GEMINI_API_KEY=<your_api_key_here>
```

## Basic Usage

Here's a simple example of creating a list of synthetic contacts:

```typescript
import { z } from "zod";
import { Genthetic } from "genthetic";

// Initialize Genthetic
const g = new Genthetic();

// Define the data schema using Zod
const PersonSchema = z.object({
  name: z.string(),
  email: z.string(),
  age: z.number(),
  occupation: z.string(),
  location: z.string(),
  favoriteColor: z.string(),
});

// Create a type definition with AI generation
const PersonSynth = g
  .defineType({
    name: "Person",
    schema: PersonSchema,
  })
  .generate({
    // add already-generated data to context to avoid duplicates
    unique: true,
    // supply custom instructions for the LLM
    instructions: "use characters from Arrested Development",
  });

// Synthesize 20 people in batches of 5
const { complete } = PersonSynth.synthesize(PersonSynth, {
  batchSize: 5,
  count: 20,
  onBatch: (batch) => console.log("🙎 Generated:", batch.map((item) => item.name).join(", ")),
  logging: "debug",
});

// Wait for the generation to complete and get the results
const people = await complete();
console.dir(people, { depth: null });
```

## Defining Synthesis Types

The type definition process is the core of Genthetic's functionality, allowing you to define:

- The structure of your data (using Zod schemas)
- Initial values or hints (using `.fill()`)
- AI-based generation parameters (using `.generate()`)
- Custom processing stages (using `.stage()`)

### Creating a Type Definition

```typescript
const MyType = g.defineType({
  name: "MyTypeName",      // Name for the type (used in logging)
  schema: MyZodSchema,     // Zod schema defining the structure
  jsonSchema: {...},       // Optional: Explicit JSON schema (alternative to Zod)
  batchSize: 10,           // Optional: Default batch size for this type
});
```

### Using .fill() for Initial Data and Hints

The `.fill()` method populates objects with values or adds hints for AI generation:

```typescript
// Basic usage
MyType.fill({
  id: () => crypto.randomUUID(),
  status: "active",
  createdAt: () => new Date().toISOString(),
});

// Named fill stage
MyType.fill("Add timestamps", {
  createdAt: () => new Date().toISOString(),
  updatedAt: () => new Date().toISOString(),
});
```

#### Integration with Faker.js

Faker.js integration provides powerful data generation capabilities:

```typescript
import { faker } from "@faker-js/faker";

// Simple Faker usage
UserType.fill({
  firstName: () => faker.person.firstName(),
  lastName: () => faker.person.lastName(),
  avatar: () => faker.image.avatar(),
  email: () => faker.internet.email(),
  address: {
    street: () => faker.location.streetAddress(),
    city: () => faker.location.city(),
    state: () => faker.location.state(),
    zip: () => faker.location.zipCode(),
  },
});

// Advanced Faker patterns
ProductType.fill({
  // Create consistent data using Faker's seeded randomness
  price: () => faker.commerce.price({ min: 10, max: 1000 }),

  // Use weighted random values for realistic distributions
  category: () =>
    faker.helpers.weightedArrayElement([
      { weight: 3, value: "Electronics" },
      { weight: 2, value: "Clothing" },
      { weight: 1, value: "Home & Garden" },
    ]),

  // Generate arrays with random lengths
  tags: () =>
    Array.from(
      {
        length: faker.number.int({ min: 1, max: 5 }),
      },
      () => faker.commerce.productAdjective()
    ),

  // Use context to access batch and type information
  inStock: (_, context) => context.batchNumber % 2 === 0,
});

// Using hints to guide AI generation
MovieType.fill({
  __hints: {
    era: () => faker.helpers.arrayElement(["80s", "90s", "2000s", "2010s"]),
    tone: () => faker.helpers.arrayElement(["dark", "light", "comedic", "dramatic"]),
    budget: () => faker.helpers.arrayElement(["low", "medium", "high", "blockbuster"]),
  },
});
```

### Using .generate() for AI-powered Generation

The `.generate()` method configures AI-based data generation:

```typescript
MyType.generate({
  fields: ["title", "description"], // Optional: specific fields to generate
  instructions: "Create sci-fi movie plots with dystopian themes", // Optional: guidance for the AI
  model: "gemini-2.0-flash", // Optional: specific Gemini model to use, defaults to gemini-2.0-flash
  unique: true, // Optional: ensure generated items are unique
});
```

The `generate` method leverages Google's Gemini models to create realistic, contextually-aware data based on:

- The defined schema
- Any seed data or hints provided through `.fill()`
- The instructions and parameters specified

### Using .stage() for Custom Processing

The `.stage()` method adds custom processing stages:

```typescript
// Basic stage
MyType.stage((batch, context) => {
  return batch.map((item) => ({
    ...item,
    fullName: `${item.firstName} ${item.lastName}`,
  }));
});

// Named stage
MyType.stage(
  "Create slugs",
  (batch, context) => {
    return batch.map((item) => ({
      ...item,
      slug: item.title.toLowerCase().replace(/\s+/g, "-"),
    }));
  },
  { cacheOutput: true }
); // Optional: cache this stage's output for reuse
```

Each stage receives:

- The current batch of items
- A context object with batch information and access to the type definition

Stages can be used for:

- Data transformation
- Validation
- Enrichment
- Cross-item operations

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
