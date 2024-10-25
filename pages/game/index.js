"use client";
import {useEffect, useRef, useState} from "react";
import * as THREE from "three";

export default function GameMap() {
	const mountRef = useRef(null);
	const [score, setScore] = useState(0); // State to keep track of the score
	const bullets = []; // Array to keep track of active bullets

	useEffect(() => {
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
		const groundLevel = 0;
		const playerHeight = 0.5;

		const playerBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, playerHeight, 0.5), new THREE.MeshStandardMaterial({color: 0x0000ff}));
		playerBox.position.set(0, playerHeight / 2, 0);
		scene.add(playerBox);

		camera.position.set(0, groundLevel + playerHeight, 0);

		const renderer = new THREE.WebGLRenderer({antialias: true});
		renderer.setSize(window.innerWidth, window.innerHeight);
		mountRef.current.appendChild(renderer.domElement);

		const groundGeometry = new THREE.PlaneGeometry(100, 100);
		const groundMaterial = new THREE.MeshStandardMaterial({color: 0x888888});
		const ground = new THREE.Mesh(groundGeometry, groundMaterial);
		ground.rotation.x = -Math.PI / 2;
		scene.add(ground);

		const light = new THREE.DirectionalLight(0xffffff, 1);
		light.position.set(5, 10, 7.5);
		scene.add(light);

		const obstacles = [];
		const cubeColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
		for (let i = 0; i < 10; i++) {
			const color = cubeColors[i % cubeColors.length];
			const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color}));
			cube.position.set((Math.random() - 0.5) * 20, 0.5, (Math.random() - 0.5) * 20);
			scene.add(cube);
			obstacles.push(cube);
		}

		const keys = {w: false, a: false, s: false, d: false};
		const speed = 0.1;
		let yaw = 0;
		let pitch = 0;

		const handleMouseMove = (event) => {
			yaw -= event.movementX * 0.002;
			pitch -= event.movementY * 0.002;
			pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
		};

		const checkCollision = (newPosition) => {
			const playerBB = new THREE.Box3().setFromObject(playerBox);
			for (const obstacle of obstacles) {
				const obstacleBB = new THREE.Box3().setFromObject(obstacle);
				if (playerBB.intersectsBox(obstacleBB)) {
					return true;
				}
			}
			return false;
		};

		const animate = () => {
			requestAnimationFrame(animate);

			const quaternion = new THREE.Quaternion();
			quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
			camera.quaternion.copy(quaternion);

			const cameraDirection = new THREE.Vector3();
			camera.getWorldDirection(cameraDirection);
			cameraDirection.y = 0;
			cameraDirection.normalize();

			const previousPosition = playerBox.position.clone();

			// Player movement logic
			if (keys.w) {
				playerBox.position.add(cameraDirection.clone().multiplyScalar(speed));
			}
			if (keys.s) {
				playerBox.position.sub(cameraDirection.clone().multiplyScalar(speed));
			}
			if (keys.a) {
				const left = new THREE.Vector3().crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();
				playerBox.position.sub(left.multiplyScalar(speed));
			}
			if (keys.d) {
				const right = new THREE.Vector3().crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();
				playerBox.position.add(right.multiplyScalar(speed));
			}

			// Collision check for player
			if (checkCollision(playerBox.position)) {
				playerBox.position.copy(previousPosition);
			}

			camera.position.set(playerBox.position.x, playerBox.position.y + playerHeight, playerBox.position.z);

			// Update bullet positions
			for (let i = bullets.length - 1; i >= 0; i--) {
				const bullet = bullets[i];
				bullet.position.add(bullet.direction.clone().multiplyScalar(bullet.speed));
				bullet.distanceTravelled += bullet.speed;

				// Check for collisions with cubes
				for (const obstacle of obstacles) {
					const obstacleBB = new THREE.Box3().setFromObject(obstacle);
					if (obstacleBB.containsPoint(bullet.position) && bullet.distanceTravelled <= 1000) {
						scene.remove(bullet);
						bullets.splice(i, 1);
						setScore((prevScore) => prevScore + 1); // Increment score
						break; // Exit the loop after hitting one cube
					}
				}

				// Remove the bullet if it travels more than 1000 units
				if (bullet.distanceTravelled > 1000) {
					scene.remove(bullet);
					bullets.splice(i, 1);
				}
			}

			renderer.render(scene, camera);
		};
		animate();

		// Event listeners for key presses
		const handleKeyDown = (e) => {
			if (e.key === "w") keys.w = true;
			if (e.key === "a") keys.a = true;
			if (e.key === "s") keys.s = true;
			if (e.key === "d") keys.d = true;
		};

		const handleKeyUp = (e) => {
			if (e.key === "w") keys.w = false;
			if (e.key === "a") keys.a = false;
			if (e.key === "s") keys.s = false;
			if (e.key === "d") keys.d = false;
		};

		// Enable pointer lock on click
		const enablePointerLock = () => {
			renderer.domElement.requestPointerLock();
		};

		const handlePointerLockChange = () => {
			if (document.pointerLockElement === renderer.domElement) {
				document.addEventListener("mousemove", handleMouseMove);
			} else {
				document.removeEventListener("mousemove", handleMouseMove);
			}
		};

		renderer.domElement.addEventListener("click", enablePointerLock);
		document.addEventListener("pointerlockchange", handlePointerLockChange);
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);

		// Function to fire a bullet
		const fireBullet = () => {
			const bulletGeometry = new THREE.SphereGeometry(0.1, 16, 16);
			const bulletMaterial = new THREE.MeshStandardMaterial({color: 0xffff00});
			const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

			// Set bullet initial position and direction
			bullet.position.copy(camera.position);
			bullet.direction = new THREE.Vector3();
			camera.getWorldDirection(bullet.direction);
			bullet.speed = 0.5; // Set bullet speed
			bullet.distanceTravelled = 0; // Track distance travelled

			scene.add(bullet);
			bullets.push(bullet);
		};

		// Add event listener for left mouse clicks
		renderer.domElement.addEventListener("mousedown", (e) => {
			if (e.button === 0) {
				// Left click
				fireBullet();
			}
		});

		return () => {
			if (mountRef.current) {
				mountRef.current.removeChild(renderer.domElement);
			}
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
			renderer.domElement.removeEventListener("click", enablePointerLock);
			document.removeEventListener("pointerlockchange", handlePointerLockChange);
			document.removeEventListener("mousemove", handleMouseMove);
		};
	}, []);

	return (
		<div ref={mountRef} style={{width: "100vw", height: "100vh", position: "relative"}}>
			{/* Crosshair elements for + shape */}
			<div style={horizontalLineStyle}></div>
			<div style={verticalLineStyle}></div>
			{/* Score Box */}
			<div style={scoreBoxStyle}>Score: {score}</div>
		</div>
	);
}

// Crosshair styles
const horizontalLineStyle = {
	position: "absolute",
	top: "50%",
	left: "50%",
	transform: "translate(-50%, -50%)",
	width: "20px", // Adjust for line length
	height: "2px", // Adjust for line thickness
	backgroundColor: "white",
};

const verticalLineStyle = {
	position: "absolute",
	top: "50%",
	left: "50%",
	transform: "translate(-50%, -50%)",
	height: "20px", // Adjust for line length
	width: "2px", // Adjust for line thickness
	backgroundColor: "white",
};

// Score box style
const scoreBoxStyle = {
	position: "absolute",
	top: "10px",
	right: "10px",
	backgroundColor: "rgba(0, 0, 0, 0.7)",
	color: "white",
	padding: "10px",
	borderRadius: "5px",
	fontSize: "18px",
};
