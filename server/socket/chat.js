import { client, publisher, subscriber } from '../config/redis.js';
import SERVER_ID from '../config/serverID.js';

class ChatHandler {
	static onlineUsers = {};
	static subscribedRooms = new Set();

	constructor(socket, io) {
		this.socket = socket;
		this.io = io;
		this.init();
	}

	async init() {
		await this.initPrivateSubscriber();
		this.bindEvents();
	}

	// Helper for getting current timestamp
	getCurrentTimestamp() {
		return new Date().toISOString();
	}

	async initPrivateSubscriber() { // Create a dedicated private subscriber for this socket
		this.socket.privateSubscriber = client.duplicate();
		this.socket.privateSubscriber.on('error', (e) => console.error('Private Subscriber Error', e));
		await this.socket.privateSubscriber.connect();
		await this.socket.privateSubscriber.subscribe(`private:${this.socket.id}`, (message) => {
			try {
				const parsedMessage = JSON.parse(message);
				this.socket.emit('privateMessage', parsedMessage);
			} catch (e) {
				console.error('Error parsing private message:', e);
			}
		});
	}

	bindEvents() {
		this.socket.on('joinRoom', this.joinRoom.bind(this));
		this.socket.on('chatMessage', this.chatMessage.bind(this));
		this.socket.on('typing', this.typing.bind(this));
		this.socket.on('stopTyping', this.stopTyping.bind(this));
		this.socket.on('loadMoreMessages', this.loadMoreMessages.bind(this));
		this.socket.on('privateMessage', this.handlePrivateMessage.bind(this));
		this.socket.on('leaveRoom', this.leaveRoom.bind(this));
		this.socket.on('disconnect', this.disconnect.bind(this));
	}

	static updateOnlineUsers(io, room) {
		const usersInRoom = Object.values(ChatHandler.onlineUsers).filter(
			(u) => u.room === room
		);
		io.to(room).emit('onlineUsers', usersInRoom);
	}

	async joinRoom({ username, room }) {
		this.socket.join(room);
		this.socket.username = username;
		this.socket.room = room;

		ChatHandler.onlineUsers[this.socket.id] = {
			username,
			room,
			socketId: this.socket.id,
		};

		ChatHandler.updateOnlineUsers(this.io, room);

		// Subscribe to room channel if not already subscribed
		if (!ChatHandler.subscribedRooms.has(room)) {
			await subscriber.subscribe(`room:${room}`, (message) => {
				try {
					const parsedMessage = JSON.parse(message);
					// Only emit if the message comes from another instance
					if (parsedMessage.serverId !== SERVER_ID) {
						this.io.to(room).emit('message', parsedMessage);
					}
				} catch (e) {
					console.error('Error parsing room message:', e);
				}
			});
			ChatHandler.subscribedRooms.add(room);
		}

		// Retrieve and send last 10 messages from Redis
		try {
			const messages = await client.lRange(`messages:${room}`, -10, -1);
			this.socket.emit('previousMessages', messages.map((msg) => JSON.parse(msg)));
		} catch (err) {
			console.error('Error retrieving messages:', err);
		}


		this.io.to(room).emit('message', {	// Notify room of the new user join
			username: 'System',
			text: `${username} has joined the chat`,
			time: this.getCurrentTimestamp(),
			serverId: SERVER_ID,
		});
	}

	async chatMessage(msg) {
		if (!this.socket.room) return;
		const messageData = {
			username: this.socket.username,
			text: msg,
			time: this.getCurrentTimestamp(),
			serverId: SERVER_ID,
		};
		try {
			await client.rPush(`messages:${this.socket.room}`, JSON.stringify(messageData));
			await client.lTrim(`messages:${this.socket.room}`, -50, -1);
		} catch (err) {
			console.error('Error saving message:', err);
		}
		this.io.to(this.socket.room).emit('message', messageData);
		publisher.publish(`room:${this.socket.room}`, JSON.stringify(messageData));
	}

	typing() {
		if (this.socket.room) {
			this.socket.to(this.socket.room).emit('typing', {
				username: this.socket.username,
			});
		}
	}

	stopTyping() {
		if (this.socket.room) {
			this.socket.to(this.socket.room).emit('stopTyping', {
				username: this.socket.username,
			});
		}
	}

	async loadMoreMessages({ offset, limit }) {
		if (!this.socket.room) return;
		try {
			const start = -(offset + limit);
			const end = -(offset + 1);
			const messages = await client.lRange(`messages:${this.socket.room}`, start, end);
			this.socket.emit('moreMessages', messages.map((msg) => JSON.parse(msg)));
		} catch (err) {
			console.error('Error loading more messages:', err);
		}
	}

	handlePrivateMessage({ recipientSocketId, msg }) {
		if (!ChatHandler.onlineUsers[recipientSocketId]) {
			this.socket.emit('privateMessage', {
				username: 'System',
				text: 'User is offline',
				time: this.getCurrentTimestamp(),
				private: true,
				serverId: SERVER_ID,
			});
			return;
		}
		const messageData = {
			username: this.socket.username,
			text: msg,
			time: this.getCurrentTimestamp(),
			private: true,
			serverId: SERVER_ID,
		};
		publisher.publish(`private:${recipientSocketId}`, JSON.stringify(messageData));
		this.socket.emit('privateMessage', messageData);
	}

	leaveRoom() {
		if (this.socket.room) {
			this.io.to(this.socket.room).emit('message', {
				username: 'System',
				text: `${this.socket.username} has left the room`,
				time: this.getCurrentTimestamp(),
				serverId: SERVER_ID,
			});
			this.socket.leave(this.socket.room);
			delete ChatHandler.onlineUsers[this.socket.id];
			ChatHandler.updateOnlineUsers(this.io, this.socket.room);
			this.socket.room = null;
		}
	}

	async disconnect() {
		if (this.socket.room) {
			this.io.to(this.socket.room).emit('message', {
				username: 'System',
				text: `${this.socket.username} has disconnected`,
				time: this.getCurrentTimestamp(),
				serverId: SERVER_ID,
			});
			const room = this.socket.room;
			delete ChatHandler.onlineUsers[this.socket.id];
			ChatHandler.updateOnlineUsers(this.io, room);
		}

		if (this.socket.privateSubscriber) {
			try {
				await this.socket.privateSubscriber.unsubscribe(`private:${this.socket.id}`);
				await this.socket.privateSubscriber.quit();
			} catch (e) {
				console.error('Error disconnecting private subscriber', e);
			}
		}
	}
}

export default (socket, io) => new ChatHandler(socket, io);