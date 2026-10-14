// Avvio dalla cartella principale del repository (per l'hosting configurato senza "root directory"):
// costruisce il sito che sta in jediz-sito/ e copia il risultato in ./dist
import { execFileSync } from "node:child_process";
import { cpSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
execFileSync(process.execPath, [join(here, "jediz-sito", "build.mjs"), ...process.argv.slice(2)], { stdio: "inherit", cwd: join(here, "jediz-sito") });
const out = join(here, "dist");
if (existsSync(out)) rmSync(out, { recursive: true });
cpSync(join(here, "jediz-sito", "dist"), out, { recursive: true });
console.log("✓ copiato in dist/");
