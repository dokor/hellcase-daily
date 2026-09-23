FROM mcr.microsoft.com/playwright:v1.55.0-noble

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

CMD ["npm", "run", "daily"]
