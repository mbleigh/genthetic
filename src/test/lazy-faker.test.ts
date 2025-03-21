import { test } from "node:test";
import assert from "node:assert";
import { Faker, en } from "@faker-js/faker";
import { lazyFaker } from "../lazy-faker.js";

test("lazyFaker returns a proxy with the same API as Faker", (t) => {
  const lazy = lazyFaker({ locale: en });

  // Test that the object structure matches Faker's API
  assert.strictEqual(typeof lazy.person, "object");
  assert.strictEqual(typeof lazy.person.firstName, "function");
  assert.strictEqual(typeof lazy.location.city, "function");
  assert.strictEqual(typeof lazy.string.uuid, "function");
});

test("returned function can be called later with default Faker", (t) => {
  const lazy = lazyFaker({ locale: en, seed: 123 });

  // Get a lazy function
  const getFirstName = lazy.person.firstName();

  // Call it later
  const firstName = getFirstName();

  // It should return a string (the generated first name)
  assert.strictEqual(typeof firstName, "string");
  assert.ok(firstName.length > 0);
});

test("returned function can be called with custom Faker instance", (t) => {
  const lazy = lazyFaker({ locale: en });

  // Create two different Faker instances with different seeds
  const faker1 = new Faker({ locale: en, seed: 123 });
  const faker2 = new Faker({ locale: en, seed: 456 });

  // Get a lazy function
  const getUuid = lazy.string.uuid();

  // Call it with different Faker instances
  const uuid1 = getUuid(faker1);
  const uuid2 = getUuid(faker2);

  // The results should be different due to different seeds
  assert.notStrictEqual(uuid1, uuid2);
});

test("function arguments are captured and used later", (t) => {
  const lazy = lazyFaker({ locale: en });

  // Get a lazy function with specific arguments
  const getBetween = lazy.number.int({ min: 10, max: 20 });

  // Call it multiple times
  const num1 = getBetween();
  const num2 = getBetween();

  // Values should be within range
  assert.ok(num1 >= 10 && num1 <= 20);
  assert.ok(num2 >= 10 && num2 <= 20);
});
