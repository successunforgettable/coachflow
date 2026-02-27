import { ENV } from "./server/_core/env.js";

console.log("=== Testing Image Generation Module ===");
console.log("ENV.replicateApiKey exists:", !!ENV.replicateApiKey);
console.log("ENV.replicateApiKey length:", ENV.replicateApiKey?.length);
console.log("ENV.replicateApiKey starts with r8_:", ENV.replicateApiKey?.startsWith("r8_"));

// Test Replicate client initialization
import Replicate from "replicate";
try {
  const replicate = new Replicate({ auth: ENV.replicateApiKey });
  console.log("✅ Replicate client initialized successfully");
} catch (error) {
  console.error("❌ Replicate client initialization failed:", error.message);
}
