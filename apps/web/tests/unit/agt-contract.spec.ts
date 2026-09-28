import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAgtHomologationEnvironment,
  buildAgtSoftwareInfoDetail,
  parseAgtSoftwareInfoMode,
} from "../../src/lib/fiscal/agtContract";

const identity = {
  productId: "KLASSE",
  productVersion: "1.0.0",
  softwareValidationNumber: "C_TEST",
  signatureVersion: 2,
} as const;

test("AGT docs-example softwareInfo matches the examples without signatureVersion", () => {
  assert.deepEqual(buildAgtSoftwareInfoDetail(identity, "docs-example"), {
    productId: "KLASSE",
    productVersion: "1.0.0",
    softwareValidationNumber: "C_TEST",
  });
});

test("AGT table-strict softwareInfo includes required signatureVersion", () => {
  assert.deepEqual(buildAgtSoftwareInfoDetail(identity, "table-strict"), {
    productId: "KLASSE",
    productVersion: "1.0.0",
    softwareValidationNumber: "C_TEST",
    signatureVersion: 2,
  });
});

test("AGT softwareInfo mode is fail-closed for unknown values", () => {
  assert.equal(parseAgtSoftwareInfoMode(undefined), "docs-example");
  assert.equal(parseAgtSoftwareInfoMode(" TABLE-STRICT "), "table-strict");
  assert.throws(
    () => parseAgtSoftwareInfoMode("guess"),
    /AGT_SOFTWARE_INFO_MODE_INVALID/,
  );
});

test("AGT HML guard refuses production and non-official hosts", () => {
  assert.doesNotThrow(() =>
    assertAgtHomologationEnvironment({
      environment: "hml",
      baseUrl: "https://sifphml.minfin.gov.ao/sigt/fe/v1",
    }),
  );

  assert.throws(
    () =>
      assertAgtHomologationEnvironment({
        environment: "prod",
        baseUrl: "https://sifp.minfin.gov.ao/sigt/fe/v1",
      }),
    /AGT_HML_PROBE_PRODUCTION_ENV_FORBIDDEN/,
  );

  assert.throws(
    () =>
      assertAgtHomologationEnvironment({
        environment: "hml",
        baseUrl: "https://example.com/sigt/fe/v1",
      }),
    /AGT_HML_PROBE_HOST_INVALID/,
  );
});
