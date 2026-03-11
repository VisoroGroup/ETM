# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy everything
COPY . .

# Build client
WORKDIR /app/client
RUN npm install
RUN npm run build

# Build server
WORKDIR /app/server
RUN npm install
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Copy server build and ALL source (needed for tsx migrations)
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/src ./server/src
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/package-lock.json ./server/package-lock.json

# Copy client build
COPY --from=builder /app/client/dist ./client/dist

# Copy root .env if exists
COPY --from=builder /app/.env* ./

# Install production deps + tsx for migrations
WORKDIR /app/server
RUN npm ci --omit=dev
RUN npm install tsx

EXPOSE 8080

# Run migrations then start server
CMD ["sh", "-c", "npx tsx src/database/migrate.ts && node dist/app.js"]
