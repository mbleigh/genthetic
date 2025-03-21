import { z } from "zod";
import { toJsonSchema } from "genkit/schema";
import { generateSyntheticData } from "./generate.js";

/**
 * Type that adds an optional __hints property to an object type
 * This allows stages to pass metadata that won't be included in final output
 */
export type WithHints<T> = T & {
  __hints?: Record<string, any>;
};

/**
 * Recursively resolves an object with function values.
 * Returns a new object with all functions resolved to their return values.
 */
export async function resolveObject<T>(obj: T): Promise<T> {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return (await Promise.all(
      obj.map(async (item) => {
        if (typeof item === "function") {
          return await Promise.resolve(item());
        } else if (item !== null && typeof item === "object") {
          return await resolveObject(item);
        }
        return item;
      })
    )) as unknown as T;
  }

  const result: Record<string, any> = {};

  for (const key in obj) {
    const value = obj[key as keyof T];

    if (typeof value === "function") {
      // Resolve the function, which may return a promise
      result[key] = await Promise.resolve(value());
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      // Handle nested objects recursively
      result[key] = await resolveObject(value);
    } else if (Array.isArray(value)) {
      // Handle arrays by resolving each item
      result[key] = await resolveObject(value);
    } else {
      // Copy primitive values directly
      result[key] = value;
    }
  }

  return result as T;
}

// Type for the context object passed to stage functions
export interface StageContext<T extends object> {
  batchNumber: number;
  batches: number;
  count: number;
  type: TypeDefinition<T>;
}

// Options for defining a type
export interface TypeDefinitionOptions {
  name: string;
  schema?: z.ZodTypeAny;
  jsonSchema?: any;
  batchSize?: number;
}

// Options for generating data
export interface GenerateOptions {
  fields?: string[];
  instructions?: string;
  model?: string;
}

export type StageFn<T extends object = Record<string, any>> = (
  batch: Partial<T>[],
  context: StageContext<T>
) => Partial<WithHints<T>>[] | Promise<Partial<WithHints<T>>[]>;

export interface Stage<T extends object = Record<string, any>> {
  name?: string;
  run: StageFn<T>;
}

// Options for synthesis
export interface SynthesizeOptions {
  // one of count or batches, not both
  count?: number;
  batches?: number;

  // override the default batch size for the type
  batchSize?: number;

  // optional callback for progress as alternative for the async iterable
  onProgress?: (progess: SynthesisJobProgress) => void;

  // optional callback that receives each batch as it's completed
  onBatch?: (batch: Partial<any>[], info: { batchNumber: number }) => void;

  // control logging verbosity
  logging?: "none" | "warning" | "info" | "debug";
}

// Type definition class with fluent API
export class TypeDefinition<T extends object = Record<string, any>> {
  name: string;
  zodSchema?: z.ZodTypeAny;
  defaultBatchSize?: number;
  suppliedJsonSchema?: any;
  stages: Stage<T>[] = [];

  constructor(
    private readonly options: TypeDefinitionOptions,
    private readonly genthetic: Genthetic
  ) {
    this.name = options.name;
    this.zodSchema = options.schema;
    this.suppliedJsonSchema = options.jsonSchema;
    this.defaultBatchSize = options.batchSize;
  }

  get jsonSchema(): Record<string, any> {
    return toJsonSchema({ jsonSchema: this.suppliedJsonSchema, schema: this.zodSchema });
  }

  /**
   * Fill the objects with values or add hints
   * @param name Optional name for this fill stage
   * @param data Data to fill
   * @param hints Hints to include (will be added to __hints property)
   */
  fill(name: string, data: Partial<WithHints<Record<keyof T, any>>>): this;
  fill(shape: Partial<WithHints<Record<keyof T, any>>>): this;
  fill(
    nameOrShape: string | Partial<Record<keyof T, any>>,
    shapeArg?: Partial<WithHints<Record<keyof T, any>>> | Record<string, any>
  ): this {
    // Handle the different parameter combinations
    let shape: Partial<Record<keyof T, any>>;
    let name: string | undefined;

    if (typeof nameOrShape === "string") {
      // Case: fill(name, data, hints?)
      name = nameOrShape;
      shape = shapeArg as Partial<Record<keyof T, any>>;
    } else {
      // Case: fill(shape, hints?)
      name = undefined;
      shape = nameOrShape;
    }

    const resolveFills: StageFn<T> = async (batch, context) => {
      return await Promise.all(
        batch.map(async (item) => {
          // Resolve the shape object to get all function values resolved
          const resolvedShape = await resolveObject(shape);
          return resolveObject(resolvedShape);
        })
      );
    };

    this.stage(name, async (batch, context) => {
      return resolveFills(batch, context);
    });

    return this;
  }

