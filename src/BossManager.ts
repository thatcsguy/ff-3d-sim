import * as THREE from 'three'

/**
 * Boss types for Wormhole Formation mechanic.
 * Each boss has a distinct geometric shape per PRD:
 * - Cruise Chaser: slim cylinder (agile robot)
 * - Brute Justice: wide box (bulky mech)
 * - Alexander Prime: tall pillar (giant robot)
 */
export type BossType = 'cruiseChaser' | 'bruteJustice' | 'alexanderPrime'

interface Boss {
  type: BossType
  mesh: THREE.Mesh
  visible: boolean
}

// Boss dimensions and colors
const BOSS_CONFIG = {
  cruiseChaser: {
    // Slim cylinder - agile robot
    radius: 0.6,
    height: 2.5,
    color: 0x4a90d9, // Steel blue
  },
  bruteJustice: {
    // Wide box - bulky mech
    width: 2.0,
    height: 2.2,
    depth: 1.5,
    color: 0x8b4513, // Saddle brown (rust)
  },
  alexanderPrime: {
    // Tall pillar - giant robot
    radius: 1.0,
    height: 5.0,
    color: 0xffd700, // Gold
  },
} as const

export class BossManager {
  private bosses: Map<BossType, Boss> = new Map()
  private scene: THREE.Scene | null = null

  constructor() {}

  /**
   * Initialize all boss meshes (hidden by default).
   * Call this once during game setup.
   */
  spawn(scene: THREE.Scene): void {
    this.scene = scene

    // Create Cruise Chaser (slim cylinder)
    this.createCruiseChaser()

    // Create Brute Justice (wide box)
    this.createBruteJustice()

    // Create Alexander Prime (tall pillar)
    this.createAlexanderPrime()
  }

  private createCruiseChaser(): void {
    if (!this.scene) return

    const config = BOSS_CONFIG.cruiseChaser
    const geometry = new THREE.CylinderGeometry(
      config.radius,
      config.radius,
      config.height,
      16
    )
    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      metalness: 0.7,
      roughness: 0.3,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(0, config.height / 2, 0)
    mesh.castShadow = true
    mesh.visible = false // Hidden until mechanic starts

    this.scene.add(mesh)

    this.bosses.set('cruiseChaser', {
      type: 'cruiseChaser',
      mesh,
      visible: false,
    })
  }

  private createBruteJustice(): void {
    if (!this.scene) return

    const config = BOSS_CONFIG.bruteJustice
    const geometry = new THREE.BoxGeometry(
      config.width,
      config.height,
      config.depth
    )
    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      metalness: 0.7,
      roughness: 0.3,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(0, config.height / 2, 0)
    mesh.castShadow = true
    mesh.visible = false // Hidden until mechanic starts

    this.scene.add(mesh)

    this.bosses.set('bruteJustice', {
      type: 'bruteJustice',
      mesh,
      visible: false,
    })
  }

  private createAlexanderPrime(): void {
    if (!this.scene) return

    const config = BOSS_CONFIG.alexanderPrime
    const geometry = new THREE.CylinderGeometry(
      config.radius,
      config.radius,
      config.height,
      16
    )
    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      metalness: 0.7,
      roughness: 0.3,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(0, config.height / 2, 0)
    mesh.castShadow = true
    mesh.visible = false // Hidden until mechanic starts

    this.scene.add(mesh)

    this.bosses.set('alexanderPrime', {
      type: 'alexanderPrime',
      mesh,
      visible: false,
    })
  }

  /**
   * Show a boss at a specific position.
   */
  show(type: BossType, position?: THREE.Vector3): void {
    const boss = this.bosses.get(type)
    if (!boss) return

    boss.visible = true
    boss.mesh.visible = true

    if (position) {
      this.setPosition(type, position)
    }
  }

  /**
   * Hide a boss.
   */
  hide(type: BossType): void {
    const boss = this.bosses.get(type)
    if (!boss) return

    boss.visible = false
    boss.mesh.visible = false
  }

  /**
   * Set boss position (Y adjusted for height automatically).
   */
  setPosition(type: BossType, position: THREE.Vector3): void {
    const boss = this.bosses.get(type)
    if (!boss) return

    const height = this.getBossHeight(type)
    boss.mesh.position.set(position.x, height / 2, position.z)
  }

  /**
   * Set boss rotation (Y-axis rotation in radians).
   */
  setRotation(type: BossType, rotationY: number): void {
    const boss = this.bosses.get(type)
    if (!boss) return

    boss.mesh.rotation.y = rotationY
  }

  /**
   * Get boss position.
   */
  getPosition(type: BossType): THREE.Vector3 | null {
    const boss = this.bosses.get(type)
    if (!boss) return null
    return boss.mesh.position.clone()
  }

  /**
   * Get boss mesh (for advanced manipulation).
   */
  getMesh(type: BossType): THREE.Mesh | null {
    const boss = this.bosses.get(type)
    if (!boss) return null
    return boss.mesh
  }

  /**
   * Check if boss is currently visible.
   */
  isVisible(type: BossType): boolean {
    const boss = this.bosses.get(type)
    return boss?.visible ?? false
  }

  private getBossHeight(type: BossType): number {
    switch (type) {
      case 'cruiseChaser':
        return BOSS_CONFIG.cruiseChaser.height
      case 'bruteJustice':
        return BOSS_CONFIG.bruteJustice.height
      case 'alexanderPrime':
        return BOSS_CONFIG.alexanderPrime.height
    }
  }

  /**
   * Update boss state (called each frame).
   * Currently a no-op, but will handle animations/movement in future.
   */
  update(_deltaTime: number): void {
    // Future: Handle boss animations, movement interpolation, etc.
  }

  dispose(): void {
    if (this.scene) {
      for (const boss of this.bosses.values()) {
        this.scene.remove(boss.mesh)
        boss.mesh.geometry.dispose()
        if (boss.mesh.material instanceof THREE.Material) {
          boss.mesh.material.dispose()
        }
      }
    }
    this.bosses.clear()
  }
}
