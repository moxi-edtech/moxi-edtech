# Fiscal Smoke Auth E2E

timestamp_utc: 20260428T222145Z
base_url: http://localhost:3000
escola_id: f406f5a7-a077-431c-b118-297224925726
empresa_id: 11a6aba6-3315-4732-a0b1-383202cf4f9d
ft_prefixo_serie: FR
rc_prefixo_serie: RC

## 1) Compliance Probe
```bash
curl -sS -X GET 'http://localhost:3000/api/fiscal/compliance/status?probe=1' -H 'Cookie: ***' -H 'x-escola-id: f406f5a7-a077-431c-b118-297224925726'
```
