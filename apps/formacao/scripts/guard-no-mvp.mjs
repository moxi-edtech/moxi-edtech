import { spawnSync } from "node:child_process";

const scan = spawnSync(
  "rg",
  ["-n", "MVP_", "app", "components", "--glob", "!**/*.tsbuildinfo"],
  { cwd: process.cwd(), encoding: "utf8" }
);

if (scan.status === 0) {
  process.stderr.write("\n[guard-no-mvp] Encontrado padrão proibido 'MVP_' em telas de gestão.\n");
  process.stderr.write(scan.stdout || "");
  process.exit(1);
}

if (scan.status === 1) {
  process.stdout.write("[guard-no-mvp] OK: nenhum padrão 'MVP_' encontrado.\n");
  process.exit(0);
}

process.stderr.write("[guard-no-mvp] Falha ao executar verificação.\n");
process.stderr.write(scan.stderr || "");
process.exit(scan.status ?? 2);
