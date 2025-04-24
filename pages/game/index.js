import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import io from "socket.io-client";
import { Physics, calculateMass, calculateBoxVolume, calculateSphereVolume } from '../../utils/physics'; // Adjust the import path as necessary
import GameEnvironment from "../../components/GameEnvironment";

class Player {
	constructor(scene, camera, groundLevel = 0, playerHeight) {
		// Create player with dimensions
		const playerWidth = 0.5;
		const playerDepth = 0.5;

		this.playerBox = new THREE.Mesh(
			new THREE.BoxGeometry(playerWidth, playerHeight, playerDepth),
			new THREE.MeshStandardMaterial({ color: 0x00c0aa })
		);
		this.playerBox.position.set(0, playerHeight / 2, 0);
		scene.add(this.playerBox);

		// Calculate player mass based on dimensions and density
		const playerVolume = calculateBoxVolume(playerWidth, playerHeight, playerDepth);
		this.mass = calculateMass(playerVolume, 'PLAYER');

		this.camera = camera;
		this.camera.position.set(0, groundLevel + playerHeight, 0);
		scene.add(this.camera);

		this.velocity = new THREE.Vector3(0, 0, 0);
		this.isJumping = false;
		this.groundLevel = groundLevel;
		this.playerHeight = playerHeight;

		// Enhanced physics properties
		this.acceleration = 30.0; // Base acceleration force
		this.airAcceleration = 2.0; // Reduced acceleration in air
		this.groundFriction = 0.96; // Ground resistance (lower = more friction)
		this.airFriction = 0.99; // Air resistance (higher = less air drag)
		this.maxGroundSpeed = 10; // Maximum ground speed
		this.maxAirSpeed = 14; // Maximum air speed
		this.jumpForce = 5.5; // Initial jump velocity
		this.minSpeedThreshold = 0.1; // Speed below which we zero out velocity

		// Enhanced gravity properties - now using unified Physics constants
		this.fallMultiplier = 1.4; // Makes falling faster than rising
		this.lowJumpMultiplier = 3.0; // Quick release jump multiplier
		this.coyoteTime = 0.1; // Time in seconds player can jump after leaving ground
		this.coyoteTimeCounter = 0; // Tracks time since leaving ground
		this.jumpBufferTime = 0.2; // Time in seconds to buffer a jump input
		this.jumpBufferCounter = 0; // Tracks jump buffer
		this.hasBufferedJump = false; // Whether a jump is buffered

		this.keys = {
			w: false,
			a: false,
			s: false,
			d: false,
			space: false,
		};

		this.yaw = 0;
		this.pitch = 0;

		this.scene = scene;
	}

	handleKeyDown = (e) => {
		if (e.key === "w") this.keys.w = true;
		if (e.key === "a") this.keys.a = true;
		if (e.key === "s") this.keys.s = true;
		if (e.key === "d") this.keys.d = true;
		if (e.key === " ") this.keys.space = true;
		if (e.key === "r") {
			// Respawn player at safe location
			this.playerBox.position.set(-25, this.groundLevel + this.playerHeight / 2, -25);
			this.velocity.set(0, 0, 0);
			this.isJumping = false;
			this.camera.position.set(-25, this.groundLevel + this.playerHeight, -25);
		}
	};

	handleKeyUp = (e) => {
		if (e.key === "w") this.keys.w = false;
		if (e.key === "a") this.keys.a = false;
		if (e.key === "s") this.keys.s = false;
		if (e.key === "d") this.keys.d = false;
		if (e.key === " ") this.keys.space = false;
	};

