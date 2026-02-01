import * as THREE from 'three'

/**
 * AoE (Area of Effect) types supported by the system.
 */
export type AoEShape = 'circle' | 'line' | 'cone'

/**
 * Configuration for spawning an AoE.
 */
export interface AoEConfig {
  id: string
  shape: AoEShape
  position: THREE.Vector3 // center position (Y is ignored, placed on ground)
  radius?: number // for circle: the radius
  length?: number // for line: length of the line
  width?: number // for line: width of the line
  rotation?: number // for line/cone: rotation in radians (0 = pointing +Z)
  angle?: number // for cone: angle of the cone in radians (full width)
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

    const material = new THREE.MeshBasicMaterial({
      color: TELEGRAPH_COLOR,
      transparent: true,
      opacity: TELEGRAPH_OPACITY,
      side: THREE.DoubleSide,
      depthWrite: false, // prevent z-fighting with arena floor
    })

    switch (config.shape) {
      case 'circle':
        geometry = new THREE.CircleGeometry(config.radius!, 32)
        mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(config.position.x, 0.01, config.position.z)
        mesh.rotation.x = -Math.PI / 2
        break
      case 'line': {
        const length = config.length!
        const width = config.width!
        const rotation = config.rotation ?? 0
        // PlaneGeometry: width along X, height along Y (before rotation)
        // We want length along the line direction, width perpendicular
        geometry = new THREE.PlaneGeometry(width, length)
        mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(config.position.x, 0.01, config.position.z)
        // Rotate to lay flat on XZ plane, then apply direction rotation around Y
        mesh.rotation.x = -Math.PI / 2
        mesh.rotation.z = rotation
        break
      }
      case 'cone': {
        const coneRadius = config.radius!
        const coneAngle = config.angle!
        const rotation = config.rotation ?? 0
        // CircleSectorGeometry: create a pie-slice shape
        // thetaStart and thetaLength define the arc
        // We center the cone on the rotation angle
        const segments = 32
        geometry = new THREE.CircleGeometry(
          coneRadius,
          segments,
          -coneAngle / 2, // thetaStart: offset by half the angle to center
          coneAngle // thetaLength: the cone's angular width
        )
        mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(config.position.x, 0.01, config.position.z)
        // Rotate to lay flat on XZ plane, then apply direction rotation around Y
        mesh.rotation.x = -Math.PI / 2
        mesh.rotation.z = rotation
        break
      }
      default:
        throw new Error(`Unknown AoE shape: ${config.shape}`)
    }

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
        return distanceSquared <= config.radius! * config.radius!
      }
      case 'line': {
        // Transform player position to AoE local space (rotate around center)
        const dx = playerPosition.x - config.position.x
        const dz = playerPosition.z - config.position.z
        const rotation = config.rotation ?? 0
        // Rotate point by -rotation to align with AoE local axes
        const cos = Math.cos(-rotation)
        const sin = Math.sin(-rotation)
        const localX = dx * cos - dz * sin
        const localZ = dx * sin + dz * cos
        // Check if point is within the axis-aligned rectangle
        const halfWidth = config.width! / 2
        const halfLength = config.length! / 2
        return Math.abs(localX) <= halfWidth && Math.abs(localZ) <= halfLength
      }
      case 'cone': {
        const dx = playerPosition.x - config.position.x
        const dz = playerPosition.z - config.position.z
        const distanceSquared = dx * dx + dz * dz
        // Check if within radius
        if (distanceSquared > config.radius! * config.radius!) {
          return false
        }
        // Check if within angle
        // Get angle from cone origin to player
        const playerAngle = Math.atan2(dx, dz) // angle in XZ plane (0 = +Z)
        const coneRotation = config.rotation ?? 0
        // Normalize the angular difference to [-PI, PI]
        let angleDiff = playerAngle - coneRotation
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI
        // Check if within half-angle of cone
        return Math.abs(angleDiff) <= config.angle! / 2
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
