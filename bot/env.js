import "dotenv/config";

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : "";
}