	handleMouseMove = (event) => {
		this.yaw -= event.movementX * 0.002;
		this.pitch -= event.movementY * 0.002;
		this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));

		const quaternion = new THREE.Quaternion();
		quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"));
		this.camera.quaternion.copy(quaternion);

		// Update the rotation of the player box
		this.playerBox.rotation.y = this.yaw;
	};

	update(deltaTime, obstacles, setScore, setPlayerSpeed) {
		const cameraDirection = new THREE.Vector3();
		this.camera.getWorldDirection(cameraDirection);
		cameraDirection.y = 0;
		cameraDirection.normalize();

		const previousPosition = this.playerBox.position.clone();
		const wasOnGround = !this.isJumping;

		// Movement vectors
		const forward = cameraDirection.clone();
		// Fix the right vector calculation
		const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

		// Calculate current acceleration based on ground/air state
		const currentAcceleration = this.isJumping ? this.airAcceleration : this.acceleration;

		// Apply forces based on key input
		if (this.keys.w) {
			this.velocity.add(forward.clone().multiplyScalar(currentAcceleration * deltaTime));
		}
		if (this.keys.s) {
			this.velocity.add(forward.clone().multiplyScalar(-currentAcceleration * deltaTime));
		}
		if (this.keys.a) {
			// Fix the A key direction (left)
			this.velocity.add(right.clone().multiplyScalar(-currentAcceleration * deltaTime));
		}
		if (this.keys.d) {
			// Fix the D key direction (right)
			this.velocity.add(right.clone().multiplyScalar(currentAcceleration * deltaTime));
		}

		// Handle coyote time - time after walking off edge when you can still jump
		if (wasOnGround && this.isJumping) {
			this.coyoteTimeCounter = this.coyoteTime;
		} else if (this.coyoteTimeCounter > 0) {
			this.coyoteTimeCounter -= deltaTime;
		}

		// Handle jump buffer - allow jump to be queued before landing
		if (this.jumpBufferCounter > 0) {
			this.jumpBufferCounter -= deltaTime;
			if (this.jumpBufferCounter <= 0) {
				this.hasBufferedJump = false;
			}
		}

		// Jump logic with coyote time and jump buffer
		if (this.keys.space && !this.hasBufferedJump) {
			if (!this.isJumping || this.coyoteTimeCounter > 0) {
				// Can jump if on ground or within coyote time
				this.isJumping = true;
				this.coyoteTimeCounter = 0;
				this.velocity.y = this.jumpForce;
				this.hasBufferedJump = false;
			} else {
				// Buffer the jump for a short time
				this.jumpBufferCounter = this.jumpBufferTime;
				this.hasBufferedJump = true;
			}
		}

		// Apply enhanced gravity using unified Physics.GRAVITY
		if (this.velocity.y < 0) {
			// Falling - apply fall multiplier for faster descent
			this.velocity.y += Physics.GRAVITY * this.fallMultiplier * deltaTime;
		} else if (this.velocity.y > 0 && !this.keys.space) {
			// Rising but jump button released - cut the jump short
			this.velocity.y += Physics.GRAVITY * this.lowJumpMultiplier * deltaTime;
		} else {
			// Normal gravity when rising with jump held
			this.velocity.y += Physics.GRAVITY * deltaTime;
		}

		// Apply terminal velocity
		if (this.velocity.y < Physics.TERMINAL_VELOCITY) {
			this.velocity.y = Physics.TERMINAL_VELOCITY;
		}

		// Apply appropriate friction based on ground/air state
		const friction = this.isJumping ? this.airFriction : this.groundFriction;

		// Only apply horizontal friction
		const horizontalVelocity = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
		horizontalVelocity.multiplyScalar(friction);
		this.velocity.x = horizontalVelocity.x;
		this.velocity.z = horizontalVelocity.z;

		// Enforce speed limits
		const horizontalSpeed = horizontalVelocity.length();
		const maxSpeed = this.isJumping ? this.maxAirSpeed : this.maxGroundSpeed;

		if (horizontalSpeed > maxSpeed) {
			horizontalVelocity.setLength(maxSpeed);
			this.velocity.x = horizontalVelocity.x;
			this.velocity.z = horizontalVelocity.z;
		}

		// If below threshold, zero out horizontal velocity
		if (horizontalSpeed < this.minSpeedThreshold) {
			this.velocity.x = 0;
			this.velocity.z = 0;
		}

		// Apply velocity to position
		this.playerBox.position.add(this.velocity.clone().multiplyScalar(deltaTime));

		// Check if player hits the ground
		if (this.playerBox.position.y <= this.groundLevel + this.playerHeight / 2) {
			// Landing on ground
			this.playerBox.position.y = this.groundLevel + this.playerHeight / 2;

			// Handle buffered jump if one was queued
			if (this.hasBufferedJump) {
				this.velocity.y = this.jumpForce;
				this.hasBufferedJump = false;
				this.jumpBufferCounter = 0;
			} else {
				// Reset vertical velocity on landing
				this.velocity.y = 0;

				// Apply landing impact based on falling speed
				if (this.isJumping) {
					const impactForce = Math.abs(this.velocity.y) / 20;
					// Horizontal velocity reduction on impact
					this.velocity.x *= (1 - impactForce);
					this.velocity.z *= (1 - impactForce);

					this.isJumping = false;
				}
			}
		} else {
			// Not on ground
			this.isJumping = true;
		}

		// Collision check
		if (this.checkCollision(obstacles, previousPosition)) {
			// Handle collision by sliding along surfaces
			this.handleCollision(previousPosition, obstacles);
		}

		// Update camera position
		this.camera.position.set(this.playerBox.position.x, this.playerBox.position.y + this.playerHeight / 2, this.playerBox.position.z);

		// Update player speed for UI
		setPlayerSpeed(this.velocity.length().toFixed(2));
	}

	handleCollision(previousPosition, obstacles) {
		// Improved collision response - slide along obstacles
		// First try X axis
		const tryPositionX = new THREE.Vector3(previousPosition.x, this.playerBox.position.y, this.playerBox.position.z);

		this.playerBox.position.copy(tryPositionX);
		if (!this.checkCollision(obstacles, previousPosition)) {
			// X-axis slide worked
			this.velocity.x = 0;
			return;
		}

		// Try Z axis next
		const tryPositionZ = new THREE.Vector3(this.playerBox.position.x, this.playerBox.position.y, previousPosition.z);

		this.playerBox.position.copy(tryPositionZ);
		if (!this.checkCollision(obstacles, previousPosition)) {
			// Z-axis slide worked
			this.velocity.z = 0;
			return;
		}

		// If both failed, just go back to previous position
		this.playerBox.position.copy(previousPosition);

		// Only zero the velocity components that are moving into the collision
		// Calculate direction to obstacle
		const direction = new THREE.Vector3();

		// Find closest obstacle for better collision response
		let closestDistance = Infinity;
		let closestObstacle = null;

		for (const obstacle of obstacles) {
			const obstacleCenter = new THREE.Vector3();
			new THREE.Box3().setFromObject(obstacle).getCenter(obstacleCenter);
			const distance = this.playerBox.position.distanceTo(obstacleCenter);

			if (distance < closestDistance) {
				closestDistance = distance;
				closestObstacle = obstacle;
			}
		}

		if (closestObstacle) {
			const obstacleCenter = new THREE.Vector3();
			new THREE.Box3().setFromObject(closestObstacle).getCenter(obstacleCenter);

			// Get collision normal (direction from obstacle to player)
			direction.subVectors(this.playerBox.position, obstacleCenter).normalize();

			// Cancel velocity in the collision normal direction
			const dot = this.velocity.dot(direction);
			if (dot < 0) {
				// Only cancel velocity component moving toward obstacle
				this.velocity.sub(direction.multiplyScalar(dot));
			}
		}
	}

	checkCollision(obstacles, newPosition) {
		const playerBB = new THREE.Box3().setFromObject(this.playerBox);
		for (const obstacle of obstacles) {
			const obstacleBB = new THREE.Box3().setFromObject(obstacle);
			if (playerBB.intersectsBox(obstacleBB)) {
				return true;
			}
		}
		return false;
	}
}

