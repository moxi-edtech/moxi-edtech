import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type SupportedXsdVersion = "AO_SAFT_1.01";

const SUPPORTED_XSD_PATHS: Record<SupportedXsdVersion, string> = {
  "AO_SAFT_1.01": path.join(process.cwd(), "src/lib/fiscal/xsd/AO_SAFT_1.01.xsd"),
};

export type SaftXsdValidationResult =
  | {
      ok: true;
      validator: "xmllint";
      xsdVersion: SupportedXsdVersion;
      xsdPath: string;
      validatedAt: string;
      output: string;
    }
  | {
      ok: false;
      code: "XSD_UNSUPPORTED_VERSION" | "XSD_VALIDATION_FAILED" | "XSD_VALIDATOR_UNAVAILABLE";
      message: string;
      validator: "xmllint";
      xsdVersion: string;
      xsdPath: string | null;
      validatedAt: string;
      output: string;
    };

export async function validateSaftXmlWithXsd({
  xml,
  xsdVersion,
}: {
  xml: string;
  xsdVersion: string;
}): Promise<SaftXsdValidationResult> {
  const validatedAt = new Date().toISOString();
  if (xsdVersion !== "AO_SAFT_1.01") {
    return {
      ok: false,
      code: "XSD_UNSUPPORTED_VERSION",
      message: `Versão XSD não suportada para validação automática: ${xsdVersion}.`,
      validator: "xmllint",
      xsdVersion,
      xsdPath: null,
      validatedAt,
      output: "",
    };
  }

  const xsdPath = SUPPORTED_XSD_PATHS[xsdVersion];
  const workdir = await mkdtemp(path.join(tmpdir(), "saft-xsd-"));
  const xmlPath = path.join(workdir, "saft.xml");

  try {
    await writeFile(xmlPath, xml, "utf8");
    try {
      const { stdout, stderr } = await execFileAsync("xmllint", [
        "--noout",
        "--schema",
        xsdPath,
        xmlPath,
      ]);
      return {
        ok: true,
        validator: "xmllint",
        xsdVersion,
        xsdPath,
        validatedAt,
        output: [stdout, stderr].filter(Boolean).join("\n").trim(),
      };
    } catch (error) {
      const err = error as { code?: string; stdout?: string; stderr?: string; message?: string };
      if (err.code === "ENOENT") {
        return {
          ok: false,
          code: "XSD_VALIDATOR_UNAVAILABLE",
          message: "Validador XSD 'xmllint' não disponível no ambiente de execução.",
          validator: "xmllint",
          xsdVersion,
          xsdPath,
          validatedAt,
          output: err.message ?? "",
        };
      }
      return {
        ok: false,
        code: "XSD_VALIDATION_FAILED",
        message: "XML SAF-T(AO) inválido para o XSD configurado.",
        validator: "xmllint",
        xsdVersion,
        xsdPath,
        validatedAt,
        output: [err.stdout, err.stderr, err.message].filter(Boolean).join("\n").trim(),
      };
    }
  } finally {
    await rm(workdir, { recursive: true, force: true }).catch(() => null);
  }
}