  /**
   * Configure the AI generation phase (placeholder for now)
   */
  generate(options: GenerateOptions): this {
    this.stage(async (batch, context) => {
      const generatedData = (await generateSyntheticData({
        data: batch,
        count: batch.length,
        fields: options.fields,
        instructions: options.instructions,
        model: options.model,
        schema: this.jsonSchema,
      })) as WithHints<Partial<T>>[];

      return batch.map((item, i) => ({ ...item, ...generatedData[i] }));
    });
    return this;
  }

  /**
   * Add a post-processing stage to the pipeline
   */
  stage(name: string | undefined, fn: StageFn<T>): this;
  stage(fn: StageFn<T>): this;
  stage(nameOrFn?: string | StageFn<T>, fn?: StageFn<T>): this {
    this.stages.push({
      name: fn ? (nameOrFn as string) : undefined,
      run: fn || (nameOrFn as StageFn<T>),
    });
    return this;
  }
}

export interface SynthesisJobProgress {
  batchesComplete: number;
  batchCount: number;
  currentBatch: {
    stagesComplete: number;
    stageCount: number;
  };
  // Time tracking
  elapsedTime: number; // in milliseconds
  currentBatchTime?: number; // in milliseconds
}

// Job interface for tracking synthesis progress
export interface SynthesisJob<T> {
  complete: () => Promise<T[]>;
}

/**
 * Main Genthetic class for synthetic data generation
 */
export class Genthetic {
  constructor() {}

  /**
   * Define a new synthetic data type
   */
  defineType<T extends object>(options: TypeDefinitionOptions): TypeDefinition<T> {
    return new TypeDefinition<T>(options, this);
  }

