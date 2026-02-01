import * as THREE from 'three'

/**
 * AoE (Area of Effect) types supported by the system.
 */
export type AoEShape = 'circle'

/**
 * Configuration for spawning an AoE.
 */
export interface AoEConfig {
  id: string
  shape: AoEShape
  position: THREE.Vector3 // center position (Y is ignored, placed on ground)
  radius: number // for circle: the radius
  telegraphDuration: number // how long the telegraph shows before resolving (seconds)
  onResolve?: () => void // callback when AoE resolves (for damage checks)
}

/**
 * Internal state for an active AoE.
 */
interface ActiveAoE {
  config: AoEConfig
  mesh: THREE.Mesh
  elapsedTime: number
  resolved: boolean
}

// FFXIV-style orange color for telegraphs
const TELEGRAPH_COLOR = 0xf5a623
const TELEGRAPH_OPACITY = 0.5

/**
 * Manages AoE telegraphs and their lifecycle.
 */
export class AoEManager {
  private scene: THREE.Scene
  private activeAoEs: Map<string, ActiveAoE> = new Map()

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  /**
   * Spawn a new AoE telegraph.
   */
  spawn(config: AoEConfig): void {
    // Don't spawn duplicate IDs
    if (this.activeAoEs.has(config.id)) {
      console.warn(`AoE with id "${config.id}" already exists`)
      return
    }

    const mesh = this.createMesh(config)
    this.scene.add(mesh)

    this.activeAoEs.set(config.id, {
      config,
      mesh,
      elapsedTime: 0,
      resolved: false,
    })
  }

  /**
   * Create the visual mesh for an AoE based on its shape.
   */
  private createMesh(config: AoEConfig): THREE.Mesh {
    let geometry: THREE.BufferGeometry
    let mesh: THREE.Mesh

    switch (config.shape) {
      case 'circle':
        geometry = new THREE.CircleGeometry(config.radius, 32)
        break
      default:
        throw new Error(`Unknown AoE shape: ${config.shape}`)
    }

    const material = new THREE.MeshBasicMaterial({
      color: TELEGRAPH_COLOR,
      transparent: true,
      opacity: TELEGRAPH_OPACITY,
      side: THREE.DoubleSide,
      depthWrite: false, // prevent z-fighting with arena floor
    })

    mesh = new THREE.Mesh(geometry, material)
    // Position on ground plane, slightly above to prevent z-fighting
    mesh.position.set(config.position.x, 0.01, config.position.z)
    // Rotate to lay flat on XZ plane
    mesh.rotation.x = -Math.PI / 2

    return mesh
  }

  /**
   * Update all active AoEs. Call this every frame.
   * @param deltaTime Time elapsed since last update in seconds
   * @param playerPosition Current player position for collision detection
   * @returns Array of AoE IDs that hit the player this frame
   */
  update(deltaTime: number, playerPosition: THREE.Vector3): string[] {
    const hits: string[] = []

    for (const [id, aoe] of this.activeAoEs) {
      aoe.elapsedTime += deltaTime

      // Check if it's time to resolve
      if (!aoe.resolved && aoe.elapsedTime >= aoe.config.telegraphDuration) {
        aoe.resolved = true

        // Flash effect on resolution
        this.flashAoE(aoe)

        // Check collision with player
        if (this.checkCollision(aoe.config, playerPosition)) {
          hits.push(id)
        }

        // Call the resolve callback if provided
        if (aoe.config.onResolve) {
          aoe.config.onResolve()
        }

        // Remove after a short delay to show the flash
        setTimeout(() => this.remove(id), 200)
      }
    }

    return hits
  }

  /**
   * Flash the AoE to indicate resolution.
   */
  private flashAoE(aoe: ActiveAoE): void {
    const material = aoe.mesh.material as THREE.MeshBasicMaterial
    // Brighten and make more opaque
    material.color.setHex(0xffff00)
    material.opacity = 0.8
  }

  /**
   * Check if the player is inside the AoE.
   */
  private checkCollision(config: AoEConfig, playerPosition: THREE.Vector3): boolean {
    switch (config.shape) {
      case 'circle': {
        const dx = playerPosition.x - config.position.x
        const dz = playerPosition.z - config.position.z
        const distanceSquared = dx * dx + dz * dz
        return distanceSquared <= config.radius * config.radius
      }
      default:
        return false
    }
  }

  /**
   * Remove an AoE by ID.
   */
  remove(id: string): void {
    const aoe = this.activeAoEs.get(id)
    if (aoe) {
      this.scene.remove(aoe.mesh)
      aoe.mesh.geometry.dispose()
      if (aoe.mesh.material instanceof THREE.Material) {
        aoe.mesh.material.dispose()
      }
      this.activeAoEs.delete(id)
    }
  }

  /**
   * Remove all active AoEs.
   */
  clear(): void {
    for (const id of this.activeAoEs.keys()) {
      this.remove(id)
    }
  }

  /**
   * Dispose of all resources.
   */
  dispose(): void {
    this.clear()
  }
}
