FROM node:20-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt ./
RUN python3 -m pip install --break-system-packages --no-cache-dir -r requirements.txt
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN npm run build:worker
CMD ["node", "pipeline/worker.js"]
