# Multi-stage Dockerfile for validation-4 frontend (React/Vite)
# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy frontend package files
COPY frontend/package.json frontend/package-lock.json* ./

# Install dependencies
RUN npm install --prefer-offline

# Copy frontend source
COPY frontend/ ./

# Build the React app
RUN npm run build

# Stage 2: Runtime (serve static files)
FROM node:20-alpine AS runtime

# Install a lightweight static file server
RUN npm install -g serve@14

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 5173

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5173/ || exit 1

CMD ["serve", "-s", "dist", "-l", "5173"]
