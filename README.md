```ts
import { Genthetic, f } from "genthetic";

const synth = new Genthentic({seed: 1234});

const GENRES = ['Action', 'Adventure', 'Comedy', 'Sci-Fi'];

const MovieSynth = g.defineType<Movie>({
  name: 'Movie',
  schema: {...}, // Zod schema expected of final output
  jsonSchema: {...},
  batchSize: 20,
})
  // fill creates a CodeStage based on the provided object where the object is in the same shape
  // as the type but with no-argument functions as leaf values (look out for nested objects and arrays).
  // when generating a batch, an array is filled with the seed values. the algorithm should
  // do two passes to allow for functions returning functions, but no more than two passes
  .fill({
    genre: f.helpers.arrayElement(GENRES),
    releaseDate: f.helpers.weightedArrayElement([
      {weight: 1, value: f.date.between({from: '1960-01-01', to: '1969-12-31'})},
      {weight: 1, value: f.date.between({from: '1970-01-01', to: '1979-12-31'})},
      {weight: 2, value: f.date.between({from: '1980-01-01', to: '1989-12-31'})},
      {weight: 3, value: f.date.between({from: '1990-01-01', to: '1999-12-31'})},
    ]),
    // __hints is a special field that will be provided to the AI model when generating but will be removed
    // from the final result, allowing for specific guidance per-item
    __hints: {
      reception: f.helpers.weightedArrayElement([
        {weight: 0.1, value: "universally acclaimed"},
        {weight: 0.2, value: "mostly positive"},
        {weight: 0.2, value: "critics loved it, audiences not so much"},
        {weight: 0.2, value: "critics hated it, audiences loved it"},
        {weight: 0.1, value: "mediocre, nothing special"},
        {weight: 0.1, value: "universally panned"}
      ])
    }
  })
  .generate({
    fields: [...], // optional selection of fields to generate
    instructions: "...", // optional top-level instructions to guide AI generation
  })
  .stage((batch, context) =>
    // context contains batchNumber, batches, count, etc.
    batch.map(item => ({...item, id: toKebabCase(item.title)}))
  );

const job = g.synthesize(MovieSynth, {count: 500});
for await (const progressUpdate of job.progress) {
  console.log(progressUpdate);
}
const movies = await job.complete();
```
