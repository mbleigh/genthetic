import { genkit, z } from "genkit";
import { gemini20Flash, googleAI } from "@genkit-ai/googleai";
import { ExecutablePrompt } from "@genkit-ai/ai";

const ai = genkit({
  model: gemini20Flash,
  plugins: [googleAI()],
});

const GenerateSyntheticDataInputSchema = z.object({
  count: z.number().optional(),
  data: z.array(z.any()).optional(),
  existingData: z.array(z.any()).optional(),
  fields: z.array(z.string()).optional(),
  instructions: z.string().optional(),
  schema: z.any(),
  model: z.string().optional(),
});

export const generateSyntheticData = ai.defineFlow(
  {
    name: "generateSyntheticData",
    inputSchema: GenerateSyntheticDataInputSchema,
    outputSchema: z.array(z.record(z.any())),
  },
  async ({ count, data, existingData, schema, instructions, model, fields }) => {
    const hasSeed = data?.some((item) => Object.keys(item).length > 0);
    const hasHints = data?.some((item) => !!item.__hints);
    const batchSize = data?.length || count || 10;

    let prompt = `You are a synthetic data generation assistant. Your task is to generate ${batchSize} objects of plausible data based on the supplied schema and any additional input and configuration.`;

    const seedPrompt = hasSeed
      ? `\n\n## Partial Data\n\nUse the following data as the basis for your generation. You will generate one object corresponding to each of the objects in the supplied data. The generated objects should contain plausible fields based on the provided data. You MUST generate exactly the same number of objects as are supplied here. You will generate only new unique fields without copying the existing ones. The data you generate will be combined with the existing data to create the final result.\n\n${JSON.stringify(
          data,
          null,
          2
        )}`
      : "";

    if (!existingData) prompt += seedPrompt;

    if (hasHints)
      prompt += `\n\n## Hints\n\nItems in the provided data may include a "__hints" field. These are generation hints that you should keep in mind when generating the corresponding output data for that item only. The hints are purely informational and will not show up in the final result. The generated data should be guided both by the hints AND the partial data that has been provided.`;

    if (instructions) prompt += `\n\n## User Instructions\n\n${instructions}`;

    const newSchema = { ...schema };
    if (fields) {
      const newProps: Record<string, any> = {};
      for (const field of fields) {
        newProps[field] = schema.properties[field];
      }
      newSchema.properties = newProps;
      newSchema.required = fields;
    } else {
      newSchema.required = [];
    }

    const messages = existingData
      ? [
          { role: "user" as const, content: [{ text: prompt }] },
          { role: "model" as const, content: [{ text: JSON.stringify(existingData) }] },
          {
            role: "user" as const,
            content: [
              {
                text: `Please generate an additional ${batchSize} examples that are unique from the existing examples. ${seedPrompt}`,
              },
            ],
          },
        ]
      : [{ role: "user" as const, content: [{ text: prompt }] }];

    const { output } = await ai.generate({
      model: `googleai/${model || "gemini-2.0-flash"}`,
      messages,
      output: {
        format: "json",
        jsonSchema: {
          type: "array",
          items: newSchema,
        },
      },
    });

    return output;
  }
);

export const generateSyntheticField = ai.defineFlow(
  {
    name: "generateSyntheticField",
    inputSchema: z.object({
      data: z.record(z.any()),
      schema: z.record(z.any()),
      instructions: z.string().optional(),
    }),
    outputSchema: z.object({}),
  },
  async () => {}
);
