import { env } from "./server/_core/env.js";

console.log("=== Environment Variable Test ===");
console.log("REPLICATE_API_KEY exists:", !!env.replicateApiKey);
console.log("REPLICATE_API_KEY starts with r8_:", env.replicateApiKey?.startsWith("r8_"));
console.log("REPLICATE_API_KEY length:", env.replicateApiKey?.length);
