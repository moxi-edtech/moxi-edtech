import React from "react";
import { createRoot } from "react-dom/client";
import "./fixture.css";
import "../src/app/globals.css";
import "./operations-density-fixture.css";
import OperationsDensityFixture from "./operations-density-fixture";

const params = new URLSearchParams(window.location.search);
const value = params.get("state");
const state = value === "clean" || value === "empty" || value === "loading" || value === "error" ? value : "pending";
const target = document.getElementById("root");
if (!target) throw new Error("Synthetic operations fixture root missing");
createRoot(target).render(<OperationsDensityFixture state={state} baseline={params.get("baseline") === "1"} />);