class Bullet {
	constructor(scene, camera, speed = 100) {
		const bulletRadius = 0.08;
		this.bullet = new THREE.Mesh(
			new THREE.SphereGeometry(bulletRadius, 16, 16),
			new THREE.MeshStandardMaterial({ color: 0xffff00 })
		);
		this.bullet.position.copy(camera.position);
		this.direction = new THREE.Vector3();
		camera.getWorldDirection(this.direction);
		this.speed = speed;
		this.distanceTravelled = 0;
		this.hasScored = false;
		this.scene = scene;
		scene.add(this.bullet);

		// Store bullet radius for collision detection
		this.bulletRadius = bulletRadius;

		// Calculate bullet mass based on volume and density
		const bulletVolume = calculateSphereVolume(bulletRadius);
		this.mass = calculateMass(bulletVolume, 'BULLET');

		// Add gravity effects to bullets
		this.velocity = this.direction.clone().multiplyScalar(this.speed);
		this.affectedByGravity = true; // Enable gravity for more realistic ballistics
	}

	update(deltaTime, obstacles, setScore) {
		// Apply gravity if enabled
		if (this.affectedByGravity) {
			this.velocity.y += Physics.GRAVITY * deltaTime;
		}

		// Store previous position for collision detection
		const previousPosition = this.bullet.position.clone();

		// Update position using velocity
		this.bullet.position.add(this.velocity.clone().multiplyScalar(deltaTime));
		this.distanceTravelled += this.velocity.length() * deltaTime;

		// Create bullet bounding sphere for accurate collision detection
		const bulletBoundingSphere = new THREE.Sphere(
			this.bullet.position.clone(),
			this.bulletRadius
		);

		// Check for actual collisions with obstacles
		let hasCollided = false;
		let hitObstacle = null;
		let hitPoint = null;

		for (const obstacle of obstacles) {
			// Create obstacle bounding box
			const obstacleBB = new THREE.Box3().setFromObject(obstacle);

			// Test if sphere intersects with box
			if (this.sphereIntersectsBox(bulletBoundingSphere, obstacleBB)) {
				hasCollided = true;
				hitObstacle = obstacle;

				// Calculate approximate hit point (center of bullet at collision)
				hitPoint = this.bullet.position.clone();
				break;
			}
		}

		// Handle collision if one occurred
		if (hasCollided && !this.hasScored) {
			// Increment score
			setScore((prevScore) => prevScore + 1);
			this.hasScored = true;

			// Create impact effect
			this.createImpactEffect(hitPoint);

			// Remove bullet
			this.scene.remove(this.bullet);
			return true; // Signal that bullet should be removed
		}

		// Continue rendering the bullet, or remove if it travels more than 1000 units
		if (this.distanceTravelled > 1000) {
			this.scene.remove(this.bullet);
			return true; // Signal that bullet should be removed
		}

		return false; // Bullet should continue to exist
	}

