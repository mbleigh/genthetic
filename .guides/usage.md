Genthetic uses LLMs to generate synthetic data from user-defined schemas. To use Genthetic, the user must have `GEMINI_API_KEY` env variable set to use the library. You can also set the `GEMINI_MODEL` to control which model is used (defaults to `gemini-2.5-flash`).

Basic Example:

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
const { complete } = PersonSynth.synthesize({
  batchSize: 5,
  count: 20,
  onBatch: (batch) => console.log("🙎 Generated:", batch.map((item) => item.name).join(", ")),
  logging: "debug",
});

// Wait for the generation to complete and get the results
const people = await complete();
console.dir(people, { depth: null });
```
