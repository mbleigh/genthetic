import { Faker, en } from "@faker-js/faker";

// Type to represent a function that returns a function
export type LazyFakerFn<T> = (...args: any[]) => (customFaker?: Faker) => T;

// Type that maps all Faker methods to their lazy versions
export type LazyFakerMethods<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Return
    ? LazyFakerFn<Return>
    : T[K] extends object
    ? LazyFakerMethods<T[K]>
    : never;
};

// The main proxy type that matches Faker's structure
export type LazyFaker = LazyFakerMethods<Faker>;

/**
 * Creates a proxy that has the same API as Faker.js but returns functions
 * that can be executed on demand with an optional Faker instance
 */
export function lazyFaker(options?: ConstructorParameters<typeof Faker>[0]): LazyFaker {
  // Create a default Faker instance with required locale property
  const defaultFaker = new Faker(options || { locale: en });

  function createNestedProxy(path: string[] = []): any {
    return new Proxy(
      {},
      {
        get: (target, prop) => {
          if (typeof prop === "symbol") return undefined;

          const newPath = [...path, prop.toString()];

          // Get the actual property from the faker instance to check its type
          const fakerProp = getNestedProperty(defaultFaker, newPath);

          // If it's a function, return our lazy function
          if (typeof fakerProp === "function") {
            return (...args: any[]) => {
              return (customFaker?: Faker) => {
                const faker = customFaker || defaultFaker;
                const method = getNestedProperty(faker, newPath);
                return method.apply(faker, args);
              };
            };
          }

          // If it's an object, return a new proxy for that path
          if (fakerProp && typeof fakerProp === "object") {
            return createNestedProxy(newPath);
          }

          return undefined;
        },
      }
    );
  }

  function getNestedProperty(obj: any, path: string[]): any {
    return path.reduce((current, key) => current?.[key], obj);
  }

  return createNestedProxy() as LazyFaker;
}
