# FPS-Lite: A Physics-Based First Person Shooter

A lightweight, browser-based first-person shooter with realistic physics built using Three.js. This project implements physics-based movement, ballistics, and collision detection in a 3D environment.

## Features

- **Physics-Based Movement System**
  - Player movement with proper acceleration and friction
  - Realistic jumping with coyote time and jump buffering
  - Air control and varying physics based on ground/air state

- **Advanced Ballistics**
  - Gravity-affected projectiles with accurate trajectory
  - Mass-based physics for all game objects
  - Realistic collision detection using sphere-box intersection testing

- **Game Mechanics**
  - First-person camera controls with mouse look
  - Shooting mechanics with visual feedback
  - Score tracking for successful hits
  - Impact particle effects

- **Performance Optimization**
  - FPS counter and performance monitoring
  - Efficient collision detection algorithms
  - Object pooling for particles

## Controls

- **WASD**: Movement
- **Mouse**: Look around
- **Spacebar**: Jump
- **Left Mouse Button**: Shoot

## Technical Implementation

### Physics System

The game implements a unified physics system with:
- Gravity constants applied consistently across all objects
- Mass calculation based on object volume and material density
- Terminal velocity and friction forces
- Enhanced movement mechanics including jump buffering and coyote time

### Collision Detection

- Player collisions use box-box intersection tests with sliding response
- Bullet collisions use precise sphere-box intersection algorithm
- Impact detection with visual particle effects

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Installation

1. Clone the repository:
```
git clone https://github.com/yourusername/fps-lite.git
cd fps-lite
```

2. Install dependencies:
```
npm install
# or
yarn install
```

3. Start the development server:
```
npm run dev
# or
yarn dev
```

4. Open your browser and navigate to `http://localhost:3000`

## Development

### Project Structure

- `/pages` - Application pages and game logic
- `/utils` - Utility functions including physics calculations
- `/components` - React components for UI elements

### Physics Constants

The game uses a centralized physics system with constants for:
- Gravity
- Terminal velocity
- Material densities
- Friction coefficients

## Future Improvements

- Multiplayer support with real-time synchronization
- Advanced weapon systems with different projectile types
- More complex level design with varying terrain
- Enemy AI with pathfinding algorithms

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Three.js for 3D rendering
- Next.js for application framework
- Inspiration from classic FPS games with a focus on physics