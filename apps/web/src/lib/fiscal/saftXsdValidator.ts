import { constants as fsConstants } from "node:fs";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type SupportedXsdVersion = "AO_SAFT_1.01";

type XsdValidationErrorCode =
  | "XSD_UNSUPPORTED_VERSION"
  | "XSD_SCHEMA_NOT_FOUND"
  | "XSD_VALIDATOR_UNAVAILABLE"
  | "XSD_VALIDATION_FAILED";

type XmllintFailure = {
  line: number | null;
  node: string | null;
  message: string;
  raw: string;
};

export type SaftXsdValidationResult = {
  ok: true;
  validator: "xmllint";
  xsdVersion: SupportedXsdVersion;
  xsdPath: string;
  validatedAt: string;
  output: string;
};

export class SaftXsdValidationError extends Error {
  readonly code: XsdValidationErrorCode;
  readonly validator: "xmllint";
  readonly xsdVersion: string;
  readonly xsdPath: string | null;
  readonly validatedAt: string;
  readonly output: string;
  readonly failures: XmllintFailure[];

  constructor(params: {
    code: XsdValidationErrorCode;
    message: string;
    xsdVersion: string;
    xsdPath: string | null;
    validatedAt: string;
    output?: string;
    failures?: XmllintFailure[];
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "SaftXsdValidationError";
    this.code = params.code;
    this.validator = "xmllint";
    this.xsdVersion = params.xsdVersion;
    this.xsdPath = params.xsdPath;
    this.validatedAt = params.validatedAt;
    this.output = params.output ?? "";
    this.failures = params.failures ?? [];
    if (params.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = params.cause;
    }
  }
}

function resolveOfficialXsdPath(xsdVersion: SupportedXsdVersion): string {
  if (xsdVersion !== "AO_SAFT_1.01") {
    throw new Error(`Versão XSD sem mapeamento oficial: ${xsdVersion}`);
  }
  return path.resolve(process.cwd(), "src/lib/fiscal/xsd/SAF-T-AO1.01_01.xsd");
}

function parseXmllintFailures(rawOutput: string): XmllintFailure[] {
  const lines = rawOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const failures: XmllintFailure[] = [];
  for (const line of lines) {
    if (!line.includes("error") && !line.includes("fails to validate")) {
      continue;
    }

    const lineMatch = line.match(/:(\d+):/);
    const nodeMatch = line.match(/Element\s+'([^']+)'/i) ?? line.match(/element\s+([^:]+):/i);

    failures.push({
      line: lineMatch ? Number(lineMatch[1]) : null,
      node: nodeMatch ? nodeMatch[1] : null,
      message: line,
      raw: line,
    });
  }

  return failures;
}

export async function validateSaftXmlWithXsd({
  xml,
  xsdVersion,
}: {
  xml: string;
  xsdVersion: string;
}): Promise<SaftXsdValidationResult> {
  const validatedAt = new Date().toISOString();

  if (xsdVersion !== "AO_SAFT_1.01") {
    throw new SaftXsdValidationError({
      code: "XSD_UNSUPPORTED_VERSION",
      message: `Versão XSD não suportada para validação automática: ${xsdVersion}.`,
      xsdVersion,
      xsdPath: null,
      validatedAt,
    });
  }

  const officialXsdPath = resolveOfficialXsdPath(xsdVersion);

  try {
    await access(officialXsdPath, fsConstants.R_OK);
  } catch (cause) {
    throw new SaftXsdValidationError({
      code: "XSD_SCHEMA_NOT_FOUND",
      message: `XSD oficial não encontrado ou sem leitura em: ${officialXsdPath}`,
      xsdVersion,
      xsdPath: officialXsdPath,
      validatedAt,
      cause,
    });
  }

  const workdir = await mkdtemp(path.join(tmpdir(), "saft-xsd-"));
  const xmlPath = path.join(workdir, "saft.xml");

  try {
    await writeFile(xmlPath, xml, "utf8");

    try {
      const { stdout, stderr } = await execFileAsync("xmllint", [
        "--noout",
        "--nonet",
        "--schema",
        officialXsdPath,
        xmlPath,
      ]);

      return {
        ok: true,
        validator: "xmllint",
        xsdVersion,
        xsdPath: officialXsdPath,
        validatedAt,
        output: [stdout, stderr].filter(Boolean).join("\n").trim(),
      };
    } catch (cause) {
      const err = cause as {
        code?: string;
        stdout?: string;
        stderr?: string;
        message?: string;
      };

      if (err.code === "ENOENT") {
        throw new SaftXsdValidationError({
          code: "XSD_VALIDATOR_UNAVAILABLE",
          message: "Validador XSD 'xmllint' não disponível no ambiente de execução.",
          xsdVersion,
          xsdPath: officialXsdPath,
          validatedAt,
          output: err.message ?? "",
          cause,
        });
      }

      const output = [err.stdout, err.stderr, err.message].filter(Boolean).join("\n").trim();
      const failures = parseXmllintFailures(output);
      const firstFailure = failures[0];

      const failureMessage = firstFailure
        ? `XML SAF-T(AO) inválido no XSD oficial (linha ${firstFailure.line ?? "n/a"}, nó ${firstFailure.node ?? "n/a"}).`
        : "XML SAF-T(AO) inválido no XSD oficial.";

      throw new SaftXsdValidationError({
        code: "XSD_VALIDATION_FAILED",
        message: failureMessage,
        xsdVersion,
        xsdPath: officialXsdPath,
        validatedAt,
        output,
        failures,
        cause,
      });
    }
  } finally {
    await rm(workdir, { recursive: true, force: true }).catch(() => null);
  }
}
