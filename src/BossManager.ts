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

interface JumpAnimation {
  bossType: BossType
  startPosition: THREE.Vector3
  endPosition: THREE.Vector3
  peakHeight: number
  duration: number
  elapsed: number
  onComplete?: () => void
}

interface DashAnimation {
  bossType: BossType
  startPosition: THREE.Vector3
  endPosition: THREE.Vector3
  duration: number
  elapsed: number
  onComplete?: () => void
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
  private activeJump: JumpAnimation | null = null
  private activeDash: DashAnimation | null = null

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
   * Start a parabolic jump animation for a boss.
   * The boss will arc from start to end position over the given duration.
   *
   * @param type Boss to animate
   * @param endPosition Target landing position (XZ, Y is auto-calculated)
   * @param duration Time in seconds for the jump
   * @param peakHeight Maximum height above ground during arc (default 10m)
   * @param onComplete Optional callback when jump finishes
   */
  startJumpArc(
    type: BossType,
    endPosition: THREE.Vector3,
    duration: number,
    peakHeight: number = 10,
    onComplete?: () => void
  ): void {
    const boss = this.bosses.get(type)
    if (!boss) return

    const startPosition = boss.mesh.position.clone()
    // Store XZ ground positions (Y will be calculated during animation)
    const startGround = new THREE.Vector3(
      startPosition.x,
      0,
      startPosition.z
    )
    const endGround = new THREE.Vector3(endPosition.x, 0, endPosition.z)

    this.activeJump = {
      bossType: type,
      startPosition: startGround,
      endPosition: endGround,
      peakHeight,
      duration,
      elapsed: 0,
      onComplete,
    }
  }

  /**
   * Check if a boss is currently jumping.
   */
  isJumping(type: BossType): boolean {
    return this.activeJump?.bossType === type
  }

  /**
   * Start a fast linear dash animation for a boss.
   * The boss will move in a straight line from start through target to end position.
   *
   * @param type Boss to animate
   * @param targetPosition Position the boss is dashing towards
   * @param endPosition Final position (typically outside arena)
   * @param duration Time in seconds for the dash
   * @param onComplete Optional callback when dash finishes
   */
  startDash(
    type: BossType,
    targetPosition: THREE.Vector3,
    endPosition: THREE.Vector3,
    duration: number,
    onComplete?: () => void
  ): void {
    const boss = this.bosses.get(type)
    if (!boss) return

    const startPosition = boss.mesh.position.clone()
    const startGround = new THREE.Vector3(startPosition.x, 0, startPosition.z)
    const endGround = new THREE.Vector3(endPosition.x, 0, endPosition.z)

    // Face the target before dashing
    this.lookAt(type, targetPosition)

    this.activeDash = {
      bossType: type,
      startPosition: startGround,
      endPosition: endGround,
      duration,
      elapsed: 0,
      onComplete,
    }
  }

  /**
   * Check if a boss is currently dashing.
   */
  isDashing(type: BossType): boolean {
    return this.activeDash?.bossType === type
  }

  /**
   * Rotate a boss to face a target position.
   * @param type Boss to rotate
   * @param targetPosition Position to face (Y is ignored)
   */
  lookAt(type: BossType, targetPosition: THREE.Vector3): void {
    const boss = this.bosses.get(type)
    if (!boss) return

    const bossPos = boss.mesh.position
    const dx = targetPosition.x - bossPos.x
    const dz = targetPosition.z - bossPos.z
    // atan2(dx, dz) gives angle where 0 = +Z, positive = clockwise
    const angle = Math.atan2(dx, dz)
    boss.mesh.rotation.y = angle
  }

  /**
   * Update boss state (called each frame).
   * Handles jump arc and dash animations.
   */
  update(deltaTime: number): void {
    // Handle jump animation
    if (this.activeJump) {
      this.activeJump.elapsed += deltaTime
      const t = Math.min(this.activeJump.elapsed / this.activeJump.duration, 1)

      const boss = this.bosses.get(this.activeJump.bossType)
      if (!boss) {
        this.activeJump = null
      } else {
        // Linear interpolation for XZ position
        const x =
          this.activeJump.startPosition.x +
          (this.activeJump.endPosition.x - this.activeJump.startPosition.x) * t
        const z =
          this.activeJump.startPosition.z +
          (this.activeJump.endPosition.z - this.activeJump.startPosition.z) * t

        // Parabolic arc for Y: peaks at t=0.5
        // y = 4 * peakHeight * t * (1 - t)
        const arcY = 4 * this.activeJump.peakHeight * t * (1 - t)
        const bossHeight = this.getBossHeight(this.activeJump.bossType)
        const y = arcY + bossHeight / 2

        boss.mesh.position.set(x, y, z)

        // Animation complete
        if (t >= 1) {
          const onComplete = this.activeJump.onComplete
          this.activeJump = null
          if (onComplete) {
            onComplete()
          }
        }
      }
    }

    // Handle dash animation
    if (this.activeDash) {
      this.activeDash.elapsed += deltaTime
      const t = Math.min(this.activeDash.elapsed / this.activeDash.duration, 1)

      const boss = this.bosses.get(this.activeDash.bossType)
      if (!boss) {
        this.activeDash = null
      } else {
        // Linear interpolation for XZ position
        const x =
          this.activeDash.startPosition.x +
          (this.activeDash.endPosition.x - this.activeDash.startPosition.x) * t
        const z =
          this.activeDash.startPosition.z +
          (this.activeDash.endPosition.z - this.activeDash.startPosition.z) * t

        const bossHeight = this.getBossHeight(this.activeDash.bossType)
        boss.mesh.position.set(x, bossHeight / 2, z)

        // Animation complete
        if (t >= 1) {
          const onComplete = this.activeDash.onComplete
          this.activeDash = null
          if (onComplete) {
            onComplete()
          }
        }
      }
    }
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
