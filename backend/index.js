// // backend/index.js
// const express = require("express");
// const app = express();
// const PORT = process.env.PORT || 5000;
// const http = require("http");
// const {Server} = require("socket.io");
// const server = http.createServer(app);
// const io = new Server(server);
// const cors = require("cors");
// app.use(cors());

// app.use(express.json());

// app.get("/api/game-data", (req, res) => {
// 	res.json({message: "Game data here"});
// });

// const players = {};

// // When a player connects

// server.listen(3001, () => {
// 	console.log("Server running on port 3001");
// });

// app.listen(PORT, () => {
// 	console.log(`Server is running on http://localhost:${PORT}`);
// });

const express = require("express");
const http = require("http");
const {Server} = require("socket.io");
const {v4: uuidv4} = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: "*",
		methods: ["GET", "POST"],
	},
});

// Store connected players
const players = new Map();

io.on("connection", (socket) => {
	console.log("A player connected");

	// Generate unique ID for the player
	const playerId = uuidv4();

	// Initialize player
	players.set(playerId, {
		id: playerId,
		position: {x: 0, y: 1, z: 0},
		rotation: {yaw: 0, pitch: 0},
		color: "#" + Math.floor(Math.random() * 16777215).toString(16), // Random color
	});

	// Send current player ID and existing players to the new player
	socket.emit("playerInit", {
		playerId,
		players: Array.from(players.values()),
	});

	// Broadcast new player to all other players
	socket.broadcast.emit("playerJoined", players.get(playerId));

	// Handle player movement updates
	socket.on("playerMove", (data) => {
		const player = players.get(data.playerId);
		if (player) {
			player.position = data.position;
			player.rotation = data.rotation;
			socket.broadcast.emit("playerMoved", {
				playerId: data.playerId,
				position: data.position,
				rotation: data.rotation,
			});
		}
	});

	// Handle shooting
	socket.on("playerShoot", (data) => {
		socket.broadcast.emit("bulletFired", {
			playerId: data.playerId,
			position: data.position,
			direction: data.direction,
		});
	});

	// Handle disconnection
	socket.on("disconnect", () => {
		console.log("A player disconnected");
		players.delete(playerId);
		io.emit("playerLeft", playerId);
	});
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
	console.log(`Game server running on port ${PORT}`);
});
