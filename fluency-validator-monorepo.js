import fs from 'fs/promises';
import path from 'path';

class MonorepoFluencyValidator {
  constructor() {
    this.dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'postgres',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'postgres',
      ssl: false,
    };

    this.sql = null;
    this.project = null;
    this.sourceFiles = [];
    this.warnings = [];
    this.results = new Map();
    this.stats = {
      total: 0,
      passed: 0,
      warning: 0,
      failed: 0,
      skipped: 0,
    };
  }

  // ====================
  // 🚀 INICIALIZAÇÃO OTIMIZADA PARA MONOREPO
  // ====================

  async initialize() {
    console.log('🔍 Inicializando Validador (Monorepo Edition)...');

    // 1. Conectar ao banco
    try {
      const postgresModule = await import('postgres').catch(() => null);
      if (!postgresModule) {
        this.warnings.push('Postgres client ausente; pulando verificação de conexão.');
      } else {
        this.sql = postgresModule.default(this.dbConfig);
        const version = await this.sql`SELECT version()`;
        console.log(`✅ PostgreSQL: ${version[0].version}`);
      }
    } catch (error) {
      this.warnings.push(`Falha ao conectar no banco: ${error.message}`);
      this.sql = null;
    }

    // 2. Carregar projeto TypeScript (monorepo-wide)
    try {
      const tsMorphModule = await import('ts-morph').catch(() => null);
      if (!tsMorphModule) {
        throw new Error('ts-morph ausente');
      }
      const { Project } = tsMorphModule;
      // Descobre tsconfigs relevantes no monorepo
      const tsconfigs = await this.findTsConfigs();
      console.log(`📁 Encontrados ${tsconfigs.length} tsconfigs no monorepo`);

      // Cria project "solto" (não depende de 1 tsconfig só)
      this.project = new Project({
        skipAddingFilesFromTsConfig: true,
        compilerOptions: {
          allowJs: true,
          checkJs: false,
          target: 'ES2020',
          module: 'ESNext',
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          jsx: 'preserve',
        },
      });

      // Tenta carregar via tsconfig (melhor pra resolver paths/types)
      for (const tsconfigPath of tsconfigs) {
        try {
          console.log(`   📦 Carregando ${path.relative(process.cwd(), tsconfigPath)}`);
          const p = new Project({
            tsConfigFilePath: tsconfigPath,
            skipAddingFilesFromTsConfig: false,
          });

          // Importa os arquivos desse project para o project principal
          const sourceFiles = p.getSourceFiles();
          console.log(`     ✅ ${sourceFiles.length} arquivos carregados`);

          for (const sf of sourceFiles) {
            const filePath = sf.getFilePath();
            if (!this.project.getSourceFile(filePath)) {
              this.project.addSourceFileAtPath(filePath);
            }
          }
        } catch (error) {
          console.log(`     ⚠️  Ignorando ${tsconfigPath}: ${error.message}`);
          // não quebra o pipeline
        }
      }

      // Fallback: glob manual monorepo inteiro
      const sourceFiles = await this.findSourceFiles();
      console.log(`🔍 Glob encontrou ${sourceFiles.length} arquivos`);

      for (const file of sourceFiles) {
        if (!this.project.getSourceFile(file)) {
          this.project.addSourceFileAtPath(file);
        }
      }

      console.log(
        `📁 Total: ${this.project.getSourceFiles().length} arquivos carregados (monorepo)`,
      );
    } catch (error) {
      this.warnings.push(`Falha ao carregar TS Project: ${error.message}. Usando modo texto.`);
      const sourceFiles = await this.findSourceFiles();
      this.sourceFiles = await Promise.all(
        sourceFiles.map(async (filePath) => ({
          filePath,
          content: await fs.readFile(filePath, 'utf-8').catch(() => ''),
        })),
      );
      console.log(`📁 ${this.sourceFiles.length} arquivos carregados (fallback)`);
    }

    console.log('✅ Validador inicializado\n');
  }

  // ====================
  // 🛠️ UTILITÁRIOS MONOREPO
  // ====================

  async findTsConfigs() {
    // tsconfig raiz + apps/* + packages/*
    const patterns = [
      'tsconfig.json',
      'apps/*/tsconfig.json',
      'apps/*/tsconfig.*.json',
      'packages/*/tsconfig.json',
      'packages/*/tsconfig.*.json',
    ];

    const ignore = [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/.turbo/**',
      '**/.vercel/**',
      '**/coverage/**',
      '**/supabase/migrations_archive/**',
    ];

    const found = new Set();

    for (const pat of patterns) {
      try {
        const matches = await this.glob(pat, { ignore });
        for (const m of matches) {
          // Verificar se é um arquivo válido
          try {
            const content = await fs.readFile(m, 'utf-8');
            if (content.includes('compilerOptions')) {
              found.add(m);
            }
          } catch {
            // Ignorar arquivos não legíveis
          }
        }
      } catch (error) {
        console.log(`⚠️  Erro no pattern ${pat}: ${error.message}`);
      }
    }

    return Array.from(found);
  }

  async findSourceFiles() {
    const patterns = [
      // Apps
      'apps/**/src/**/*.{ts,tsx,js,jsx}',
      'apps/**/app/**/*.{ts,tsx,js,jsx}',
      'apps/**/lib/**/*.{ts,tsx,js,jsx}',
      'apps/**/components/**/*.{ts,tsx,js,jsx}',
      'apps/**/hooks/**/*.{ts,tsx,js,jsx}',
      'apps/**/utils/**/*.{ts,tsx,js,jsx}',

      // Packages
      'packages/**/src/**/*.{ts,tsx,js,jsx}',
      'packages/**/lib/**/*.{ts,tsx,js,jsx}',

      // Root (se existir)
      'src/**/*.{ts,tsx,js,jsx}',
      'lib/**/*.{ts,tsx,js,jsx}',

      // Supabase Edge Functions (se tiver)
      'supabase/functions/**/*.{ts,js}',
    ];

    const ignore = [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/.turbo/**',
      '**/.vercel/**',
      '**/coverage/**',
      '**/*.d.ts',
      '**/supabase/migrations_archive/**',
      '**/__generated__/**',
      '**/__tests__/**',
      '**/*.test.*',
      '**/*.spec.*',
    ];

    const files = new Set();

    for (const pattern of patterns) {
      try {
        const matches = await this.glob(pattern, { ignore });
        for (const m of matches) {
          // Filtrar apenas arquivos de código
          if (m.match(/\.(ts|tsx|js|jsx)$/) && !m.includes('.d.ts')) {
            files.add(m);
          }
        }
      } catch (error) {
        console.log(`⚠️  Erro no pattern ${pattern}: ${error.message}`);
      }
    }

    return Array.from(files);
  }

  async glob(pattern, options = {}) {
    const fastGlob = await import('fast-glob');
    return fastGlob.default(pattern, {
      onlyFiles: true,
      unique: true,
      suppressErrors: true,
      ignore: options.ignore || [],
      ...options,
    });
  }

  getSourceFiles() {
    if (this.project) {
      return this.project.getSourceFiles();
    }

    return this.sourceFiles.map((file) => ({
      getFilePath: () => file.filePath,
      getFullText: () => file.content,
    }));
  }

  // ====================
  // 🔍 VERIFICAÇÃO OTIMIZADA PARA MONOREPO
  // ====================

  async checkServiceRoleUsageMonorepo() {
    const check = { id: 'P0.5', status: 'PASS', evidence: [], notes: '' };

    try {
      const serviceRolePatterns = [
        'SUPABASE_SERVICE_ROLE_KEY',
        'serviceRoleKey',
        'createClient.*service_role',
        'supabaseAdmin',
        'supabaseClient.*service_role',
      ];

      const violations = [];
      const sourceFiles = this.getSourceFiles();

      console.log(`🔍 Analisando ${sourceFiles.length} arquivos para Service Role...`);

      for (const file of sourceFiles) {
        const content = file.getFullText();
        const filePath = file.getFilePath();

        // Ignorar arquivos de jobs/worker/provisioning
        if (
          filePath.includes('jobs/') ||
          filePath.includes('workers/') ||
          filePath.includes('provisioning/') ||
          filePath.includes('cron/') ||
          filePath.includes('scripts/')
        ) {
          continue;
        }

        // Determinar se é uma rota de API
        const isAppRouterApi = filePath.includes('/src/app/api/') && filePath.endsWith('/route.ts');
        const isPagesApi =
          filePath.includes('/src/pages/api/') &&
          (filePath.endsWith('.ts') || filePath.endsWith('.js'));
        const isApiFile = isAppRouterApi || isPagesApi;

        if (isApiFile) {
          for (const pattern of serviceRolePatterns) {
            if (content.includes(pattern)) {
              const relativePath = path.relative(process.cwd(), filePath);
              violations.push(`${relativePath}: ${pattern}`);
              break;
            }
          }
        }
      }

      if (violations.length > 0) {
        check.status = 'FAIL';
        check.evidence = violations.slice(0, 10); // Limitar a 10 exemplos
        check.notes = `Service Role usada em rotas humanas (${violations.length} ocorrências). PRIMEIRAS:`;
      } else {
        check.evidence = ['✅ Service Role restrita a jobs/workers conforme esperado'];
      }
    } catch (error) {
      check.status = 'ERROR';
      check.notes = `Erro: ${error.message}`;
    }

    this.updateStats(check.status);
    return check;
  }

  // ====================
  // 🎯 VERIFICAÇÕES DE ENDPOINTS (MONOREPO)
  // ====================

  async checkEndpointImplementation() {
    console.log('\n🌐 VERIFICANDO IMPLEMENTAÇÃO DE ENDPOINTS (MONOREPO)\n');

    const checks = {
      'API.1': await this.checkEndpointsStructure(),
      'API.2': await this.checkApiSecurity(),
      'API.3': await this.checkResponseFormats(),
      'API.4': await this.checkErrorHandling(),
    };

    this.results.set('API', checks);
    return checks;
  }

  async checkEndpointsStructure() {
    const check = { id: 'API.1', status: 'PASS', evidence: [], notes: '' };

    try {
      const apiFiles = this.getSourceFiles().filter((file) => {
        const filePath = file.getFilePath();
        return filePath.includes('/src/app/api/') || filePath.includes('/src/pages/api/');
      });

      console.log(`🔍 Encontrados ${apiFiles.length} arquivos de API`);

      const endpointsByModule = new Map();
      const missingMethodHandlers = [];

      for (const file of apiFiles) {
        const filePath = file.getFilePath();
        const content = file.getFullText();

        // Extrair módulo do caminho
        const moduleMatch = filePath.match(/\/src\/(?:app|pages)\/api\/([^/]+)/);
        const module = moduleMatch ? moduleMatch[1] : 'unknown';

        if (!endpointsByModule.has(module)) {
          endpointsByModule.set(module, []);
        }

        const endpoints = endpointsByModule.get(module);
        endpoints.push(path.relative(process.cwd(), filePath));

        // Verificar métodos HTTP suportados
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
        const hasMethod = methods.some(
          (method) =>
            content.includes(`export async function ${method}`) ||
            content.includes(`export const ${method}`),
        );

        if (!hasMethod) {
          missingMethodHandlers.push(path.basename(filePath));
        }
      }

      // Evidências
      check.evidence.push(
        `Módulos de API encontrados: ${Array.from(endpointsByModule.keys()).join(', ')}`,
      );

      for (const [module, files] of endpointsByModule) {
        check.evidence.push(`${module}: ${files.length} endpoints`);
      }

      if (missingMethodHandlers.length > 0) {
        check.status = 'WARNING';
        check.notes = `${missingMethodHandlers.length} endpoints sem handlers de método HTTP explícitos`;
      }
    } catch (error) {
      check.status = 'ERROR';
      check.notes = `Erro: ${error.message}`;
    }

    this.updateStats(check.status);
    return check;
  }

  async checkApiSecurity() {
    const check = { id: 'API.2', status: 'PASS', evidence: [], notes: '' };

    try {
      const securityPatterns = {
        authCheck: ['auth.getSession()', 'getUser()', 'requireAuth'],
        schoolIdCheck: ['escola_id', 'schoolId'],
        rlsCheck: ['supabase.from().eq', 'supabase.from().select'],
        permissionCheck: ['role', 'permission', 'authorize'],
      };

      const apiFiles = this.getSourceFiles().filter((file) => {
        const filePath = file.getFilePath();
        return (
          (filePath.includes('/src/app/api/') && filePath.endsWith('/route.ts')) ||
          (filePath.includes('/src/pages/api/') && filePath.match(/\.(ts|js)$/))
        );
      });

      const securityIssues = [];
      let secureEndpoints = 0;

      for (const file of apiFiles.slice(0, 50)) {
        // Amostra de 50 endpoints
        const content = file.getFullText();
        const filePath = path.relative(process.cwd(), file.getFilePath());

        const hasAuth = securityPatterns.authCheck.some((pattern) => content.includes(pattern));
        const hasSchoolId = securityPatterns.schoolIdCheck.some((pattern) => content.includes(pattern));
        const hasRls = securityPatterns.rlsCheck.some((pattern) => content.includes(pattern));

        if (!hasAuth && !hasRls) {
          securityIssues.push(`${filePath}: Sem verificação de autenticação ou RLS`);
        } else if (!hasSchoolId && content.includes('escola_id')) {
          securityIssues.push(`${filePath}: Escola_id mencionada mas não verificada`);
        } else {
          secureEndpoints++;
        }
      }

      if (securityIssues.length > 0) {
        check.status = securityIssues.length > 5 ? 'FAIL' : 'WARNING';
        check.evidence = securityIssues.slice(0, 5);
        check.notes = `${securityIssues.length} endpoints com possíveis problemas de segurança`;
      } else {
        check.evidence = [`✅ ${secureEndpoints} endpoints analisados com segurança adequada`];
      }
    } catch (error) {
      check.status = 'ERROR';
      check.notes = `Erro: ${error.message}`;
    }

    this.updateStats(check.status);
    return check;
  }

  async checkResponseFormats() {
    const check = { id: 'API.3', status: 'PASS', evidence: [], notes: '' };

    try {
      const apiFiles = this.getSourceFiles().filter((file) => {
        const filePath = file.getFilePath();
        return (
          (filePath.includes('/src/app/api/') && filePath.endsWith('/route.ts')) ||
          (filePath.includes('/src/pages/api/') && filePath.match(/\.(ts|js)$/))
        );
      });

      const inconsistentResponses = [];

      for (const file of apiFiles.slice(0, 50)) {
        const content = file.getFullText();
        const filePath = path.relative(process.cwd(), file.getFilePath());
        const usesJsonResponse = content.includes('NextResponse.json') || content.includes('res.json(');
        const usesPlainResponse = content.includes('new Response(') || content.includes('res.send(');

        if (usesJsonResponse && usesPlainResponse) {
          inconsistentResponses.push(`${filePath}: mistura JSON e texto/Response bruto`);
        }
      }

      if (inconsistentResponses.length > 0) {
        check.status = 'WARNING';
        check.evidence = inconsistentResponses.slice(0, 5);
        check.notes = `${inconsistentResponses.length} endpoints com formatos mistos de resposta`;
      } else {
        check.evidence = ['✅ Padrões de resposta consistentes na amostra'];
      }
    } catch (error) {
      check.status = 'ERROR';
      check.notes = `Erro: ${error.message}`;
    }

    this.updateStats(check.status);
    return check;
  }

  async checkErrorHandling() {
    const check = { id: 'API.4', status: 'PASS', evidence: [], notes: '' };

    try {
      const apiFiles = this.getSourceFiles().filter((file) => {
        const filePath = file.getFilePath();
        return (
          (filePath.includes('/src/app/api/') && filePath.endsWith('/route.ts')) ||
          (filePath.includes('/src/pages/api/') && filePath.match(/\.(ts|js)$/))
        );
      });

      const missingHandling = [];

      for (const file of apiFiles.slice(0, 50)) {
        const content = file.getFullText();
        const filePath = path.relative(process.cwd(), file.getFilePath());
        const hasTryCatch = content.includes('try {') && content.includes('catch (');
        const hasErrorResponse =
          content.includes('NextResponse.json') && content.includes('status: 4');

        if (!hasTryCatch && !hasErrorResponse) {
          missingHandling.push(`${filePath}: sem tratamento explícito de erro`);
        }
      }

      if (missingHandling.length > 0) {
        check.status = 'WARNING';
        check.evidence = missingHandling.slice(0, 5);
        check.notes = `${missingHandling.length} endpoints sem tratamento explícito de erros`;
      } else {
        check.evidence = ['✅ Tratamento de erros presente na amostra'];
      }
    } catch (error) {
      check.status = 'ERROR';
      check.notes = `Erro: ${error.message}`;
    }

    this.updateStats(check.status);
    return check;
  }

  // ====================
  // 🎨 VERIFICAÇÃO DE COMPONENTES UI
  // ====================

  async checkUIComponents() {
    console.log('\n🎨 VERIFICANDO COMPONENTES UI (MONOREPO)\n');

    const checks = {
      'UI.1': await this.checkComponentImports(),
      'UI.2': await this.checkComponentStructure(),
      'UI.3': await this.checkUIErrorHandling(),
    };

    this.results.set('UI', checks);
    return checks;
  }

  async checkComponentImports() {
    const check = { id: 'UI.1', status: 'PASS', evidence: [], notes: '' };

    try {
      const componentFiles = this.getSourceFiles().filter((file) => {
        const filePath = file.getFilePath();
        return filePath.includes('/components/') && (filePath.endsWith('.tsx') || filePath.endsWith('.jsx'));
      });

      console.log(`🔍 Analisando ${componentFiles.length} componentes...`);

      const importStats = {
        react: 0,
        next: 0,
        supabase: 0,
        uiLibrary: 0,
        internal: 0,
      };

      for (const file of componentFiles.slice(0, 100)) {
        // Amostra
        const content = file.getFullText();

        if (content.includes('import React') || content.includes('from "react"')) importStats.react++;
        if (content.includes('import {') && content.includes('next/')) importStats.next++;
        if (content.includes('@supabase/') || content.includes('supabase-')) importStats.supabase++;
        if (content.includes('@radix-ui/') || content.includes('@/components/ui/')) importStats.uiLibrary++;

        // Verificar imports internos quebrados
        const internalImports = content.match(/from ['"]@\/[^'"]+['"]/g) || [];
        for (const imp of internalImports) {
          const importPath = imp.match(/from ['"](@\/[^'"]+)['"]/)[1];
          if (importPath.includes('components/') || importPath.includes('lib/')) {
            importStats.internal++;
          }
        }
      }

      check.evidence.push(`React: ${importStats.react} componentes`);
      check.evidence.push(`Next.js: ${importStats.next} componentes`);
      check.evidence.push(`Supabase: ${importStats.supabase} componentes`);
      check.evidence.push(`UI Library: ${importStats.uiLibrary} componentes`);
      check.evidence.push(`Imports internos: ${importStats.internal}`);
    } catch (error) {
      check.status = 'ERROR';
      check.notes = `Erro: ${error.message}`;
    }

    this.updateStats(check.status);
    return check;
  }

  async checkComponentStructure() {
    const check = { id: 'UI.2', status: 'PASS', evidence: [], notes: '' };

    try {
      const componentFiles = this.getSourceFiles().filter((file) => {
        const filePath = file.getFilePath();
        return filePath.includes('/components/') && (filePath.endsWith('.tsx') || filePath.endsWith('.jsx'));
      });

      const structuralIssues = [];

      for (const file of componentFiles.slice(0, 100)) {
        const content = file.getFullText();
        const filePath = path.relative(process.cwd(), file.getFilePath());
        const usesDefaultExport = content.includes('export default');
        const usesNamedExport = content.includes('export function') || content.includes('export const');

        if (usesDefaultExport && usesNamedExport) {
          structuralIssues.push(`${filePath}: mistura export default e named exports`);
        }
      }

      if (structuralIssues.length > 0) {
        check.status = 'WARNING';
        check.evidence = structuralIssues.slice(0, 5);
        check.notes = `${structuralIssues.length} componentes com exportações misturadas`;
      } else {
        check.evidence = ['✅ Estrutura de exports consistente na amostra'];
      }
    } catch (error) {
      check.status = 'ERROR';
      check.notes = `Erro: ${error.message}`;
    }

    this.updateStats(check.status);
    return check;
  }

  async checkUIErrorHandling() {
    const check = { id: 'UI.3', status: 'PASS', evidence: [], notes: '' };

    try {
      const componentFiles = this.getSourceFiles().filter((file) => {
        const filePath = file.getFilePath();
        return filePath.includes('/components/') && (filePath.endsWith('.tsx') || filePath.endsWith('.jsx'));
      });

      const missingStates = [];

      for (const file of componentFiles.slice(0, 100)) {
        const content = file.getFullText();
        const filePath = path.relative(process.cwd(), file.getFilePath());
        const hasLoadingState = content.includes('loading') || content.includes('isLoading');
        const hasErrorState = content.includes('error') || content.includes('isError');

        if (!hasLoadingState && !hasErrorState) {
          missingStates.push(`${filePath}: sem estados de loading/error`);
        }
      }

      if (missingStates.length > 0) {
        check.status = 'WARNING';
        check.evidence = missingStates.slice(0, 5);
        check.notes = `${missingStates.length} componentes sem estados explícitos de loading/error`;
      } else {
        check.evidence = ['✅ Estados de loading/error presentes na amostra'];
      }
    } catch (error) {
      check.status = 'ERROR';
      check.notes = `Erro: ${error.message}`;
    }

    this.updateStats(check.status);
    return check;
  }

  // ====================
  // 📊 RELATÓRIO MONOREPO
  // ====================

  async generateMonorepoReport() {
    console.log('\n📊 GERANDO RELATÓRIO MONOREPO\n');

    let report = `# RELATÓRIO DE VALIDAÇÃO KLASSE - MONOREPO EDITION\n\n`;
    report += `**Data**: ${new Date().toISOString()}\n`;
    report += `**Arquivos carregados**: ${this.getSourceFiles().length}\n\n`;
    if (this.warnings.length > 0) {
      report += `**Avisos**:\n`;
      this.warnings.forEach((warning) => {
        report += `- ${warning}\n`;
      });
      report += '\n';
    }

    // Estatísticas de arquivos
    const sourceFiles = this.getSourceFiles();
    const fileTypes = {
      components: sourceFiles.filter((f) => f.getFilePath().includes('/components/')).length,
      pages: sourceFiles.filter((f) => f.getFilePath().includes('/app/') && f.getFilePath().includes('page'))
        .length,
      api: sourceFiles.filter((f) => f.getFilePath().includes('/api/')).length,
      hooks: sourceFiles.filter((f) => f.getFilePath().includes('/hooks/')).length,
      lib: sourceFiles.filter((f) => f.getFilePath().includes('/lib/')).length,
    };

    report += `## 📁 ESTATÍSTICAS DO MONOREPO\n\n`;
    report += `| Tipo | Quantidade |\n`;
    report += `|------|------------|\n`;
    Object.entries(fileTypes).forEach(([type, count]) => {
      report += `| ${type} | ${count} |\n`;
    });

    report += `\n## 📈 STATUS DAS VERIFICAÇÕES\n\n`;

    for (const [category, checks] of this.results) {
      const passed = Object.values(checks).filter((c) => c.status === 'PASS').length;
      const total = Object.keys(checks).length;

      report += `### ${category} (${passed}/${total} ✅)\n\n`;

      for (const [id, check] of Object.entries(checks)) {
        const statusIcon =
          {
            PASS: '✅',
            WARNING: '⚠️',
            FAIL: '❌',
            SKIP: '🔄',
            ERROR: '💥',
          }[check.status] || '❓';

        report += `#### ${statusIcon} ${id}: ${check.status}\n`;
        report += `${check.notes}\n\n`;

        if (check.evidence && check.evidence.length > 0) {
          report += `**Evidências**:\n`;
          check.evidence.slice(0, 3).forEach((ev) => {
            report += `- ${ev}\n`;
          });
          if (check.evidence.length > 3) {
            report += `- ... e mais ${check.evidence.length - 3}\n`;
          }
        }
        report += `\n`;
      }
    }

    // Recomendações específicas para monorepo
    report += `## 🎯 RECOMENDAÇÕES PARA MONOREPO\n\n`;

    const apiChecks = this.results.get('API');
    if (apiChecks && Object.values(apiChecks).some((c) => c.status === 'FAIL')) {
      report += `1. **Padronizar APIs**: Resolver inconsistências nos endpoints\n`;
    }

    const uiChecks = this.results.get('UI');
    if (uiChecks && Object.values(uiChecks).some((c) => c.status === 'FAIL')) {
      report += `2. **Consolidar componentes**: Reduzir duplicação entre apps\n`;
    }

    const serviceRoleCheck = Object.values(this.results.get('P0') || {}).find((c) => c.id === 'P0.5');
    if (serviceRoleCheck && serviceRoleCheck.status === 'FAIL') {
      report += `3. **Refatorar Service Role**: Remover de endpoints humanos\n`;
    }

    report += `4. **Documentar shared packages**: Garantir que packages/ sejam bem documentados\n`;
    report += `5. **CI/CD para monorepo**: Configurar testes em todos os apps\n`;

    await fs.writeFile('MONOREPO_VALIDATION_REPORT.md', report);
    console.log('✅ Relatório salvo em MONOREPO_VALIDATION_REPORT.md');
  }

  // ====================
  // 🚀 EXECUÇÃO
  // ====================

  async run() {
    try {
      await this.initialize();

      console.log('='.repeat(60));
      console.log('🚀 VALIDAÇÃO DE FLUIDEZ - MONOREPO EDITION');
      console.log('='.repeat(60));

      // Verificações básicas
      await this.validateP0();

      // Verificações específicas de monorepo
      await this.checkEndpointImplementation();
      await this.checkUIComponents();

      // Relatório
      await this.generateMonorepoReport();

      console.log('\n✅ Validação concluída!');
      console.log('📄 Consulte MONOREPO_VALIDATION_REPORT.md para detalhes.');
    } catch (error) {
      console.error('❌ Erro fatal:', error);
      throw error;
    } finally {
      if (this.sql) {
        await this.sql.end();
      }
    }
  }

  // Métodos auxiliares (simplificados para o exemplo)
  async validateP0() {
    const checks = {
      'P0.5': await this.checkServiceRoleUsageMonorepo(),
      // Adicione outras verificações P0 aqui
    };
    this.results.set('P0', checks);
  }

  updateStats(status) {
    this.stats.total++;
    switch (status) {
      case 'PASS':
        this.stats.passed++;
        break;
      case 'WARNING':
        this.stats.warning++;
        break;
      case 'FAIL':
        this.stats.failed++;
        break;
      default:
        this.stats.skipped++;
        break;
    }
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new MonorepoFluencyValidator();
  validator.run().catch(console.error);
}

export { MonorepoFluencyValidator };
