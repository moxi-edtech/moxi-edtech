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

const FIELD_OPTIONS: { key: keyof MappedColumns; label: string }[] = [
  { key: "nome", label: "Nome" },
  { key: "data_nascimento", label: "Data de nascimento" },
  { key: "telefone", label: "Telefone" },
  { key: "bi", label: "BI" },
  { key: "email", label: "Email" },
  { key: "profile_id", label: "Profile ID" },
];

export function ColumnMapper({ headers, mapping, onChange }: ColumnMapperProps) {
  const options = useMemo(() => headers.filter(Boolean), [headers]);

  const update = (field: keyof MappedColumns, value: string) => {
    onChange({ ...mapping, [field]: value });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {FIELD_OPTIONS.map((field) => (
        <div key={field.key} className="space-y-2">
          <Label>{field.label}</Label>
          <Select value={mapping[field.key] || ""} onChange={(event) => update(field.key, event.target.value)}>
            <option value="">-- Selecione --</option>
            {options.map((header) => (
              <option key={header} value={header}>
                {header}
              </option>
            ))}
          </Select>
        </div>
      ))}
      <div className="space-y-2 md:col-span-2">
        <Label>Colunas no arquivo</Label>
        <Input readOnly value={options.join(", ")} />
      </div>
    </div>
  );
}
