# Use an official Node.js LTS image
FROM node:22-alpine AS builder

# Set the working directory
WORKDIR /usr/src/app

# Install pnpm
RUN npm install -g pnpm

# Copy package.json and pnpm-lock.yaml (if available)
COPY package.json ./
# If you have a pnpm-lock.yaml, uncomment the next line
COPY pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Build the application
RUN pnpm run build

EXPOSE 3000

# Command to run the application
CMD ["pnpm", "run", "serve"]
