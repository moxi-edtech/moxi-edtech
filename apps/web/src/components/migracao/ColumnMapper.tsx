"use client";

import { useMemo } from "react";

import { Input } from "~/components/ui/Input";
import { Label } from "~/components/ui/Label";
import { Select } from "~/components/ui/Select";

import type { MappedColumns } from "~types/migracao";

interface ColumnMapperProps {
  headers: string[];
  mapping: MappedColumns;
  onChange: (next: MappedColumns) => void;
}

type FieldKey = keyof MappedColumns | string;

type FieldOption = {
  key: FieldKey;
  label: string;
  required?: boolean;
  hint?: string;
};

const PERSONAL_FIELDS: FieldOption[] = [
  { key: "nome", label: "Nome completo", required: true, hint: "Nome do estudante" },
  { key: "data_nascimento", label: "Data de nascimento", hint: "Formato flexível: 2005-01-01 ou 01/01/2005" },
  { key: "telefone", label: "Telefone", hint: "Será normalizado para apenas dígitos" },
  { key: "bi", label: "BI / Documento", hint: "Ajuda a evitar duplicidades" },
  { key: "bi_numero", label: "Número do BI (oficial)", hint: "Use se houver coluna específica" },
  { key: "nif", label: "NIF (opcional)", hint: "Número de identificação fiscal" },
  { key: "email", label: "Email", hint: "Opcional, mas útil para portal do aluno" },
  { key: "encarregado_nome", label: "Nome do encarregado", required: true, hint: "Nome do pai/mãe/encarregado" },
  { key: "encarregado_telefone", label: "Telefone do encarregado", required: true, hint: "Obrigatório para contato" },
  { key: "encarregado_email", label: "Email do encarregado", hint: "Opcional" },
  { key: "profile_id", label: "Profile ID (opcional)", hint: "Só use se já tiver IDs de usuário prontos" },
  { key: "numero_processo", label: "Número de processo (opcional)", hint: "Se vazio, o sistema pode gerar" },
];

const MATRICULA_FIELDS: FieldOption[] = [
  {
    key: "curso_codigo",
    label: "Curso (código)",
    required: true,
    hint: "Ex.: EMG, CTI, EF1, EF2… depende de como a escola nomeia",
  },
  {
    key: "classe_numero",
    label: "Classe (número)",
    required: true,
    hint: "Apenas número: 1, 7, 10, 11, 12…",
  },
  {
    key: "turno_codigo",
    label: "Turno",
    required: true,
    hint: "Ex.: M = Manhã, T = Tarde, N = Noite",
  },
  {
    key: "turma_letra",
    label: "Turma",
    required: true,
    hint: "Ex.: A, B, C, AB, ABNG — exatamente como a escola usa",
  },
  {
    key: "ano_letivo",
    label: "Ano letivo",
    required: true,
    hint: "Ex.: 2025 ou 2025-2026 (será normalizado para 2025)",
  },
  {
    key: "numero_matricula",
    label: "Número de matrícula (opcional)",
    hint: "Se não vier, o sistema pode gerar automaticamente por escola",
  },
];

export function ColumnMapper({ headers, mapping, onChange }: ColumnMapperProps) {
  const options = useMemo(() => headers.filter(Boolean), [headers]);

  const update = (field: FieldKey, value: string) => {
    onChange({ ...mapping, [field]: value });
  };

  const renderSelect = (field: FieldOption) => (
    <div key={field.key} className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs sm:text-sm">
          {field.label}
          {field.required && <span className="ml-1 text-[11px] font-semibold text-red-500">*</span>}
        </Label>
        {field.required && (
          <span className="text-[10px] uppercase tracking-wide text-red-400 font-semibold">
            Importante
          </span>
        )}
      </div>

      <Select
        value={(mapping[field.key] as string) || ""}
        onChange={(event) => update(field.key, event.target.value)}
        className="text-xs sm:text-sm"
      >
        <option value="">-- Selecionar coluna --</option>
        {options.map((header) => (
          <option key={header} value={header}>
            {header}
          </option>
        ))}
      </Select>

      {field.hint && (
        <p className="text-[11px] text-slate-500">
          {field.hint}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Bloco explicativo */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-[11px] text-slate-600">
        <p className="font-medium text-slate-800 mb-1">
          Como usar o mapeamento:
        </p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>
            Mapeie <span className="font-semibold">Nome</span> e, se possível,{" "}
            <span className="font-semibold">Data de nascimento</span>,{" "}
            <span className="font-semibold">Telefone</span> e <span className="font-semibold">BI</span>.
          </li>
          <li>
            Para habilitar <span className="font-semibold">matrícula em massa</span>, é
            altamente recomendado mapear:{" "}
            <span className="font-semibold">Curso</span>,{" "}
            <span className="font-semibold">Classe (número)</span>,{" "}
            <span className="font-semibold">Turno</span>,{" "}
            <span className="font-semibold">Turma</span> e{" "}
            <span className="font-semibold">Ano letivo</span>.
          </li>
          <li>
            Campos marcados com <span className="font-semibold text-red-500">*</span> são
            críticos para automatizar turmas e matrículas.
          </li>
        </ul>
      </div>

      {/* Grupo: Dados pessoais */}
      <div className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold text-slate-800">
            Dados pessoais
          </h3>
          <p className="text-[11px] text-slate-500">
            Informações básicas do aluno. Quanto melhor preenchidas, melhor a
            qualidade do cadastro e a deduplicação.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {PERSONAL_FIELDS.map(renderSelect)}
        </div>
      </div>

      {/* Grupo: Dados para matrícula em massa */}
      <div className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold text-slate-800">
            Dados para matrícula em massa
          </h3>
          <p className="text-[11px] text-slate-500">
            Esses campos permitem agrupar alunos por curso / classe / turno / turma / ano
            e matricular todo o grupo de uma vez na turma correta.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {MATRICULA_FIELDS.map(renderSelect)}
        </div>
      </div>

      {/* Resumo das colunas detectadas no arquivo */}
      <div className="space-y-1.5">
        <Label className="text-xs sm:text-sm">Colunas detectadas no arquivo</Label>
        <Input
          label="Colunas detectadas"
          readOnly
          value={options.join(", ")}
          className="text-xs sm:text-sm bg-slate-50"
        />
        <p className="text-[11px] text-slate-500">
          Confirme se todos os campos importantes do seu modelo (curso/classe/turno/turma/ano)
          aparecem aqui com nomes reconhecíveis.
        </p>
      </div>
    </div>
  );
}
