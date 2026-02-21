import postgres from "postgres";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { CURRICULUM_PRESETS, type CurriculumKey } from "../apps/web/src/lib/academico/curriculum-presets";

type PendingRow = {
  id: string;
  curso_id: string;
  curriculum_key: string | null;
  classe_nome: string | null;
  disciplina_nome: string | null;
};

const normalizeNome = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const argv = yargs(hideBin(process.argv))
  .option("commit", { type: "boolean", default: false, describe: "Aplicar updates no DB" })
  .option("limit", { type: "number", default: 5000, describe: "Limite de linhas para varrer" })
  .help()
  .parseSync();

const dbUrl = process.env.DB_URL;
if (!dbUrl) {
  throw new Error("DB_URL não definido.");
}

const presetMap = new Map<CurriculumKey, Map<string, number>>();
Object.entries(CURRICULUM_PRESETS).forEach(([key, disciplinas]) => {
  const map = new Map<string, number>();
  disciplinas.forEach((disciplina) => {
    const nome = String(disciplina?.nome ?? "").trim();
    const classe = String(disciplina?.classe ?? "").trim();
    if (!nome || !classe || !Number.isFinite(disciplina?.horas)) return;
    const mapKey = `${normalizeNome(nome)}::${normalizeNome(classe)}`;
    map.set(mapKey, Number(disciplina.horas));
  });
  presetMap.set(key as CurriculumKey, map);
});

const sql = postgres(dbUrl, { max: 1 });

const main = async () => {
  const rows = await sql<PendingRow[]>`
    select
      cm.id,
      cm.curso_id,
      c.curriculum_key,
      cl.nome as classe_nome,
      dc.nome as disciplina_nome
    from public.curso_matriz cm
    join public.cursos c on c.id = cm.curso_id
    join public.classes cl on cl.id = cm.classe_id
    left join public.disciplinas_catalogo dc on dc.id = cm.disciplina_id
    where (cm.carga_horaria_semanal is null or cm.carga_horaria_semanal <= 0)
      and c.curriculum_key is not null
    limit ${argv.limit};
  `;

  const updates: Array<{ id: string; carga: number }> = [];
  const missing: PendingRow[] = [];

  rows.forEach((row) => {
    const presetKey = row.curriculum_key as CurriculumKey;
    const map = presetMap.get(presetKey);
    if (!map) {
      missing.push(row);
      return;
    }
    const disciplina = row.disciplina_nome?.trim();
    const classe = row.classe_nome?.trim();
    if (!disciplina || !classe) {
      missing.push(row);
      return;
    }
    const mapKey = `${normalizeNome(disciplina)}::${normalizeNome(classe)}`;
    const carga = map.get(mapKey);
    if (!carga) {
      missing.push(row);
      return;
    }
    updates.push({ id: row.id, carga });
  });

  console.log(`Pendentes encontrados: ${rows.length}`);
  console.log(`Com match no preset: ${updates.length}`);
  console.log(`Sem match: ${missing.length}`);

  if (!argv.commit) {
    console.log("Dry-run: nenhum update aplicado (use --commit)." );
    if (missing.length > 0) {
      console.log("Exemplos sem match:");
      missing.slice(0, 10).forEach((row) => {
        console.log(`- ${row.curriculum_key} | ${row.classe_nome} | ${row.disciplina_nome}`);
      });
    }
    return;
  }

  const updated = await sql.begin(async (tx) => {
    let count = 0;
    for (const { id, carga } of updates) {
      const result = await tx`
        update public.curso_matriz
        set carga_horaria_semanal = ${carga}
        where id = ${id}
          and (carga_horaria_semanal is null or carga_horaria_semanal <= 0);
      `;
      count += result.count ?? 0;
    }
    return count;
  });

  console.log(`Updates aplicados: ${updated}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
