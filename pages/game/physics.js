// A central place for physics constants used across the game
export const Physics = {
  // World constants
  GRAVITY: -9.81, // m/s²
  TERMINAL_VELOCITY: -25, // m/s
  
  // Material densities (kg/m³)
  DENSITIES: {
    PLAYER: 70,    // Somewhat lighter than water for better gameplay
    BULLET: 7800,  // Steel-like density
    OBSTACLE: 2700 // Aluminum-like density
  }
};

// Calculate mass based on volume and material
export function calculateMass(volume, materialType) {
  return volume * Physics.DENSITIES[materialType];
}

// Calculate volume of a box
export function calculateBoxVolume(width, height, depth) {
  return width * height * depth;
}

// Calculate volume of a sphere
export function calculateSphereVolume(radius) {
  return (4/3) * Math.PI * Math.pow(radius, 3);
}