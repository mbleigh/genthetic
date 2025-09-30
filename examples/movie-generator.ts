import { Genthetic, z } from "../src/index.js";
import { toKebabCase } from "./utils.js";
import { faker } from "@faker-js/faker";

// Initialize Genthetic with a seed for reproducible results
const synth = new Genthetic();

// Define genres for movies
const GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Horror",
  "Sci-Fi",
  "Thriller",
  "Fantasy",
];

const MovieSchema = z.object({
  id: z.string(),
  title: z.string().describe('the title of the movie. mostly avoid "The" as the first word.'),
  genre: z.string(),
  releaseDate: z.date(),
  director: z.string(),
  description: z.string().describe("a 2-3 sentence description of the movie (no spoilers)"),
  cast: z.array(z.string()),
});

// Create a Movie synthesizer
const MovieSynth = synth
  .defineType<z.infer<typeof MovieSchema>>({
    name: "Movie",
    schema: MovieSchema,
  })
  .fill({
    genre: (_, context) => GENRES[context.batchNumber],
    releaseDate: () =>
      faker.helpers
        .weightedArrayElement<Date>([
          { weight: 1, value: faker.date.between({ from: "1960-01-01", to: "1979-12-31" }) },
          { weight: 2, value: faker.date.between({ from: "1980-01-01", to: "1999-12-31" }) },
          { weight: 3, value: faker.date.between({ from: "2000-01-01", to: "2024-12-31" }) },
        ])
        .toISOString()
        .substring(0, 10),
    director: () => faker.person.fullName(),
    __hints: {
      budget: () =>
        faker.helpers.arrayElement(["indie", "mid-budget", "blockbuster", "franchise tentpole"]),
      reception: () =>
        faker.helpers.weightedArrayElement([
          { weight: 0.1, value: "universally acclaimed" },
          { weight: 0.2, value: "mostly positive" },
          { weight: 0.2, value: "critics loved it, audiences not so much" },
          { weight: 0.2, value: "critics hated it, audiences loved it" },
          { weight: 0.1, value: "mediocre, nothing special" },
          { weight: 0.1, value: "universally panned" },
        ]),
    },
  })
  .generate({
    fields: ["title", "description"],
  })
  .stage((batch, context) =>
    batch.map((item) => ({
      ...item,
      id: toKebabCase(item.title || ""),
    })),
  );

// Main function to run the example
async function main() {
  console.log("Starting to generate 100 synthetic movies...");

  // Create a synthesis job for 100 movies
  const job = synth.synthesize(MovieSynth, {
    batches: GENRES.length,
    batchSize: 20,
    onBatch: (batch, { batchNumber }) => {
      console.log("🎬 Movies Generated:", batch.map((i) => i.title).join(", "));
    },
    logging: "debug",
    outFile: "examples/movies.json",
  });

  console.log("Tracking progress via onProgress callback...");

  // Wait for completion and get the results
  const movies = await job.complete();

  console.log(`\nGeneration complete! ${movies.length} movies generated.`);
  console.log("\nSample of generated movies:");

  console.dir(movies, { depth: null });
}

// Run the example
main().catch(console.error);
