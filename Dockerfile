FROM node:18-alpine

RUN npm install -g pnpm
ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

COPY . .

RUN ls -la apps/web/src/app/api/escolas/[id]/configuracoes/status/

# Install and build
RUN pnpm install --frozen-lockfile
RUN cd apps/web && npx next build

EXPOSE 3000

CMD ["pnpm", "--filter", "web", "start"]
