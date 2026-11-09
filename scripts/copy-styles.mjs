// tsc does not copy CSS, and the two optional stylesheets have to reach dist/
// or the `exports` entries point at nothing. Checked by CI, which fails when a
// published entry point is missing.
import { cp, mkdir } from "node:fs/promises";
await mkdir(new URL("../dist/styles/", import.meta.url), { recursive: true });
await cp(new URL("../src/styles/", import.meta.url), new URL("../dist/styles/", import.meta.url), { recursive: true });
console.log("copied src/styles -> dist/styles");
