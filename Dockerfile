# Stage 1: build the React frontend
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: runtime — Express serves the built frontend + JSON API
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY server ./server
COPY --from=build /app/dist ./dist

EXPOSE 8473
CMD ["node", "server/index.js"]
