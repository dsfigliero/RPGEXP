# Stage 1: build do frontend React
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: servidor Express em produção
FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=client-builder /app/client/dist ./public
RUN mkdir -p /var/data
EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
