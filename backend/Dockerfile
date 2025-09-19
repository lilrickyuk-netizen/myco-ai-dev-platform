# Backend Dockerfile for Encore.ts
FROM node:20-alpine

# Install curl for health checks and Encore CLI
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Install Encore CLI globally
RUN npm install -g @encore.dev/encore@latest

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001 -G appuser

# Change ownership
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["encore", "run", "--port", "3001"]