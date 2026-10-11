# Evidência visual do Shell — fixture isolada (2026-10-07)

12 capturas **sem dados reais**, usando CommandCenterShell + CommandCenterActionBar do PR #175.
O aluno exibido ("Aluno de Demonstração", processo DEMO-001) é fictício.

## Método e limites
- agent-browser em Next.js local com rota temporária **não commitada**. A rota foi removida após os testes.
- Cada combinação aplica viewport CSS equivalente ao tamanho físico / fator de zoom (100/125/150%). **Não é zoom nativo de Chrome**; testa breakpoints/layout equivalente, não renderização tipográfica exata de browser zoom.
- `measurements.json`: scrollWidth e clientWidth foram lidos do DOM. Nos 12 cenários não houve overflow horizontal do documento.
- Há 7 botões em ecrãs maiores e os módulos aplicáveis são filtrados quando se inicia nova matrícula; a mudança de Matrícula apresentou "Nova matrícula" e "NOVO ATENDIMENTO" sem o aluno anterior.
- **Esta é evidência do Shell isolado, não do portal completo com sidebar/topbar, nem de autenticação, RLS/polo, financeiros e académicos.** Não marcar critérios amplos de aceite só com estes screenshots.

## Capturas
Arquivos `shell-<largura>x<altura>-zoom-<percentual>.png` cobrem:
- 1366x768: 100%, 125%, 150%;
- 1440x900: 100%, 125%, 150%;
- 1536x864: 100%, 125%, 150%;
- 1920x1080: 100%, 125%, 150%.
