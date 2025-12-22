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
  { key: "nome", label: "NOME_COMPLETO", required: true, hint: "Nome do estudante" },
  { key: "numero_processo", label: "NUMERO_PROCESSO", hint: "Texto ou número; se vazio fica NULL" },
  { key: "data_nascimento", label: "DATA_NASCIMENTO", required: true, hint: "Formato: DD/MM/AAAA" },
  { key: "sexo", label: "GENERO (M/F)", required: true, hint: "Aceita M ou F" },
  { key: "bi_numero", label: "BI_NUMERO", hint: "Será limpo e upper" },
  { key: "nif", label: "NIF", hint: "Opcional" },
  { key: "encarregado_nome", label: "NOME_ENCARREGADO", hint: "Opcional; será TRIM" },
  { key: "encarregado_telefone", label: "TELEFONE_ENCARREGADO", hint: "Mantém dígitos e +" },
  { key: "encarregado_email", label: "EMAIL_ENCARREGADO", hint: "lowercase" },
  { key: "turma_codigo", label: "TURMA_CODIGO", hint: "Ex.: 10A ou CTI-10-M-A" },
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
          Como usar o mapeamento (Template v2.0):
        </p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>
            Mapeie <span className="font-semibold">NOME_COMPLETO</span>, <span className="font-semibold">DATA_NASCIMENTO</span>{" "}
            e <span className="font-semibold">GENERO</span> (obrigatórios).
          </li>
          <li>
            Para matrículas automáticas, preencha <span className="font-semibold">TURMA_CODIGO</span>{" "}
            (ex.: <code>10A</code> ou <code>CTI-10-M-A</code>). O sistema cria/localiza a turma.
          </li>
          <li>
            Os demais campos são opcionais, mas ajudam na qualidade dos dados (responsável, BI, NIF).
          </li>
        </ul>
      </div>

      {/* Grupo: Dados pessoais */}
      <div className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold text-slate-800">
            Mapeamento (Excel → Banco)
          </h3>
          <p className="text-[11px] text-slate-500">
            Alinhe cada coluna do Excel à coluna correspondente no Supabase.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {PERSONAL_FIELDS.map(renderSelect)}
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
