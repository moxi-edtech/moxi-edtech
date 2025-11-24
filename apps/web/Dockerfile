# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.12.2 --activate

FROM base AS builder

# Variáveis necessárias
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY  
ARG SUPABASE_SERVICE_ROLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Copiar APENAS os arquivos necessários para evitar conflitos
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/tenant-sdk/package.json packages/tenant-sdk/package.json

# Instalar TODAS as dependências de uma vez (incluindo devDependencies)
RUN pnpm install --frozen-lockfile --prod=false

# Agora copiar o resto do código
COPY . .

# Instalar TypeScript explicitamente para evitar o erro
RUN cd apps/web && pnpm add --save-dev typescript@latest

# Build sem conflitos
RUN pnpm --filter web build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

USER node

# Copiar build output
COPY --chown=node:node --from=builder /app/apps/web/.next/standalone ./
COPY --chown=node:node --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --chown=node:node --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
