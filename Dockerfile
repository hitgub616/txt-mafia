FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json ./

# Copy only server files (to minimize dependencies)
COPY server ./server/
COPY environment-variables.ts ./

# Install dependencies without frozen-lockfile
RUN pnpm install --no-frozen-lockfile

# Set environment variables
ENV CLIENT_URL="https://v0-txt-mafia-o3hnz9r54-ryan616s-projects.vercel.app"
ENV PORT=3001

# Expose the port
EXPOSE ${PORT:-3001}

# Start the server
CMD ["node", "server/index.js"]
