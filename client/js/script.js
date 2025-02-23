const socket = io();

// -----------------------
// DOM Element References
// -----------------------
const loginContainer = document.getElementById('login');
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const usernamePlaceholder = document.getElementById('usernamePlaceholder');
const roomInput = document.getElementById('room');
const chatContainer = document.getElementById('chatContainer');
const chatMessages = document.getElementById('chatMessages');
const scroller = document.querySelector('.scroller');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const roomNameElement = document.getElementById('roomName');
const typingIndicator = document.getElementById('typingIndicator');
const usersList = document.getElementById('usersList');
const totalUsersCount = document.getElementById('total-users-count');



// -----------------------
// Global Variables
// -----------------------
let offset = 0;         // For Paginations
const limit = 10;       // On each Request load 10 messages
let loading = false;    // Flag to prevent duplicate loads
let typingTimer;
let activeTypers = {};
let currentUser = '';
const colors = [
	'bg-gray-200',
	'bg-blue-200',
	'bg-red-200',
	'bg-green-200',
	'bg-yellow-200',
	'bg-purple-200',
	'bg-indigo-200',
	'bg-teal-200',
	'bg-pink-200'
];


// -----------------------
// Helper Functions
// -----------------------

/**
 * Formats a Date object as "hh:mm:ss - dd.mm.yyyy" in 24-hour format.
 * @param {*} date 
 * @returns {String} - Formatted data
 */
function formatDate(date) {
	const day = String(date.getDate()).padStart(2, '0');
	const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed.
	const year = date.getFullYear();
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const seconds = String(date.getSeconds()).padStart(2, '0');

	return `${hours}:${minutes}:${seconds} - ${day}.${month}.${year}`;
}

/**
 * Creates and appends a button for a user in the online users list.
 * @param {HTMLElement} listElement 
 * @param {object} user 
 */
function createChatButton(listElement, user) {
	const button = document.createElement('button');
	button.dataset.socketid = user.socketId;
	button.classList.add(
		'flex',
		'flex-row',
		'items-center',
		'hover:bg-gray-100',
		'rounded-xl',
		'p-2',
		'cursor-pointer'
	);

	const avatar = document.createElement('div');
	avatar.classList.add('flex', 'items-center', 'justify-center', 'h-8', 'w-8', 'rounded-full');
	avatar.textContent = user.username[0].toUpperCase();
	const randomColor = colors[Math.floor(Math.random() * colors.length)];
	avatar.classList.add(randomColor);

	const usernameDiv = document.createElement('div');
	usernameDiv.classList.add('ml-2', 'text-sm', 'font-semibold');
	usernameDiv.textContent = user.username;

	button.appendChild(avatar);
	button.appendChild(usernameDiv);

	button.addEventListener('click', () => {
		sendPrivateMessage(user);
	});

	listElement.appendChild(button);
}


/**
 * Prompts the user to send a private message and emits it to the server.
 * @param {object} user 
 */
function sendPrivateMessage(user) {
	const privateMsg = prompt(`Send private message to ${user.username}:`);
	if (privateMsg) {
		socket.emit('privateMessage', { recipientSocketId: user.socketId, msg: privateMsg });
	}
}


/**
 * Updates the typing indicator by removing inactive typers.
 */
function updateTypingIndicator() {
	const now = Date.now();
	for (const username in activeTypers) {
		if (now - activeTypers[username] > 1100) {
			delete activeTypers[username];
		}
	}
	const typers = Object.keys(activeTypers);
	typingIndicator.innerText = typers.length ? typers.join(', ') + ' is typing...' : '';
}



// -----------------------
// Event Listeners
// -----------------------

/**
 * Update the typing indicator every 500ms.
 */
setInterval(updateTypingIndicator, 500);


/**
 * Login form submission: join the chat room.
 */
loginForm.addEventListener('submit', (e) => {
	e.preventDefault();
	const username = usernameInput.value.trim();
	const room = roomInput.value.trim();
	if (username && room) {
		currentUser = username;
		usernamePlaceholder.innerText = username;
		socket.emit('joinRoom', { username, room });
		roomNameElement.innerText = room;

		loginContainer.style.display = 'none';
		chatContainer.style.display = 'block';
	}
});


/**
 * Display previous messages and scroll to the bottom.
 */
socket.on('previousMessages', (messages) => {
	messages.forEach(displayMessage);
	scroller.scrollTop = scroller.scrollHeight;
});


/**
 * Listen for new public messages.
 */