	// Helper method to check if a sphere intersects with a box
	sphereIntersectsBox(sphere, box) {
		// Find the closest point on the box to the sphere center
		const closestPoint = new THREE.Vector3();

		// Clamp sphere center to box bounds to find closest point
		closestPoint.x = Math.max(box.min.x, Math.min(sphere.center.x, box.max.x));
		closestPoint.y = Math.max(box.min.y, Math.min(sphere.center.y, box.max.y));
		closestPoint.z = Math.max(box.min.z, Math.min(sphere.center.z, box.max.z));

		// Calculate squared distance between sphere center and closest point
		const distanceSquared = closestPoint.distanceToSquared(sphere.center);

		// Sphere intersects if the distance is less than or equal to the squared radius
		return distanceSquared <= (sphere.radius * sphere.radius);
	}

	// Create a visual effect at impact point
	createImpactEffect(position) {
		// Simple particle effect
		const particles = 8;
		const particleGeometry = new THREE.SphereGeometry(0.03, 8, 8);
		const particleMaterial = new THREE.MeshBasicMaterial({
			color: 0xffcc00,
			transparent: true,
			opacity: 0.8
		});

		for (let i = 0; i < particles; i++) {
			const particle = new THREE.Mesh(particleGeometry, particleMaterial);
			particle.position.copy(position);

			// Random direction
			const direction = new THREE.Vector3(
				Math.random() * 2 - 1,
				Math.random() * 2 - 1,
				Math.random() * 2 - 1
			).normalize();

			// Set velocity
			particle.userData.velocity = direction.multiplyScalar(1 + Math.random() * 2);
			particle.userData.lifetime = 0.5; // Lifetime in seconds
			particle.userData.age = 0;

			this.scene.add(particle);

			// Add to an impact particles array to be updated in the game loop
			if (!this.scene.userData.impactParticles) {
				this.scene.userData.impactParticles = [];
			}
			this.scene.userData.impactParticles.push(particle);
		}
	}
}

