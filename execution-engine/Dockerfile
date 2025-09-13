FROM node:18-alpine

WORKDIR /app

# Install Docker CLI (for communicating with Docker daemon)
RUN apk add --no-cache docker-cli

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S execution -u 1001

# Set permissions
RUN chown -R execution:nodejs /app
USER execution

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8001/health || exit 1

# Expose port
EXPOSE 8001

# Start the application
CMD ["npm", "start"]