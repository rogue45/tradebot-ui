# Stage 1: build the static React frontend
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: serve the static build with nginx (pure static — no Node at runtime)
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker-entrypoint.sh /docker-entrypoint.d/40-api-base.sh
RUN chmod +x /docker-entrypoint.d/40-api-base.sh

EXPOSE 80
# nginx:alpine runs /docker-entrypoint.d/*.sh then starts nginx.
