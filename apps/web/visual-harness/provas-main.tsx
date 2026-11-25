import React from "react";
import { createRoot } from "react-dom/client";
import ProvasWorkspace from "../src/components/provas/ProvasWorkspace";
import "./fixture.css";
import "../src/app/globals.css";
createRoot(document.getElementById("root")!).render(<main className="mx-auto w-full min-w-0 max-w-6xl px-6 py-8 max-sm:px-2 max-sm:py-4"><ProvasWorkspace teacherWizard={new URLSearchParams(location.search).get("portal")!=="secretaria"} escolaId="00000000-0000-4000-8000-000000000001" printOnly={new URLSearchParams(location.search).get("portal")==="secretaria"}/></main>);
