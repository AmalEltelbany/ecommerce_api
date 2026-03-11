# ─── Stage: base ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# ─── Stage: development ───────────────────────────────────────────────────────
FROM base AS development
RUN npm install
COPY . .
EXPOSE 8000
CMD ["npm", "run", "start:dev"]

# ─── Stage: production ────────────────────────────────────────────────────────
FROM base AS production
# ci installs exact versions from lockfile; --only=production skips devDeps
RUN npm ci --only=production
COPY . .
# Run as non-root for security
USER node
EXPOSE 8000
CMD ["node", "server.js"]
