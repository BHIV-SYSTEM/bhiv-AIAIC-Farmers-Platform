/**
 * THE STEPS CI RUNS, BY NAME (the audit of 1 Nov 2026, F38). Annapoorna's CI is `tsc` and ESLint, and neither its suites nor its walks are
 * in it, so a branch can pass every suite here and stop the deploy on two lines of formatting: `build` needs `validate`. This runs what
 * `.github/workflows/cicd.yml` runs, and fails if that file stops naming them.
 *
 * Run:  npx tsx tests/verify_ci_gate.ts
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const STEPS = [
  { named: "bunx tsc --noEmit", run: ["node_modules/typescript/bin/tsc", "--noEmit"] },
  // package.json's `lint` is `eslint .`; warnings do not fail a step
  { named: "bun run lint", run: ["node_modules/eslint/bin/eslint.js", ".", "--quiet"] },
];

const workflow = fs.readFileSync(path.join(APP, "..", ".github", "workflows", "cicd.yml"), "utf-8");
let failed = 0;
for (const step of STEPS) {
  if (!workflow.includes(step.named)) {
    console.log(`FAIL cicd.yml no longer runs "${step.named}": read what it runs now`);
    failed += 1;
    continue;
  }
  const r = spawnSync(process.execPath, step.run, { cwd: APP, encoding: "utf-8" });
  console.log(`${r.status === 0 ? "PASS" : "FAIL"} ${step.named}: exit ${r.status}`);
  if (r.status !== 0) {
    failed += 1;
    console.log(`${r.stdout}${r.stderr}`.slice(-1500));
  }
}
process.exit(failed ? 1 : 0);
