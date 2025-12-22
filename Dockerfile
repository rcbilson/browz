FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Set default environment variables
ENV PORT=3000
ENV ROOT_DIR=/data

# Create data directory
RUN mkdir -p /data

# Start the application
CMD ["node", "server.js"]
