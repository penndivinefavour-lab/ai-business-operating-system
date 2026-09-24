# Dockerfile for blitz.cloud (and general Docker hosting)
# Requirements: non-root, port 8080, amd64, persistent volume
FROM node:24-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:24-alpine

WORKDIR /app

# Create non-root user (required by blitz.cloud)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Copy application source
COPY src ./src

# Create persistent data directory with correct permissions
RUN mkdir -p /data && chown -R appuser:appgroup /data /app

# Declare volume for SQLite persistence across restarts
VOLUME ["/data"]

# blitz.cloud expects port 8080 by default
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Switch to non-root user (required by blitz.cloud)
USER appuser

# Start application
CMD ["node", "--experimental-strip-types", "src/server.ts"]
