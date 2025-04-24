import * as THREE from "three";
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

export default class GameEnvironment {
  constructor(scene, mapSize = 60) {
    this.scene = scene;
    this.mapSize = mapSize;
    this.obstacles = [];
    
    this.createEnvironment();
  }

  createEnvironment() {
    // Create base terrain
    this.createBaseTerrain();
    
    // Add environment features
    this.addCenterPlatform();
    this.addRocks();
    this.addTrees();
    this.addWalls();
    this.addPond();
  }

  createBaseTerrain() {
    const baseGeometry = new THREE.PlaneGeometry(this.mapSize, this.mapSize, 100, 100);

    // Create a grass texture
    let grassTexture;
    try {
      const textureLoader = new THREE.TextureLoader();
      grassTexture = textureLoader.load('/textures/grass.jpg',
        // Success callback
        undefined,
        // Progress callback
        undefined,
        // Error callback
        () => {
          // Create fallback texture on error
          console.log("Failed to load grass texture, using fallback");
          const canvas = document.createElement("canvas");
          canvas.width = 2;
          canvas.height = 2;
          const context = canvas.getContext("2d");
          context.fillStyle = "#7cba3d";
          context.fillRect(0, 0, 2, 2);
          grassTexture = new THREE.CanvasTexture(canvas);

          // Apply texture properties
          grassTexture.wrapS = THREE.RepeatWrapping;
          grassTexture.wrapT = THREE.RepeatWrapping;
          grassTexture.repeat.set(20, 20);

          // Update material
          this.groundMaterial.map = grassTexture;
          this.groundMaterial.needsUpdate = true;
        }
      );
    } catch (error) {
      // Fallback if texture loading throws an error
      console.log("Error in texture loading:", error);
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 2;
      const context = canvas.getContext("2d");
      context.fillStyle = "#7cba3d";
      context.fillRect(0, 0, 2, 2);
      grassTexture = new THREE.CanvasTexture(canvas);
    }

    // Set texture properties
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(20, 20);

    this.groundMaterial = new THREE.MeshStandardMaterial({
      map: grassTexture,
      side: THREE.DoubleSide,
    });

    const ground = new THREE.Mesh(baseGeometry, this.groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1; // Slightly lower than player level
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Add ground to obstacles array and mark it as special
    this.obstacles.push(ground);
    ground.userData.isGround = true;

    return ground;
  }

  addCenterPlatform() {
    // Center platform (higher elevation)
    const centerPlatform = this.createPlatform(10, 10, 1, 0x8B4513);
    centerPlatform.position.set(0, 0.5, 0);
    this.scene.add(centerPlatform);
    this.obstacles.push(centerPlatform);
  }

  addRocks() {
    // Add some rocks scattered around
    const rockPositions = [
      { x: -15, z: 10, scale: 2 },
      { x: 12, z: -8, scale: 1.5 },
      { x: 18, z: 15, scale: 1.2 },
      { x: -20, z: -12, scale: 1.8 }
    ];

    rockPositions.forEach(pos => {
      const rock = this.createRock(pos.scale);
      rock.position.set(pos.x, 0, pos.z);
      this.scene.add(rock);
      this.obstacles.push(rock);
    });
  }

  addTrees() {
    // Add a few trees
    const treePositions = [
      { x: -10, z: -10 },
      { x: 15, z: 5 },
      { x: -5, z: 18 },
      { x: 8, z: -15 },
    ];

    treePositions.forEach(pos => {
      const tree = this.createTree();
      tree.position.set(pos.x, 0, pos.z);
      this.scene.add(tree);
      this.obstacles.push(tree);
    });
  }

  addWalls() {
    // Create walls/barriers for cover at strategic locations
    const wallPositions = [
      { x: 5, z: 5, width: 5, height: 1.5, depth: 0.5, rotation: Math.PI / 4 },
      { x: -7, z: 8, width: 4, height: 1, depth: 0.5, rotation: Math.PI / 2 },
      { x: 0, z: -12, width: 8, height: 1.2, depth: 0.5, rotation: 0 },
      { x: -12, z: -3, width: 6, height: 1.3, depth: 0.5, rotation: Math.PI / 6 }
    ];

    wallPositions.forEach(pos => {
      const wall = this.createWall(pos.width, pos.height, pos.depth);
      wall.position.set(pos.x, pos.height / 2, pos.z);
      wall.rotation.y = pos.rotation;
      this.scene.add(wall);
      this.obstacles.push(wall);
    });
  }

  addPond() {
    // Add a small pond
    const pond = this.createPond(8);
    pond.position.set(-18, 0.05, -18);
    this.scene.add(pond);
    this.obstacles.push(pond);
  }

  // Helper methods for creating objects
  createPlatform(width, depth, height, color) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({ color });
    const platform = new THREE.Mesh(geometry, material);
    platform.castShadow = true;
    platform.receiveShadow = true;
    return platform;
  }

  createRock(scale) {
    const geometry = new THREE.DodecahedronGeometry(scale, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.9,
      metalness: 0.1
    });
    const rock = new THREE.Mesh(geometry, material);
    rock.castShadow = true;
    rock.receiveShadow = true;
    // Add some random rotation for variety
    rock.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    return rock;
  }

  createTree() {
    const group = new THREE.Group();

    // Tree trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 1;
    trunk.castShadow = true;

    // Tree foliage
    const foliageGeometry = new THREE.ConeGeometry(1.5, 3, 8);
    const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x2d572c });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.y = 3;
    foliage.castShadow = true;

    group.add(trunk);
    group.add(foliage);
    return group;
  }

  createWall(width, height, depth) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({
      color: 0xa0a0a0,
      roughness: 0.7
    });
    const wall = new THREE.Mesh(geometry, material);
    wall.castShadow = true;
    wall.receiveShadow = true;
    return wall;
  }

  createPond(radius) {
    // Create a group to hold both the water surface and base
    const pondGroup = new THREE.Group();
    
    // Create the pond base (slightly darker blue)
    const baseGeometry = new THREE.CylinderGeometry(radius, radius, 0.3, 32);
    const baseMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x0a4d8c,
      transparent: false,
      metalness: 0.1,
      roughness: 0.2
    });
    const pondBase = new THREE.Mesh(baseGeometry, baseMaterial);
    pondBase.position.y = -0.15; // Position slightly below ground
    pondGroup.add(pondBase);
    
    // Create the reflective water surface using Reflector
    const waterGeometry = new THREE.CircleGeometry(radius, 32);
    
    // Create a reflector for the water surface
    const reflector = new Reflector(waterGeometry, {
      clipBias: 0.003,
      textureWidth: 512, // Texture resolution, can increase for better quality
      textureHeight: 512,
      color: 0x4488aa,
      opacity: 0.6  // Make it slightly transparent
    });
    
    reflector.rotation.x = -Math.PI / 2; // Lay flat
    reflector.position.y = 0.05; // Just above the pond base
    pondGroup.add(reflector);
    
    // Add gentle wave animation
    const waterAnimation = {
      update: function(time) {
        // Simple y-position oscillation for a gentle wave effect
        reflector.position.y = 0.05 + Math.sin(time * 0.5) * 0.02;
      }
    };
    
    // Store the animation in userData for the animation loop
    pondGroup.userData.isWater = true;
    pondGroup.userData.waterAnimation = waterAnimation;
    
    return pondGroup;
  }

  // Helper method to get all obstacles
  getObstacles() {
    return this.obstacles;
  }
}