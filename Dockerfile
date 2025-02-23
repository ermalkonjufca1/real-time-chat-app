FROM node:22-alpine

WORKDIR /usr/src/app/server

COPY server/package*.json ./

RUN npm install

COPY server/ .

COPY client/ ../client

EXPOSE 3000

CMD ["node", "server.js"]