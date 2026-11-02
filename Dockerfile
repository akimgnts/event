FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app /app
EXPOSE 3000
CMD ["node", "deploy/launch.mjs", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0"]
