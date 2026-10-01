import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve the Tailwind config relative to this file, not the process cwd.
const here = dirname(fileURLToPath(import.meta.url));

const config = { plugins: { tailwindcss: { config: join(here, "tailwind.config.ts") }, autoprefixer: {} } };
export default config;
