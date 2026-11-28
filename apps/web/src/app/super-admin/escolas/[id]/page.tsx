"use client";
import { useParams } from "next/navigation";
import SchoolMonitorWorkspace from "@/components/super-admin/escola-monitor/SchoolMonitorWorkspace";
export default function EscolaMonitoramentoPage() {
  const params = useParams();
  return <SchoolMonitorWorkspace escolaId={typeof params?.id === "string" ? params.id : ""} />;
}
