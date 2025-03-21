import { z } from "zod";
import { Genthetic } from "../src/genthetic.ts";

const g = new Genthetic();

const PersonSchema = z.object({
  name: z.string(),
  email: z.string(),
  age: z.number(),
  occupation: z.string(),
  location: z.string(),
  favoriteColor: z.string(),
});

const PersonSynth = g
  .defineType({
    name: "Person",
    schema: PersonSchema,
  })
  .generate({ unique: true, instructions: "use characters from Arrested Development" });

const { complete } = g.synthesize(PersonSynth, {
  batchSize: 5,
  count: 20,
  onBatch: (batch) => console.log("🙎 Generated:", batch.map((item) => item.name).join(", ")),
  logging: "debug",
});
const people = await complete();
console.dir(people, { depth: null });
