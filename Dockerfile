FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV RUNNING_IN_DOCKER=true

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

CMD ["node", "index.js"]
