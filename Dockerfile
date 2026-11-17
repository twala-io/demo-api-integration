# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app
RUN chown node:node /app
USER node

# All dependencies, for building and for development.
FROM base AS deps
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

# Development: server and Vite with reload. Used by the `dev` service in
# compose.yaml, which syncs source changes into the container.
FROM deps AS dev
COPY --chown=node:node . .
EXPOSE 5180
CMD ["npx", "concurrently", "-n", "server,web", "-c", "blue,magenta", "npm:dev:server", "npm:dev:web -- --host 0.0.0.0"]

# Build the UI into web/dist and compile the server into dist.
FROM deps AS build
COPY --chown=node:node . .
RUN npm run build && npm run build:server

FROM base AS prod-deps
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

# Production: one Node process serves the API and the built UI.
FROM base AS runtime
ENV NODE_ENV=production
COPY --chown=node:node package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/web/dist ./web/dist
EXPOSE 3180
CMD ["node", "dist/server/src/index.js"]
