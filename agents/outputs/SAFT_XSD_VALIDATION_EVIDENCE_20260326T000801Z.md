# SAF-T XSD Validation Evidence

timestamp_utc: 2026-03-26T00:08:01Z
status: PASS
xsd_version: AO_SAFT_1.01
xml_file: /tmp/saft_sample.xml
xsd_file: /Users/gundja/moxi-edtech/apps/web/src/lib/fiscal/xsd/AO_SAFT_1.01.xsd
xml_sha256: e84b4cb98bc95a4f04396214b377a403085bf12469a3150809cf1434e38c1ede
xsd_sha256: 56beac46a4262418499ebf9bc0ce4abb1eab2f2fcd400356c50faf59fac39a39

## Validator
`xmllint --noout --schema "/Users/gundja/moxi-edtech/apps/web/src/lib/fiscal/xsd/AO_SAFT_1.01.xsd" "/tmp/saft_sample.xml"`

## Output
```
/tmp/saft_sample.xml validates
```
