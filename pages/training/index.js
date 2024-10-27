"use client";
import {useEffect, useRef, useState} from "react";
import * as THREE from "three";
import { AudioListener } from "three";

export default function TrainingMap() {
	const mountRef = useRef(null);
	const [score, setScore] = useState(0); // State to keep track of the score
	const bullets = []; // Array to keep track of active bullets
	let targetSphere;
	let spawnSound;
	
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
		
		// Define room dimensions
		const wallThickness = 0.5;
		const wallHeight = 5;
		const roomWidth = 20;
		const roomDepth = 20;
		
		// Create room walls
		const backWall = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, wallHeight, wallThickness), new THREE.MeshStandardMaterial({color: 0xffffff}));
		backWall.position.set(0, wallHeight / 2, -roomDepth / 2);
		scene.add(backWall);
		
		const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, roomDepth), new THREE.MeshStandardMaterial({color: 0xffffff}));
		leftWall.position.set(-roomWidth / 2, wallHeight / 2, 0);
		scene.add(leftWall);
		
		const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, roomDepth), new THREE.MeshStandardMaterial({color: 0xffffff}));
		rightWall.position.set(roomWidth / 2, wallHeight / 2, 0);
		scene.add(rightWall);
		
		// Floor
		const ground = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), new THREE.MeshStandardMaterial({color: 0x888888}));
		ground.rotation.x = -Math.PI / 2;
		ground.position.y = 0;
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
		
		// Track time for FPS-independent movement
		let lastTime = performance.now();
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
		
		// Sound for target spawning
		// const listener = new AudioListener();
		// spawnSound = new THREE.PositionalAudio(listener);
		// const audioLoader = new THREE.AudioLoader();
		// audioLoader.load("/sounds/pop-sound-effect.mp3", (buffer) => {
		// 	spawnSound.setBuffer(buffer);
		// 	spawnSound.setRefDistance(1);
		// });

		const spawnTargetSphere = () => {
			if (targetSphere) {
				scene.remove(targetSphere);
			}
			const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
			const sphereMaterial = new THREE.MeshStandardMaterial({color: 0xff6347});
			targetSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

			const randomHeight = 1 + Math.random() * (wallHeight - 2); // Minimum height of 1, max near ceiling
			targetSphere.position.set((Math.random() - 0.5) * (roomWidth - 1), randomHeight, (Math.random() - 0.5) * (roomDepth - 5));
			
			// Attach sound to target position for spatial audio
			// spawnSound.position.copy(targetSphere.position);
			// spawnSound.play();
			// targetSphere.add(spawnSound);
			scene.add(targetSphere);
		};
		spawnTargetSphere();

		const keys = {w: false, a: false, s: false, d: false};
		const speed = 10;
		let yaw = 0;
		let pitch = 0;

		const handleMouseMove = (event) => {
			yaw -= event.movementX * 0.002;
			pitch -= event.movementY * 0.002;
			pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
		};

		const hitSound = new Audio("/sounds/prime-kill.mp3");

		const animate = () => {
			requestAnimationFrame(animate);

			// Calculate delta time
			const currentTime = performance.now();
			const deltaTime = (currentTime - lastTime) / 1000; // Convert ms to seconds
			lastTime = currentTime;

			// Handle player rotation and movement
			const quaternion = new THREE.Quaternion();
			quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
			camera.quaternion.copy(quaternion);
			playerBox.rotation.y = yaw;

			const cameraDirection = new THREE.Vector3();
			camera.getWorldDirection(cameraDirection);
			cameraDirection.y = 0;
			cameraDirection.normalize();

			const right = new THREE.Vector3().crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();
			const forward = cameraDirection.clone().normalize();
			const moveDistance = deltaTime * speed;

			if (keys.w) playerBox.position.add(forward.clone().multiplyScalar(moveDistance));
			if (keys.s) playerBox.position.add(forward.clone().multiplyScalar(-moveDistance));
			if (keys.a) playerBox.position.add(right.clone().multiplyScalar(-moveDistance));
			if (keys.d) playerBox.position.add(right.clone().multiplyScalar(moveDistance));

			camera.position.set(playerBox.position.x, playerBox.position.y + playerHeight / 2, playerBox.position.z);

			// Update bullet positions with FPS independence
			for (let i = bullets.length - 1; i >= 0; i--) {
				const bullet = bullets[i];
				bullet.position.add(bullet.direction.clone().multiplyScalar(bullet.speed * deltaTime));
				bullet.distanceTravelled += bullet.speed * deltaTime;

				const raycaster = new THREE.Raycaster(bullet.position, bullet.direction.clone().normalize());
				const intersects = raycaster.intersectObject(targetSphere);

				if (intersects.length > 0 && bullet.distanceTravelled <= 1000) {
					if (!bullet.hasScored) {
						setScore((prevScore) => prevScore + 1);
						bullet.hasScored = true;
						hitSound.currentTime = 0;
						hitSound.play();
						spawnTargetSphere();
					}
					// bullet.material.color.set(0xff0000);
				}

				if (bullet.distanceTravelled > 1000) {
					scene.remove(bullet);
					bullets.splice(i, 1);
				}
			}

			renderer.render(scene, camera);
		};
		animate();

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

		const fireSound = new Audio("/sounds/vandal_1tap.mp3");

		const fireBullet = () => {
			const bulletGeometry = new THREE.SphereGeometry(0.1, 16, 16);
			const bulletMaterial = new THREE.MeshStandardMaterial({color: 0xffff00});
			const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
			bullet.position.copy(camera.position);
			bullet.direction = new THREE.Vector3();
			camera.getWorldDirection(bullet.direction);
			bullet.speed = 200;
			bullet.distanceTravelled = 0;
			bullet.hasScored = false;
			bullets.push(bullet);
			scene.add(bullet);
			fireSound.currentTime = 0;
			fireSound.play();
		};

		window.addEventListener("click", fireBullet);

		return () => {
			document.removeEventListener("pointerlockchange", handlePointerLockChange);
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
			window.removeEventListener("click", fireBullet);
		};
	}, []);

	return (
		<div ref={mountRef}>
			<div
				style={{
					position: "absolute",
					top: "10px",
					left: "10px",
					color: "white",
					fontSize: "24px",
					zIndex: 10,
				}}>
				Score: {score}
			</div>
		</div>
	);
}
