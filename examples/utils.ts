/**
 * Converts a string to kebab-case
 * E.g. "Hello World" becomes "hello-world"
 */
export function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^\w\-]+/g, "") // Remove special characters
    .replace(/\-\-+/g, "-"); // Replace multiple hyphens with single hyphen
}
