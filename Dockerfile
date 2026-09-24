# Dockerfile — Multi-arch (ARM64 + AMD64) for Oracle Cloud A1 / x86 VPS
FROM --platform=$BUILDPLATFORM node:24-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:24-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Copy application source
COPY src ./src

# Create persistent data directory with correct permissions
RUN mkdir -p /data && chown -R appuser:appgroup /data /app

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit1))"

# Switch to non-root user
USER appuser

# Start application
CMD ["node", "--experimental-strip-types", "src/server.ts"]
