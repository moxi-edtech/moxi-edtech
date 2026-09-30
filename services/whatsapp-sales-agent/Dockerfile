FROM node:22-alpine
WORKDIR /app
COPY package.json agent.mjs knowledge.md response-policy.mjs ./
USER node
CMD ["node", "agent.mjs"]
