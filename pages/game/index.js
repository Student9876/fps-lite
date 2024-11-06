"use client";
import {useEffect, useRef, useState} from "react";
import * as THREE from "three";

export default function GameMap() {
	const mountRef = useRef(null);
	const [score, setScore] = useState(0); // State to keep track of the score
	const bullets = []; // Array to keep track of active bullets
	const errorFactor = 0.1;
	const jumpHeight = 2; // Height of the jump
	const gravity = -9.81; // Gravity value

	const acceleration_ground = 2.0; // Adjust for desired acceleration rate
	const maxSpeed = 10; // Maximum speed
	const friction_ground = 0.82; // Adjust for desired slowing rate (e.g., between 0.8 to 0.99)
	const velocity = new THREE.Vector3(0, 0, 0); // Initialize velocity for the player
	const [playerSpeed, setPlayerSpeed] = useState(0); // State to keep track of the player speed

	useEffect(() => {
		const windowWidth = window.innerWidth * 0.989;
		const windowHeight = window.innerHeight * 0.98;

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(75, windowWidth / windowHeight, 0.1, 1000);
		const groundLevel = 0;
		const playerHeight = 0.5;

		const playerBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, playerHeight, 0.5), new THREE.MeshStandardMaterial({color: 0x00c0aa}));
		playerBox.position.set(0, playerHeight / 2, 0);
		scene.add(playerBox);

		camera.position.set(0, groundLevel + playerHeight, 0);

		const renderer = new THREE.WebGLRenderer({antialias: true});
		renderer.setSize(windowWidth, windowHeight);
		mountRef.current.appendChild(renderer.domElement);

		const groundGeometry = new THREE.PlaneGeometry(100, 100);
		const groundMaterial = new THREE.MeshStandardMaterial({color: 0x888888});
		const ground = new THREE.Mesh(groundGeometry, groundMaterial);
		ground.rotation.x = -Math.PI / 2;
		scene.add(ground);

		// Add ambient light
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Soft white light
		scene.add(ambientLight);

		// Add multiple directional lights
		const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.5);
		directionalLight1.position.set(5, 10, 5);
		scene.add(directionalLight1);

		const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
		directionalLight2.position.set(-5, 10, -5);
		scene.add(directionalLight2);

		const directionalLight3 = new THREE.DirectionalLight(0xffffff, 0.5);
		directionalLight3.position.set(5, 10, -5);
		scene.add(directionalLight3);

		const directionalLight4 = new THREE.DirectionalLight(0xffffff, 0.5);
		directionalLight4.position.set(-5, 10, 5);
		scene.add(directionalLight4);

		const obstacles = [];
		const cubeColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
		for (let i = 0; i < 10; i++) {
			const color = cubeColors[i % cubeColors.length];
			const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color}));
			cube.position.set((Math.random() - 0.5) * 20, 0.5, (Math.random() - 0.5) * 20);
			scene.add(cube);
			obstacles.push(cube);
		}

		const keys = {w: false, a: false, s: false, d: false, space: false}; // Added space key
		const speed = 10;
		let yaw = 0;
		let pitch = 0;
		let isJumping = false; // Jump state
		let jumpVelocity = 0; // Current jump velocity

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

		let lastTime = performance.now(); // Track time of the last frame

		const crosshairSize = 0.01;
		const horizontalCrosshair = new THREE.Mesh(
			new THREE.PlaneGeometry(crosshairSize * 2, crosshairSize / 2),
			new THREE.MeshBasicMaterial({color: 0xffffff})
		);
		const verticalCrosshair = new THREE.Mesh(new THREE.PlaneGeometry(crosshairSize / 2, crosshairSize * 2), new THREE.MeshBasicMaterial({color: 0xffffff}));
		horizontalCrosshair.position.z = -1;
		verticalCrosshair.position.z = -1;

		// Add crosshair parts as child objects of the camera
		camera.add(horizontalCrosshair);
		camera.add(verticalCrosshair);
		scene.add(camera);

		const animate = () => {
			requestAnimationFrame(animate);

			const currentTime = performance.now();
			const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
			lastTime = currentTime;

			const quaternion = new THREE.Quaternion();
			quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
			camera.quaternion.copy(quaternion);

			// For rotation of the player box
			playerBox.rotation.y = yaw;

			const cameraDirection = new THREE.Vector3();
			camera.getWorldDirection(cameraDirection);
			cameraDirection.y = 0;
			cameraDirection.normalize();

			// Apply the velocity to player position
			const previousPosition = playerBox.position.clone();
			playerBox.position.add(velocity.clone().multiplyScalar(deltaTime));
			// const previousPosition = playerBox.position.clone();

			// Player movement logic
			if (keys.w && !isJumping) {
				velocity.add(camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize().multiplyScalar(acceleration_ground));
			}
			if (keys.s && !isJumping) {
				velocity.add(camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize().multiplyScalar(-acceleration_ground));
			}
			if (keys.a && !isJumping) {
				const left = new THREE.Vector3()
					.crossVectors(camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize(), new THREE.Vector3(0, 1, 0))
					.normalize();
				velocity.add(left.multiplyScalar(-acceleration_ground));
			}
			if (keys.d && !isJumping) {
				const right = new THREE.Vector3()
					.crossVectors(new THREE.Vector3(0, 1, 0), camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize())
					.normalize();
				velocity.add(right.multiplyScalar(-acceleration_ground));
			}

			if (keys.space && !isJumping) {
				isJumping = true;
				jumpVelocity = Math.sqrt(jumpHeight * -2 * gravity); // Initial jump velocity
			}

			// Apply friction_ground
			if (!isJumping) velocity.multiplyScalar(friction_ground);

			// Limit speed to maxSpeed
			if (velocity.length() > maxSpeed && !isJumping) {
				velocity.setLength(maxSpeed);
			}

			if (velocity.length() < 0.5) velocity.set(0, 0, 0);

			if (isJumping) {
				playerBox.position.y += jumpVelocity * deltaTime; // Move up
				jumpVelocity += gravity * deltaTime; // Apply gravity
				if (playerBox.position.y <= groundLevel + playerHeight / 2) {
					// Check if the player hits the ground
					playerBox.position.y = groundLevel + playerHeight / 2; // Reset to ground level
					isJumping = false; // Reset jump state
					jumpVelocity = 0; // Reset jump velocity
				}
			}

			// Collision check for player
			if (checkCollision(playerBox.position)) {
				playerBox.position.copy(previousPosition);
			}

			camera.position.set(playerBox.position.x, playerBox.position.y + playerHeight, playerBox.position.z);

			// Update bullet positions
			for (let i = bullets.length - 1; i >= 0; i--) {
				const bullet = bullets[i];

				// Update bullet position
				bullet.position.add(bullet.direction.clone().multiplyScalar(bullet.speed * deltaTime));
				bullet.distanceTravelled += bullet.speed * deltaTime;

				// Check for collisions with cubes using raycasting
				const raycaster = new THREE.Raycaster(bullet.position, bullet.direction.clone().normalize());
				const intersects = raycaster.intersectObjects(obstacles);

				// Check if the bullet has intersected with any obstacles
				if (intersects.length > 0 && bullet.distanceTravelled <= 1000) {
					// Only increment score if the bullet hasn't scored yet
					if (!bullet.hasScored) {
						setScore((prevScore) => prevScore + 1); // Increment score
						bullet.hasScored = true; // Mark bullet as having scored
						console.log("Hit");
					}

					// Optional: Add visual feedback for a hit
					// bullet.material.color.set(0xff0000); // Change bullet color to red to indicate hit
				}

				// Continue rendering the bullet, or remove if it travels more than 1000 units
				if (bullet.distanceTravelled > 1000) {
					scene.remove(bullet);
					bullets.splice(i, 1);
					console.log("Miss");
				}
			}

			// Update player speed
			setPlayerSpeed(velocity.length());

			renderer.render(scene, camera);
		};
		animate();

		// Event listeners for key presses
		const handleKeyDown = (e) => {
			console.log(velocity.length());
			if (e.key === "w") keys.w = true;
			if (e.key === "a") keys.a = true;
			if (e.key === "s") keys.s = true;
			if (e.key === "d") keys.d = true;
			if (e.key === " ") keys.space = true; // Space key for jumping
		};

		const handleKeyUp = (e) => {
			if (e.key === "w") keys.w = false;
			if (e.key === "a") keys.a = false;
			if (e.key === "s") keys.s = false;
			if (e.key === "d") keys.d = false;
			if (e.key === " ") keys.space = false; // Reset space key on release
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
		const fireSound = new Audio("/sounds/vandal_1tap.mp3");

		const fireBullet = () => {
			const bulletGeometry = new THREE.SphereGeometry(0.1, 16, 16);
			const bulletMaterial = new THREE.MeshStandardMaterial({color: 0xffff00});
			const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

			bullet.position.copy(camera.position);
			const bulletDirection = new THREE.Vector3();
			camera.getWorldDirection(bulletDirection);
			bullet.speed = 100;

			if ((keys.w && keys.s) || (keys.a && keys.d)) {
				bulletDirection.x += (Math.random() - 0.5) * 0;
				bulletDirection.y += (Math.random() - 0.5) * 0;
				bulletDirection.z += (Math.random() - 0.5) * 0;
			} else if (keys.w || keys.a || keys.s || keys.d) {
				bulletDirection.x += (Math.random() - 0.5) * errorFactor;
				bulletDirection.y += (Math.random() - 0.5) * errorFactor;
				bulletDirection.z += (Math.random() - 0.5) * errorFactor;
			} else {
				bulletDirection.x += (Math.random() - 0.5) * 0;
				bulletDirection.y += (Math.random() - 0.5) * 0;
				bulletDirection.z += (Math.random() - 0.5) * 0;
			}

			bulletDirection.normalize();
			bullet.direction = bulletDirection;
			bullet.distanceTravelled = 0;
			bullet.hasScored = false;

			scene.add(bullet);
			bullets.push(bullet);

			// Play the fire sound
			fireSound.currentTime = 0;
			fireSound.play();
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
		<div ref={mountRef}>
			{/* Score Box */}
			<div className="">
				<div style={scoreBoxStyle}>
					Score: {score} <br /> Player speed: {playerSpeed}
				</div>
			</div>
		</div>
	);
}

// Score Box styles
const scoreBoxStyle = {
	position: "absolute",
	top: "10px",
	left: "10px",
	color: "white",
	fontSize: "24px",
	zIndex: 10,
};
