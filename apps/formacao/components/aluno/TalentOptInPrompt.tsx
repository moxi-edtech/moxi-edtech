"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type PromptState = {
  is_open_to_work: boolean;
  eligible_for_opt_in: boolean;
  highest_media: number | null;
  career_headline: string | null;
};

const STORAGE_KEY = "talent-optin-prompt-dismissed";

export function TalentOptInPrompt({ escolaNome }: { escolaNome?: string | null }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [headline, setHeadline] = useState("");

  useEffect(() => {
    async function run() {
      const dismissed = window.sessionStorage.getItem(STORAGE_KEY);
      if (dismissed === "1") return;

      const res = await fetch("/api/formacao/talent-pool/profile", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) return;

      const profile = json.profile as PromptState;
      if (!profile.eligible_for_opt_in || profile.is_open_to_work) return;

      setHeadline(String(profile.career_headline ?? ""));
      setOpen(true);
    }

    void run();
  }, []);

  async function activateOptIn() {
    setSaving(true);
    try {
      await fetch("/api/formacao/talent-pool/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_open_to_work: true, career_headline: headline }),
      });
      setOpen(false);
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) window.sessionStorage.setItem(STORAGE_KEY, "1");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Parabens pela conclusao!</DialogTitle>
          <DialogDescription>
            Queres que a {escolaNome ?? "tua escola"} e o KLASSE partilhem o teu perfil anonimo com empresas parceiras?
          </DialogDescription>
        </DialogHeader>

        <label className="mt-4 block text-xs font-semibold text-slate-700">
          Career headline
          <input
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Ex: Especialista em Power BI"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
          />
        </label>

        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={saving}
          onClick={() => void activateOptIn()}
        >
          Sim, quero participar
        </button>
      </DialogContent>
    </Dialog>
  );
}
