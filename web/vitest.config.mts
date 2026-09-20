import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // Tests run on fixtures whatever the developer's .env says, and Prisma would otherwise load AUDITX_DATA=db from it.
  test: { environment: "node", include: ["src/**/*.test.ts"], env: { AUDITX_DATA: "fixtures" } },
});
