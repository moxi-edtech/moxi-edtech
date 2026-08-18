FROM node:22-alpine
WORKDIR /app
COPY package.json agent.mjs knowledge.md ./
USER node
CMD ["node", "agent.mjs"]
