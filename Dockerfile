FROM node:24-alpine

# Create app directory
WORKDIR /app

# Install ffmpeg for video transcoding and thumbnail generation
RUN apk add --no-cache ffmpeg

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

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
