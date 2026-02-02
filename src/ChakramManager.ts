import * as THREE from 'three'

/**
 * Entity position for multi-entity collision detection.
 */
export interface EntityPosition {
  id: string // e.g., "party-1", "party-2"
  position: THREE.Vector3
}

/**
 * Configuration for spawning a chakram projectile.
 */
export interface ChakramConfig {
  id: string
  startPosition: THREE.Vector3 // starting position (Y is ignored)
  endPosition: THREE.Vector3 // ending position (Y is ignored)
  travelTime: number // how long to travel from start to end (seconds)
  radius: number // size of the chakram disc
  hitRadius: number // collision detection radius
  onResolve?: () => void // callback when chakram finishes
}

/**
 * Internal state for an active chakram.
 */
interface ActiveChakram {
  config: ChakramConfig
  mesh: THREE.Group
  elapsedTime: number
  resolved: boolean
  stationary: boolean // If true, doesn't move until startMovement() is called
}

// Chakram visual colors
const CHAKRAM_COLOR = 0xcccccc // Silver/metallic
const CHAKRAM_EDGE_COLOR = 0xff6600 // Orange glow for danger

/**
 * Manages chakram projectiles - spinning discs that travel through the arena.
 */
export class ChakramManager {
  private scene: THREE.Scene
  private activeChakrams: Map<string, ActiveChakram> = new Map()
  private readonly spinSpeed = Math.PI * 4 // radians per second (2 full rotations/sec)

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  /**
   * Spawn a new chakram projectile.
   */
  spawn(config: ChakramConfig): void {
    if (this.activeChakrams.has(config.id)) {
      console.warn(`Chakram with id "${config.id}" already exists`)
      return
    }

    const mesh = this.createMesh(config)
    mesh.position.set(config.startPosition.x, 1.0, config.startPosition.z)
    this.scene.add(mesh)

    this.activeChakrams.set(config.id, {
      config,
      mesh,
      elapsedTime: 0,
      resolved: false,
      stationary: false,
    })
  }

  /**
   * Spawn a stationary chakram that doesn't move until startMovement() is called.
   */
  spawnStationary(config: ChakramConfig): void {
    if (this.activeChakrams.has(config.id)) {
      console.warn(`Chakram with id "${config.id}" already exists`)
      return
    }

    const mesh = this.createMesh(config)
    mesh.position.set(config.startPosition.x, 1.0, config.startPosition.z)
    this.scene.add(mesh)

    this.activeChakrams.set(config.id, {
      config,
      mesh,
      elapsedTime: 0,
      resolved: false,
      stationary: true,
    })
  }

  /**
   * Start movement for a stationary chakram.
   */
  startMovement(id: string): void {
    const chakram = this.activeChakrams.get(id)
    if (!chakram) {
      console.warn(`Chakram with id "${id}" not found`)
      return
    }
    chakram.stationary = false
    chakram.elapsedTime = 0
  }

  /**
   * Create the visual mesh for a chakram - a spinning disc with glowing edges.
   */
  private createMesh(config: ChakramConfig): THREE.Group {
    const group = new THREE.Group()

    // Main disc - torus geometry for ring shape
    const torusGeometry = new THREE.TorusGeometry(
      config.radius, // radius from center to tube center
      config.radius * 0.15, // tube radius (thickness)
      8, // radial segments
      32 // tubular segments
    )
    const torusMaterial = new THREE.MeshStandardMaterial({
      color: CHAKRAM_COLOR,
      metalness: 0.8,
      roughness: 0.2,
      emissive: CHAKRAM_EDGE_COLOR,
      emissiveIntensity: 0.3,
    })
    const torus = new THREE.Mesh(torusGeometry, torusMaterial)
    // Rotate torus to be horizontal (spinning on vertical axis)
    torus.rotation.x = Math.PI / 2
    group.add(torus)

    // Inner disc for visual interest
    const innerGeometry = new THREE.CircleGeometry(config.radius * 0.6, 16)
    const innerMaterial = new THREE.MeshStandardMaterial({
      color: CHAKRAM_EDGE_COLOR,
      metalness: 0.5,
      roughness: 0.5,
      emissive: CHAKRAM_EDGE_COLOR,
      emissiveIntensity: 0.5,
      side: THREE.DoubleSide,
    })
    const innerDisc = new THREE.Mesh(innerGeometry, innerMaterial)
    innerDisc.rotation.x = Math.PI / 2
    group.add(innerDisc)

    return group
  }

  /**
   * Update all active chakrams.
   * @param deltaTime Time elapsed since last update in seconds
   * @param entities Array of entity positions to check for collisions
   * @returns Map of entityId -> array of chakram IDs that hit them this frame
   */
  update(deltaTime: number, entities: EntityPosition[]): Map<string, string[]> {
    const allHits = new Map<string, string[]>()

    for (const [id, chakram] of this.activeChakrams) {
      // Always spin the chakram
      chakram.mesh.rotation.y += this.spinSpeed * deltaTime

      // Skip movement logic for stationary chakrams
      if (chakram.stationary) {
        continue
      }

      chakram.elapsedTime += deltaTime

      // Calculate progress (0 to 1)
      const progress = Math.min(chakram.elapsedTime / chakram.config.travelTime, 1)

      // Lerp position from start to end
      const currentX =
        chakram.config.startPosition.x +
        (chakram.config.endPosition.x - chakram.config.startPosition.x) * progress
      const currentZ =
        chakram.config.startPosition.z +
        (chakram.config.endPosition.z - chakram.config.startPosition.z) * progress
      chakram.mesh.position.set(currentX, 1.0, currentZ)

      // Check collision with all entities
      if (!chakram.resolved) {
        for (const entity of entities) {
          const dx = entity.position.x - currentX
          const dz = entity.position.z - currentZ
          const distanceSquared = dx * dx + dz * dz
          if (distanceSquared <= chakram.config.hitRadius * chakram.config.hitRadius) {
            if (!allHits.has(entity.id)) {
              allHits.set(entity.id, [])
            }
            allHits.get(entity.id)!.push(id)
          }
        }
      }

      // Check if travel complete
      if (progress >= 1 && !chakram.resolved) {
        chakram.resolved = true
        if (chakram.config.onResolve) {
          chakram.config.onResolve()
        }
        // Remove after completion
        this.remove(id)
      }
    }

    return allHits
  }

  /**
   * Remove a chakram by ID.
   */
  remove(id: string): void {
    const chakram = this.activeChakrams.get(id)
    if (chakram) {
      this.scene.remove(chakram.mesh)
      // Dispose all children
      chakram.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (child.material instanceof THREE.Material) {
            child.material.dispose()
          }
        }
      })
      this.activeChakrams.delete(id)
    }
  }

  /**
   * Remove all active chakrams.
   */
  clear(): void {
    for (const id of this.activeChakrams.keys()) {
      this.remove(id)
    }
  }

  /**
   * Dispose of all resources.
   */
  dispose(): void {
    this.clear()
  }

  /**
   * Get the number of active chakrams.
   */
  getActiveCount(): number {
    return this.activeChakrams.size
  }
}
