# Track the latest stable Node.js release
FROM node:26.12.1-alpine AS builder

# Set the working directory
WORKDIR /usr/src/app

# Install the package manager pinned by this repository
COPY package.json ./
RUN npm install --global "$(node -p 'require("./package.json").packageManager')"
COPY pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Build the application
RUN pnpm run build

EXPOSE 3000

# Command to run the application
CMD ["pnpm", "run", "serve", "--address", "0.0.0.0"]