  /**
   * Synthesize data based on a type definition
   */
  synthesize<T extends object>(
    typeDefinition: TypeDefinition<T>,
    options: SynthesizeOptions = {}
  ): SynthesisJob<T> {
    // Determine batch size and logging level
    const batchSize = options.batchSize || typeDefinition.defaultBatchSize || 10;
    const loggingLevel = options.logging || "none";

    // Calculate total number of batches and items
    let totalBatches: number;
    let totalCount: number;

    if (options.batches) {
      totalBatches = options.batches;
      totalCount = totalBatches * batchSize;
    } else if (options.count) {
      totalCount = options.count;
      totalBatches = Math.ceil(totalCount / batchSize);
    } else {
      // Default to 1 batch if neither is specified
      totalBatches = 1;
      totalCount = batchSize;
    }

    // Implementation of AsyncIterable for progress tracking
    const progressController = {
      listeners: [] as Array<(progress: SynthesisJobProgress) => void>,
      startTime: Date.now(),
      batchStartTime: 0,
      currentProgress: {
        batchesComplete: 0,
        batchCount: totalBatches,
        currentBatch: {
          stagesComplete: 0,
          stageCount: typeDefinition.stages.length,
        },
        elapsedTime: 0,
        currentBatchTime: 0,
      } as SynthesisJobProgress,

      emit() {
        // Update timing information
        const now = Date.now();
        this.currentProgress.elapsedTime = now - this.startTime;
        this.currentProgress.currentBatchTime = now - this.batchStartTime;

        const progress = { ...this.currentProgress };
        for (const listener of this.listeners) {
          listener(progress);
        }

        // Also call onProgress callback if provided
        if (options.onProgress) {
          options.onProgress(progress);
        }
      },
    };

    // Create the actual data generation promise
    const generatePromise = async (): Promise<T[]> => {
      const results: Partial<WithHints<T>>[] = [];

      // Process each batch
      for (let batchNumber = 0; batchNumber < totalBatches; batchNumber++) {
        const isLastBatch = batchNumber === totalBatches - 1;
        const currentBatchSize = isLastBatch ? totalCount - batchNumber * batchSize : batchSize;

        // Record batch start time
        progressController.batchStartTime = Date.now();
        const totalElapsedSeconds = (
          (progressController.batchStartTime - progressController.startTime) /
          1000
        ).toFixed(2);

        // Log batch start for info/debug level
        if (loggingLevel === "info" || loggingLevel === "debug") {
          const itemsGenerated = batchNumber * batchSize;
          const percentComplete = Math.round((itemsGenerated / totalCount) * 100);
          console.log(
            `\x1b[34m🔄 [Genthetic] Batch ${
              batchNumber + 1
            }/${totalBatches} started (${percentComplete}% complete, ${itemsGenerated} items generated so far, total time: ${totalElapsedSeconds}s)\x1b[0m`
          );
        }

        // Initialize empty objects for the batch
        let currentBatch: Partial<WithHints<T>>[] = Array(currentBatchSize)
          .fill(null)
          .map(() => ({}));

        // Setup the context object for this batch
        const context: StageContext<T> = {
          batchNumber,
          batches: totalBatches,
          count: totalCount,
          type: typeDefinition,
        };

        // Run each stage
        for (let stageIndex = 0; stageIndex < typeDefinition.stages.length; stageIndex++) {
          const stage = typeDefinition.stages[stageIndex];
          progressController.currentProgress.currentBatch.stagesComplete = stageIndex;
          progressController.emit();

          // Run the stage
          try {
            currentBatch = await Promise.resolve(stage.run(currentBatch, context));

            // Log debug info for stage completion
            if (loggingLevel === "debug") {
              const stageName = stage.name || `Stage ${stageIndex + 1}`;
              const percentComplete = Math.round(
                ((stageIndex + 1) / typeDefinition.stages.length) * 100
              );
              const stageTime = ((Date.now() - progressController.batchStartTime) / 1000).toFixed(
                2
              );
              console.log(
                `\x1b[36m🔧 [Genthetic] Batch ${
                  batchNumber + 1
                }/${totalBatches} - ${stageName} completed (${percentComplete}% of batch processing, batch time so far: ${stageTime}s)\x1b[0m`
              );
            }
          } catch (error) {
            // Log warning if a retry would be needed
            if (loggingLevel === "warning" || loggingLevel === "info" || loggingLevel === "debug") {
              const stageName = stage.name || `Stage ${stageIndex + 1}`;
              console.log(
                `\x1b[33m⚠️ [Genthetic] WARNING: Error in Batch ${
                  batchNumber + 1
                }/${totalBatches} - ${stageName} - retry would be needed\x1b[0m`
              );
            }
            throw error; // Re-throw since retries are not implemented yet
          }

          // Update progress
          progressController.currentProgress.currentBatch.stagesComplete = stageIndex + 1;
          progressController.emit();
        }

        // Add batch results to total results
        results.push(...currentBatch);
        options.onBatch?.(currentBatch, { batchNumber: batchNumber });

        // Log batch completion for info/debug level
        if (loggingLevel === "info" || loggingLevel === "debug") {
          const itemsGenerated = (batchNumber + 1) * batchSize;
          const percentComplete = Math.min(100, Math.round((itemsGenerated / totalCount) * 100));
          const batchTime = ((Date.now() - progressController.batchStartTime) / 1000).toFixed(2);
          const totalTime = ((Date.now() - progressController.startTime) / 1000).toFixed(2);
          console.log(
            `\x1b[32m✅ [Genthetic] Batch ${
              batchNumber + 1
            }/${totalBatches} completed in ${batchTime}s (${percentComplete}% complete, ${
              isLastBatch ? totalCount : itemsGenerated
            } items generated so far, total time: ${totalTime}s)\x1b[0m`
          );
        }

        // Update batch progress
        progressController.currentProgress.batchesComplete = batchNumber + 1;
        progressController.emit();
      }

      // Log completion of all batches
      if (loggingLevel !== "none") {
        const totalTime = ((Date.now() - progressController.startTime) / 1000).toFixed(2);
        console.log(
          `\x1b[35m🎉 [Genthetic] Synthesis complete! Generated ${totalCount} items in ${totalTime}s\x1b[0m`
        );
      }

      // Strip __hints from final results
      return results.map((item) => {
        if (item && "__hints" in item) {
          const { __hints, ...rest } = item as any;
          return rest as T;
        }
        return item as T;
      });
    };

    return {
      complete: generatePromise,
    };
  }
}
