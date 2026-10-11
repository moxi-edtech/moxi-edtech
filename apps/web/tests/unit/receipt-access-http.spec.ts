import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.RECEIPT_TEST_BASE_URL;
const uuid = "00000000-0000-0000-0000-000000000000";

test("recuperação rejeita identificador inválido sem consultar pagamentos", { skip: !baseUrl }, async () => {
  const response = await fetch(`${baseUrl}/api/secretaria/recibos/recuperar`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mensalidade_id: "invalid" }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).ok, false);
});

test("recuperação não permite UUID válido sem autenticação", { skip: !baseUrl }, async () => {
  const response = await fetch(`${baseUrl}/api/secretaria/recibos/recuperar`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mensalidade_id: uuid }),
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).ok, false);
});

for (const portal of ["secretaria", "aluno"]) {
  test(`impressão ${portal} não expõe recibo sem sessão`, { skip: !baseUrl }, async () => {
    const response = await fetch(`${baseUrl}/${portal}/documentos/${uuid}/recibo/print`, {
      redirect: "manual",
    });
    assert.ok([301, 302, 303, 307, 308, 401, 403].includes(response.status));
    if (response.headers.has("location")) {
      assert.match(response.headers.get("location")!, /login/);
    }
  });
}