class RemotePlayer {
	constructor(scene, id, color, position) {
		this.id = id;
		this.playerBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 0.5), new THREE.MeshStandardMaterial({ color }));
		this.playerBox.position.copy(position);
		scene.add(this.playerBox);

		// Create player ID label
		this.createPlayerLabel(scene);
	}

	createPlayerLabel(scene) {
		const canvas = document.createElement('canvas');
		canvas.width = 256;
		canvas.height = 128;
		const context = canvas.getContext('2d');
		context.fillStyle = 'white';
		context.font = '48px Arial';
		context.textAlign = 'center';
		context.fillText(this.id.slice(0, 8), 128, 64);

		const texture = new THREE.CanvasTexture(canvas);
		this.idLabel = new THREE.Mesh(
			new THREE.PlaneGeometry(1, 0.5),
			new THREE.MeshBasicMaterial({ map: texture, transparent: true })
		);
		this.idLabel.position.set(0, 1.5, 0);
		this.idLabel.lookAt(scene.position);
		scene.add(this.idLabel);
	}

	update(position, rotation) {
		this.playerBox.position.copy(position);
		this.playerBox.rotation.y = rotation.yaw;

		// Update label position to follow player
		if (this.idLabel) {
			this.idLabel.position.set(position.x, position.y + 1.5, position.z);
		}
	}

	remove(scene) {
		scene.remove(this.playerBox);
		if (this.idLabel) {
			scene.remove(this.idLabel);
		}
	}
}

