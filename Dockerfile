FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production
ENV RUNNING_IN_DOCKER=true
ENV NODE_OPTIONS=--max-old-space-size=256

COPY package*.json ./
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && npm ci --omit=dev \
  && npm cache clean --force \
  && apt-get purge -y --auto-remove python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY . .

CMD ["node", "index.js"]
