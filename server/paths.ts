import path from "node:path";

/* Everything the app writes lives under one directory so tests and alternate
   deployments can point it elsewhere with DATA_DIR. */
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve("data");

export function dataFile(...parts: string[]) {
  return path.join(DATA_DIR, ...parts);
}