export default function GameMap() {
	const mountRef = useRef(null);
	const [score, setScore] = useState(0);
	const [playerSpeed, setPlayerSpeed] = useState(0);
	const [bullets, setBullets] = useState([]);
	const [fps, setFps] = useState(0);
	const socketRef = useRef(null);
	const playerRef = useRef(null);
	const remotePlayersRef = useRef(new Map());
	const sceneRef = useRef(null);

	useEffect(() => {
		socketRef.current = io("https://fps-lite-server-h8xo.onrender.com", {
			withCredentials: true,
			transports: ["websocket", "polling"],
		});

		const windowWidth = window.innerWidth * 0.989;
		const windowHeight = window.innerHeight * 0.98;

		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x87ceeb); // Sky blue background
		const camera = new THREE.PerspectiveCamera(75, windowWidth / windowHeight, 0.1, 1000);
		const groundLevel = 0;
		const playerHeight = 1;

		// Add hemisphere light for better ambient lighting
		const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
		hemiLight.position.set(0, 200, 0);
		scene.add(hemiLight);

		// Add directional light to cast shadows
		const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
		dirLight.position.set(30, 50, 30);
		dirLight.castShadow = true;
		dirLight.shadow.mapSize.width = 2048;
		dirLight.shadow.mapSize.height = 2048;
		scene.add(dirLight);

		const player = new Player(scene, camera, groundLevel, playerHeight);
		// Set player to spawn in a completely clear area far from all obstacles
		player.playerBox.position.set(-25, playerHeight / 2, -25); // Far corner spawn point
		player.camera.position.set(-25, playerHeight, -25); // Update camera position to match

		// Store player reference
		playerRef.current = player;

		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(windowWidth, windowHeight);
		renderer.shadowMap.enabled = true;
		mountRef.current.appendChild(renderer.domElement);

		// Create game environment and get obstacles
		const mapSize = 60;
		const gameEnvironment = new GameEnvironment(scene, mapSize);
		const obstacles = gameEnvironment.getObstacles();

		const fireSound = new Audio("/sounds/vandal_1tap.mp3");

		const fireBullet = () => {
			const bullet = new Bullet(scene, camera);
			bullets.push(bullet);
			fireSound.currentTime = 0;
			fireSound.play();

			socketRef.current.emit("playerShoot", {
				playerId: player.id,
				position: bullet.bullet.position.clone(),
				direction: bullet.direction.clone(),
			});
		};

		const handlePointerLockChange = () => {
			if (document.pointerLockElement === renderer.domElement) {
				document.addEventListener("mousemove", player.handleMouseMove);
			} else {
				document.removeEventListener("mousemove", player.handleMouseMove);
			}
		};

		const enablePointerLock = () => {
			renderer.domElement.requestPointerLock();
		};

		let lastTime = performance.now();
		let frameCount = 0;
		let lastFpsUpdateTime = lastTime;

		const crosshairSize = 0.01;
		const horizontalCrosshair = new THREE.Mesh(
			new THREE.PlaneGeometry(crosshairSize * 2, crosshairSize / 2),
			new THREE.MeshBasicMaterial({ color: 0xffffff })
		);
		const verticalCrosshair = new THREE.Mesh(new THREE.PlaneGeometry(crosshairSize / 2, crosshairSize * 2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
		horizontalCrosshair.position.z = -1;
		verticalCrosshair.position.z = -1;

		// Add crosshair parts as child objects of the camera
		camera.add(horizontalCrosshair);
		camera.add(verticalCrosshair);

		setFps(frameCount);

		const originalUpdate = player.update;

		// Override player's update method to allow falling off the map
		player.update = function (deltaTime, obstacles, setScore, setPlayerSpeed) {
			const cameraDirection = new THREE.Vector3();
			this.camera.getWorldDirection(cameraDirection);
			cameraDirection.y = 0;
			cameraDirection.normalize();

			const previousPosition = this.playerBox.position.clone();
			const wasOnGround = !this.isJumping;

			// Movement vectors
			const forward = cameraDirection.clone();
			const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

			// Calculate current acceleration based on ground/air state
			const currentAcceleration = this.isJumping ? this.airAcceleration : this.acceleration;

			// Apply forces based on key input
			if (this.keys.w) {
				this.velocity.add(forward.clone().multiplyScalar(currentAcceleration * deltaTime));
			}
			if (this.keys.s) {
				this.velocity.add(forward.clone().multiplyScalar(-currentAcceleration * deltaTime));
			}
			if (this.keys.a) {
				this.velocity.add(right.clone().multiplyScalar(-currentAcceleration * deltaTime));
			}
			if (this.keys.d) {
				this.velocity.add(right.clone().multiplyScalar(currentAcceleration * deltaTime));
			}

			// Handle coyote time
			if (wasOnGround && this.isJumping) {
				this.coyoteTimeCounter = this.coyoteTime;
			} else if (this.coyoteTimeCounter > 0) {
				this.coyoteTimeCounter -= deltaTime;
			}

			// Handle jump buffer
			if (this.jumpBufferCounter > 0) {
				this.jumpBufferCounter -= deltaTime;
				if (this.jumpBufferCounter <= 0) {
					this.hasBufferedJump = false;
				}
			}

			// Jump logic with coyote time and jump buffer
			if (this.keys.space && !this.hasBufferedJump) {
				if (!this.isJumping || this.coyoteTimeCounter > 0) {
					this.isJumping = true;
					this.coyoteTimeCounter = 0;
					this.velocity.y = this.jumpForce;
					this.hasBufferedJump = false;
				} else {
					this.jumpBufferCounter = this.jumpBufferTime;
					this.hasBufferedJump = true;
				}
			}

			// Apply enhanced gravity
			if (this.velocity.y < 0) {
				this.velocity.y += Physics.GRAVITY * this.fallMultiplier * deltaTime;
			} else if (this.velocity.y > 0 && !this.keys.space) {
				this.velocity.y += Physics.GRAVITY * this.lowJumpMultiplier * deltaTime;
			} else {
				this.velocity.y += Physics.GRAVITY * deltaTime;
			}

			// Apply terminal velocity
			if (this.velocity.y < Physics.TERMINAL_VELOCITY) {
				this.velocity.y = Physics.TERMINAL_VELOCITY;
			}

			// Apply appropriate friction
			const friction = this.isJumping ? this.airFriction : this.groundFriction;
			const horizontalVelocity = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
			horizontalVelocity.multiplyScalar(friction);
			this.velocity.x = horizontalVelocity.x;
			this.velocity.z = horizontalVelocity.z;

			// Enforce speed limits
			const horizontalSpeed = horizontalVelocity.length();
			const maxSpeed = this.isJumping ? this.maxAirSpeed : this.maxGroundSpeed;

			if (horizontalSpeed > maxSpeed) {
				horizontalVelocity.setLength(maxSpeed);
				this.velocity.x = horizontalVelocity.x;
				this.velocity.z = horizontalVelocity.z;
			}

			// If below threshold, zero out horizontal velocity
			if (horizontalSpeed < this.minSpeedThreshold) {
				this.velocity.x = 0;
				this.velocity.z = 0;
			}

			// Apply velocity to position
			this.playerBox.position.add(this.velocity.clone().multiplyScalar(deltaTime));

			// Check if player is on the map
			const mapHalfSize = 30; // Half of mapSize (60)
			const isOnMap =
				Math.abs(this.playerBox.position.x) < mapHalfSize &&
				Math.abs(this.playerBox.position.z) < mapHalfSize;

			// Check if player hits the ground AND is on the map
			if (this.playerBox.position.y <= this.groundLevel + this.playerHeight / 2 && isOnMap) {
				// Landing on ground
				this.playerBox.position.y = this.groundLevel + this.playerHeight / 2;

				// Handle buffered jump if one was queued
				if (this.hasBufferedJump) {
					this.velocity.y = this.jumpForce;
					this.hasBufferedJump = false;
					this.jumpBufferCounter = 0;
				} else {
					// Reset vertical velocity on landing
					this.velocity.y = 0;

					// Apply landing impact based on falling speed
					if (this.isJumping) {
						const impactForce = Math.abs(this.velocity.y) / 20;
						this.velocity.x *= (1 - impactForce);
						this.velocity.z *= (1 - impactForce);

						this.isJumping = false;
					}
				}
			} else {
				// Not on ground or not on the map
				this.isJumping = true;
			}

			// Reset player if fallen too far
			if (this.playerBox.position.y < -50) {
				this.playerBox.position.set(-25, this.groundLevel + this.playerHeight / 2, -25);
				this.velocity.set(0, 0, 0);
				this.isJumping = false;

				// Update camera position to match
				this.camera.position.set(-25, this.groundLevel + this.playerHeight, -25);
			}

			// Collision check for obstacles other than the ground
			// Comment out these lines to disable collision detection
			/*
			const realObstacles = obstacles.filter(obs => !obs.userData.isGround);
			if (realObstacles.length > 0 && this.checkCollision(realObstacles, previousPosition)) {
				// Handle collision by sliding along surfaces
				this.handleCollision(previousPosition, realObstacles);
			}
			*/

			// Update camera position
			this.camera.position.set(this.playerBox.position.x, this.playerBox.position.y + this.playerHeight / 2, this.playerBox.position.z);

			// Update player speed for UI
			setPlayerSpeed(this.velocity.length().toFixed(2));

			// After original update completes, send the new position to server
			socketRef.current.emit("playerMove", {
				playerId: this.id,
				position: this.playerBox.position, // Current position after movement
				rotation: {
					yaw: this.yaw, // Current horizontal rotation
					pitch: this.pitch, // Current vertical rotation
				},
			});
		};

		socketRef.current.on("playerInit", ({ playerId, players }) => {
			player.id = playerId;

			// Create remote players
			players.forEach((remotePlayer) => {
				if (remotePlayer.id !== playerId) {
					const newPlayer = new RemotePlayer(
						scene,
						remotePlayer.id,
						remotePlayer.color,
						new THREE.Vector3(remotePlayer.position.x, remotePlayer.position.y, remotePlayer.position.z)
					);
					remotePlayersRef.current.set(remotePlayer.id, newPlayer);
				}
			});
		});

		socketRef.current.on("playerJoined", (remotePlayer) => {
			if (remotePlayer.id !== player.id) {
				const newPlayer = new RemotePlayer(
					scene,
					remotePlayer.id,
					remotePlayer.color,
					new THREE.Vector3(remotePlayer.position.x, remotePlayer.position.y, remotePlayer.position.z)
				);
				remotePlayersRef.current.set(remotePlayer.id, newPlayer);
			}
		});

		socketRef.current.on("playerMoved", ({ playerId, position, rotation }) => {
			const remotePlayer = remotePlayersRef.current.get(playerId);
			if (remotePlayer) {
				remotePlayer.update(new THREE.Vector3(position.x, position.y, position.z), rotation);
			}
		});

		socketRef.current.on("playerLeft", (playerId) => {
			const remotePlayer = remotePlayersRef.current.get(playerId);
			if (remotePlayer) {
				remotePlayer.remove(scene);
				remotePlayersRef.current.delete(playerId);
			}
		});

		socketRef.current.on("bulletFired", ({ playerId, position, direction }) => {
			if (playerId !== player.id) {
				const bullet = new Bullet(scene, camera);
				bullet.bullet.position.copy(position);
				bullet.direction.copy(direction);
				bullets.push(bullet);
			}
		});

		const animate = () => {
			requestAnimationFrame(animate);

			const currentTime = performance.now();
			const deltaTime = (currentTime - lastTime) / 1000;
			lastTime = currentTime;

			player.update(deltaTime, obstacles, setScore, setPlayerSpeed);

			// Update and filter bullets that need to be removed
			for (let i = bullets.length - 1; i >= 0; i--) {
				const shouldRemove = bullets[i].update(deltaTime, obstacles, setScore);
				if (shouldRemove) {
					bullets.splice(i, 1);
				}
			}

			// Update impact particles if they exist
			if (scene.userData.impactParticles && scene.userData.impactParticles.length > 0) {
				for (let i = scene.userData.impactParticles.length - 1; i >= 0; i--) {
					const particle = scene.userData.impactParticles[i];
					particle.userData.age += deltaTime;

					// Update position based on velocity
					particle.position.add(
						particle.userData.velocity.clone().multiplyScalar(deltaTime)
					);

					// Fade out based on age
					const opacity = 1 - (particle.userData.age / particle.userData.lifetime);
					particle.material.opacity = Math.max(0, opacity);

					// Remove particles that have lived their lifetime
					if (particle.userData.age >= particle.userData.lifetime) {
						scene.remove(particle);
						scene.userData.impactParticles.splice(i, 1);
					}
				}
			}

			// Calculate FPS
			frameCount++;
			if (currentTime - lastFpsUpdateTime >= 1000) {
				// Update every 1 second
				setFps(frameCount);
				frameCount = 0;
				lastFpsUpdateTime = currentTime;
			}

			renderer.render(scene, camera);

			// In your animate function
			scene.traverse(object => {
				if (object.userData.isWater && object.userData.waterAnimation) {
					object.userData.waterAnimation.update(currentTime * 0.001);
				}
			});
		};

		renderer.domElement.addEventListener("click", enablePointerLock);
		document.addEventListener("pointerlockchange", handlePointerLockChange);
		window.addEventListener("keydown", player.handleKeyDown);
		window.addEventListener("keyup", player.handleKeyUp);
		renderer.domElement.addEventListener("mousedown", (e) => {
			if (e.button === 0) {
				fireBullet();
			}
		});

		animate();

		return () => {
			socketRef.current.disconnect();
			if (mountRef.current) {
				mountRef.current.removeChild(renderer.domElement);
			}
			window.removeEventListener("keydown", player.handleKeyDown);
			window.removeEventListener("keyup", player.handleKeyUp);
			renderer.domElement.removeEventListener("click", enablePointerLock);
			document.removeEventListener("pointerlockchange", handlePointerLockChange);
			document.removeEventListener("mousemove", player.handleMouseMove);
		};
	}, []);

	return (
		<div ref={mountRef}>
			<div className="" style={scoreBoxStyle}>
				Score: {score} <br />
				Player speed: {playerSpeed} <br />
				FPS: {fps} <br />
				Mass: {playerRef.current?.mass.toFixed(2) || 'N/A'} kg
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