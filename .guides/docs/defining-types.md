---
title: Defining Synthetic Types
description: read this when you need to define the schema / behavior of synthetic data generation types
---

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
