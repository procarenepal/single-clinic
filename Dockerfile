# Use Node.js 18 Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY sms-backend/package*.json ./sms-backend/

# Install all dependencies (including devDependencies for build)
RUN npm install
RUN cd sms-backend && npm install

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm prune --production
RUN cd sms-backend && npm prune --production

# Create logs directory
RUN mkdir -p logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start application
CMD ["npm", "start"]
