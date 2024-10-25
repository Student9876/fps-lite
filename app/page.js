"use client"
import {useEffect, useRef} from "react";
import * as THREE from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";

export default function Home() {
	const mountRef = useRef(null);

	useEffect(() => {
		// Set up scene, camera, and renderer
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
		camera.position.z = 5;

		const renderer = new THREE.WebGLRenderer({antialias: true});
		renderer.setSize(window.innerWidth, window.innerHeight);
		mountRef.current.appendChild(renderer.domElement);

		// Add OrbitControls to enable mouse rotation
		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true; // Smooth controls
		controls.dampingFactor = 0.25;
		controls.enableZoom = true;

		// Add a cube to the scene
		const geometry = new THREE.BoxGeometry();
		const material = new THREE.MeshBasicMaterial({color: 0x00ff00, wireframe: true});
		const cube = new THREE.Mesh(geometry, material);
		scene.add(cube);

		// Render loop
		const animate = () => {
			requestAnimationFrame(animate);
			controls.update(); // Required for damping
			renderer.render(scene, camera);
		};
		animate();

		// Handle window resize
		const handleResize = () => {
			renderer.setSize(window.innerWidth, window.innerHeight);
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
		};
		window.addEventListener("resize", handleResize);

		// Cleanup on unmount
		return () => {
			window.removeEventListener("resize", handleResize);
			mountRef.current.removeChild(renderer.domElement);
			controls.dispose();
		};
	}, []);

	return <div ref={mountRef} style={{width: "100vw", height: "100vh"}} />;
}
