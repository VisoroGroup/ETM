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

# Copy server build and deps
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/package-lock.json ./server/package-lock.json
COPY --from=builder /app/server/src/database ./server/src/database

# Copy client build
COPY --from=builder /app/client/dist ./client/dist

# Install production deps only
WORKDIR /app/server
RUN npm ci --omit=dev

# tsx needed for migrations
RUN npm install tsx

EXPOSE 8080

# Run migrations then start server
CMD ["sh", "-c", "npx tsx src/database/migrate.ts && node dist/app.js"]
