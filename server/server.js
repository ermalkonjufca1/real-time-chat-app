import express from 'express';
import http from 'http';
import path from 'path';
import 'dotenv/config';
import { Server } from 'socket.io';
import chatHandler from './socket/chat.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const __dirname = path.resolve();

app.use(express.static(path.join(__dirname, '../client')));

io.on('connection', (socket) => {
  chatHandler(socket, io);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));