socket.on('message', (message) => {
	displayMessage(message);
});


/**
 * Listen for private messages and mark them as private.
 */
socket.on('privateMessage', (message) => {
	displayMessage({ ...message, private: true });
});


/**
 * Listen for typing events and update the active typers.
 */
socket.on('typing', (data) => {
	activeTypers[data.username] = Date.now();
	updateTypingIndicator();
});


/**
 * Listen for stop typing events.
 */
socket.on('stopTyping', (data) => {
	delete activeTypers[data.username];
	updateTypingIndicator();
});


/**
 * Update the list of online users (excluding the current user).
 */
socket.on('onlineUsers', (users) => {
	usersList.innerHTML = '';
	const filteredUsers = users.filter(user => user.socketId !== socket.id);
	totalUsersCount.innerText = filteredUsers.length;
	filteredUsers.forEach(user => createChatButton(usersList, user));
});


/**
 * Handle public message submission.
 */
messageForm.addEventListener('submit', (e) => {
	e.preventDefault();
	const msg = messageInput.value.trim();
	if (msg) {
		socket.emit('chatMessage', msg);
		messageInput.value = '';
	}
});

/**
 * Emit typing events with debounce: send "typing" immediately, then "stopTyping" after 1 second of inactivity.
 */
messageInput.addEventListener('input', () => {
	socket.emit('typing');
	clearTimeout(typingTimer);
	typingTimer = setTimeout(() => {
		socket.emit('stopTyping');
	}, 1000);
});


/**
 * Auto-load older messages when scrolling near the top of the chat container.
 */
scroller.addEventListener('scroll', () => {
	if (scroller.scrollTop < 50 && !loading) {
		loading = true;
		offset += limit;
		socket.emit('loadMoreMessages', { offset, limit });
	}
});


/**
 * Prepend older messages and adjust the scroll position to maintain the view.
 */
socket.on('moreMessages', (messages) => {
	const oldScrollHeight = scroller.scrollHeight;
	messages.forEach(message => displayMessage(message, false));
	const newScrollHeight = scroller.scrollHeight;
	scroller.scrollTop = newScrollHeight - oldScrollHeight;
	loading = false;
});


/**
 * Message Rendering
 * @param {object} message 
 * @param {boolean} append 
 * Displays a chat message in the chat container.
 * If append is true, the message is added to the bottom; otherwise, it's prepended (used for pagination).
 */
function displayMessage(message, append = true) {
	let messageHTML = '';

	if (message.username === 'System') {
		messageHTML = `
		<div class="col-start-1 col-end-12 p-3 rounded-lg">
			<div class="flex items-center justify-center">
			<div class="relative text-xs text-center bg-grey-100 py-1 px-2 shadow rounded-xl">
				<p>${message.text}</p>
				<span class="timestamp">${formatDate(new Date(message.time))}</span>
			</div>
			</div>
		</div>
    	`;
	} else if (message.username === currentUser) {
		messageHTML = `
			<div class="col-start-6 col-end-13 p-3 rounded-lg">
				<div class="flex items-center justify-start flex-row-reverse">
				<div class="flex items-center justify-center h-10 w-10 rounded-full bg-blue-500 flex-shrink-0">
					${message.username[0].toUpperCase()}
				</div>
				<div class="relative mr-3 text-sm ${message.private ? 'bg-red-100' : 'bg-blue-100'} py-2 px-4 shadow rounded-xl">
					<p>${message.text}</p>
					<span class="timestamp">${formatDate(new Date(message.time))}</span>
				</div>
				</div>
			</div>
    	`;
	} else { // Messages sent by other users
		messageHTML = `
			<div class="col-start-1 col-end-8 p-3 rounded-lg">
				<div class="flex flex-row items-center">
				<div class="flex items-center justify-center h-10 w-10 rounded-full bg-blue-500 flex-shrink-0">
					${message.username[0].toUpperCase()}
				</div>
				<div class="relative ml-3 text-sm ${message.private ? 'bg-red-100' : 'bg-white'} py-2 px-4 shadow rounded-xl">
					<p>${message.text}</p>
					<span class="timestamp">${formatDate(new Date(message.time))}</span>
				</div>
				</div>
			</div>
			`;
	}

	const tempDiv = document.createElement('div');
	tempDiv.innerHTML = messageHTML.trim();

	if (append) {
		chatMessages.appendChild(tempDiv.firstChild);
		scroller.scrollTop = scroller.scrollHeight;
	} else {
		chatMessages.prepend(tempDiv.firstChild);
	}
}