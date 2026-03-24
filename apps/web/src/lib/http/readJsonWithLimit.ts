const DEFAULT_MAX_JSON_BYTES = 256 * 1024; // 256KB

export class PayloadLimitError extends Error {
  status: number;

  constructor(message: string, status = 413) {
    super(message);
    this.name = "PayloadLimitError";
    this.status = status;
  }
}

function parseContentLength(headers: Headers): number | null {
  const raw = headers.get("content-length");
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export async function readJsonWithLimit(
  request: Request,
  options: { maxBytes?: number } = {}
): Promise<unknown> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BYTES;

  const contentLength = parseContentLength(request.headers);
  if (contentLength !== null && contentLength > maxBytes) {
    throw new PayloadLimitError(`Payload excede o limite de ${maxBytes} bytes.`);
  }

  const raw = await request.text();
  const actualBytes = new TextEncoder().encode(raw).byteLength;
  if (actualBytes > maxBytes) {
    throw new PayloadLimitError(`Payload excede o limite de ${maxBytes} bytes.`);
  }

  if (!raw.trim()) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new PayloadLimitError("JSON inválido.", 400);
  }
}
