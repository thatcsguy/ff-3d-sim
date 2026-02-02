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
  mesh: THREE.Group
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

// Boss dimensions and colors (~5x player height of 1.8m = ~9m)
const BOSS_CONFIG = {
  cruiseChaser: {
    // Sleek transformer robot with wings
    height: 9.0,
    color: 0x4a90d9, // Steel blue
    accentColor: 0x2c5aa0, // Darker blue
  },
  bruteJustice: {
    // Bulky super robot mech
    height: 9.0,
    color: 0x8b4513, // Saddle brown (rust)
    accentColor: 0xff6b35, // Orange accent
  },
  alexanderPrime: {
    // Angelic golden robot with halo
    height: 9.0,
    color: 0xffd700, // Gold
    accentColor: 0xffffff, // White
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
    const H = config.height
    const group = new THREE.Group()

    const mainMat = new THREE.MeshStandardMaterial({
      color: config.color,
      metalness: 0.8,
      roughness: 0.2,
    })
    const accentMat = new THREE.MeshStandardMaterial({
      color: config.accentColor,
      metalness: 0.9,
      roughness: 0.1,
    })

    // Torso - tapered octagonal body
    const torsoGeo = new THREE.CylinderGeometry(0.6, 0.8, H * 0.35, 8)
    const torso = new THREE.Mesh(torsoGeo, mainMat)
    torso.position.y = H * 0.45
    torso.castShadow = true
    group.add(torso)

    // Head - angular cockpit shape
    const headGeo = new THREE.ConeGeometry(0.5, H * 0.15, 6)
    const head = new THREE.Mesh(headGeo, accentMat)
    head.position.y = H * 0.7
    head.rotation.x = Math.PI // Point down for cockpit look
    head.castShadow = true
    group.add(head)

    // Head visor
    const visorGeo = new THREE.BoxGeometry(0.6, 0.1, 0.3)
    const visor = new THREE.Mesh(visorGeo, accentMat)
    visor.position.set(0, H * 0.75, 0.3)
    group.add(visor)

    // Left wing blade
    const wingGeo = new THREE.BoxGeometry(2.5, 0.1, 0.8)
    const leftWing = new THREE.Mesh(wingGeo, mainMat)
    leftWing.position.set(-1.5, H * 0.55, -0.2)
    leftWing.rotation.z = -0.3
    leftWing.rotation.y = -0.2
    leftWing.castShadow = true
    group.add(leftWing)

    // Right wing blade
    const rightWing = new THREE.Mesh(wingGeo, mainMat)
    rightWing.position.set(1.5, H * 0.55, -0.2)
    rightWing.rotation.z = 0.3
    rightWing.rotation.y = 0.2
    rightWing.castShadow = true
    group.add(rightWing)

    // Waist
    const waistGeo = new THREE.CylinderGeometry(0.5, 0.6, H * 0.1, 8)
    const waist = new THREE.Mesh(waistGeo, accentMat)
    waist.position.y = H * 0.25
    waist.castShadow = true
    group.add(waist)

    // Left leg
    const legGeo = new THREE.CylinderGeometry(0.25, 0.35, H * 0.25, 8)
    const leftLeg = new THREE.Mesh(legGeo, mainMat)
    leftLeg.position.set(-0.4, H * 0.1, 0)
    leftLeg.castShadow = true
    group.add(leftLeg)

    // Right leg
    const rightLeg = new THREE.Mesh(legGeo, mainMat)
    rightLeg.position.set(0.4, H * 0.1, 0)
    rightLeg.castShadow = true
    group.add(rightLeg)

    group.visible = false
    this.scene.add(group)

    this.bosses.set('cruiseChaser', {
      type: 'cruiseChaser',
      mesh: group,
      visible: false,
    })
  }

  private createBruteJustice(): void {
    if (!this.scene) return

    const config = BOSS_CONFIG.bruteJustice
    const H = config.height
    const group = new THREE.Group()

    const mainMat = new THREE.MeshStandardMaterial({
      color: config.color,
      metalness: 0.6,
      roughness: 0.4,
    })
    const accentMat = new THREE.MeshStandardMaterial({
      color: config.accentColor,
      metalness: 0.7,
      roughness: 0.3,
    })

    // Main torso - thick box
    const torsoGeo = new THREE.BoxGeometry(2.0, H * 0.35, 1.5)
    const torso = new THREE.Mesh(torsoGeo, mainMat)
    torso.position.y = H * 0.5
    torso.castShadow = true
    group.add(torso)

    // Head - box with visor
    const headGeo = new THREE.BoxGeometry(1.0, H * 0.12, 0.8)
    const head = new THREE.Mesh(headGeo, mainMat)
    head.position.y = H * 0.75
    head.castShadow = true
    group.add(head)

    // Visor stripe
    const visorGeo = new THREE.BoxGeometry(1.1, H * 0.03, 0.3)
    const visor = new THREE.Mesh(visorGeo, accentMat)
    visor.position.set(0, H * 0.76, 0.35)
    group.add(visor)

    // Left shoulder armor
    const shoulderGeo = new THREE.BoxGeometry(1.0, H * 0.12, 1.0)
    const leftShoulder = new THREE.Mesh(shoulderGeo, mainMat)
    leftShoulder.position.set(-1.5, H * 0.6, 0)
    leftShoulder.rotation.z = -0.2
    leftShoulder.castShadow = true
    group.add(leftShoulder)

    // Right shoulder armor
    const rightShoulder = new THREE.Mesh(shoulderGeo, mainMat)
    rightShoulder.position.set(1.5, H * 0.6, 0)
    rightShoulder.rotation.z = 0.2
    rightShoulder.castShadow = true
    group.add(rightShoulder)

    // Left arm
    const armGeo = new THREE.CylinderGeometry(0.35, 0.4, H * 0.25, 8)
    const leftArm = new THREE.Mesh(armGeo, accentMat)
    leftArm.position.set(-1.5, H * 0.38, 0)
    leftArm.castShadow = true
    group.add(leftArm)

    // Right arm
    const rightArm = new THREE.Mesh(armGeo, accentMat)
    rightArm.position.set(1.5, H * 0.38, 0)
    rightArm.castShadow = true
    group.add(rightArm)

    // Waist/pelvis
    const waistGeo = new THREE.BoxGeometry(1.5, H * 0.08, 1.2)
    const waist = new THREE.Mesh(waistGeo, accentMat)
    waist.position.y = H * 0.28
    waist.castShadow = true
    group.add(waist)

    // Left leg - thick cylinder
    const legGeo = new THREE.CylinderGeometry(0.4, 0.5, H * 0.28, 8)
    const leftLeg = new THREE.Mesh(legGeo, mainMat)
    leftLeg.position.set(-0.5, H * 0.1, 0)
    leftLeg.castShadow = true
    group.add(leftLeg)

    // Right leg
    const rightLeg = new THREE.Mesh(legGeo, mainMat)
    rightLeg.position.set(0.5, H * 0.1, 0)
    rightLeg.castShadow = true
    group.add(rightLeg)

    group.visible = false
    this.scene.add(group)

    this.bosses.set('bruteJustice', {
      type: 'bruteJustice',
      mesh: group,
      visible: false,
    })
  }

  private createAlexanderPrime(): void {
    if (!this.scene) return

    const config = BOSS_CONFIG.alexanderPrime
    const H = config.height
    const group = new THREE.Group()

    const mainMat = new THREE.MeshStandardMaterial({
      color: config.color,
      metalness: 0.9,
      roughness: 0.1,
    })
    const accentMat = new THREE.MeshStandardMaterial({
      color: config.accentColor,
      metalness: 0.5,
      roughness: 0.3,
    })

    // Main body - tall cylinder
    const bodyGeo = new THREE.CylinderGeometry(0.9, 1.2, H * 0.45, 12)
    const body = new THREE.Mesh(bodyGeo, mainMat)
    body.position.y = H * 0.5
    body.castShadow = true
    group.add(body)

    // Head - sphere
    const headGeo = new THREE.SphereGeometry(0.6, 16, 12)
    const head = new THREE.Mesh(headGeo, mainMat)
    head.position.y = H * 0.8
    head.castShadow = true
    group.add(head)

    // Halo ring
    const haloGeo = new THREE.TorusGeometry(1.0, 0.08, 8, 24)
    const halo = new THREE.Mesh(haloGeo, accentMat)
    halo.position.y = H * 0.92
    halo.rotation.x = Math.PI / 2
    group.add(halo)

    // Left shoulder sphere
    const shoulderGeo = new THREE.SphereGeometry(0.5, 12, 8)
    const leftShoulder = new THREE.Mesh(shoulderGeo, mainMat)
    leftShoulder.position.set(-1.3, H * 0.65, 0)
    leftShoulder.castShadow = true
    group.add(leftShoulder)

    // Right shoulder sphere
    const rightShoulder = new THREE.Mesh(shoulderGeo, mainMat)
    rightShoulder.position.set(1.3, H * 0.65, 0)
    rightShoulder.castShadow = true
    group.add(rightShoulder)

    // Left arm - extended outward
    const armGeo = new THREE.CylinderGeometry(0.2, 0.3, H * 0.3, 8)
    const leftArm = new THREE.Mesh(armGeo, mainMat)
    leftArm.position.set(-2.0, H * 0.55, 0)
    leftArm.rotation.z = Math.PI / 3
    leftArm.castShadow = true
    group.add(leftArm)

    // Right arm - extended outward
    const rightArm = new THREE.Mesh(armGeo, mainMat)
    rightArm.position.set(2.0, H * 0.55, 0)
    rightArm.rotation.z = -Math.PI / 3
    rightArm.castShadow = true
    group.add(rightArm)

    // Chest emblem
    const emblemGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 6)
    const emblem = new THREE.Mesh(emblemGeo, accentMat)
    emblem.position.set(0, H * 0.55, 0.95)
    emblem.rotation.x = Math.PI / 2
    group.add(emblem)

    // Lower robe/skirt - cone
    const robeGeo = new THREE.ConeGeometry(1.8, H * 0.3, 12)
    const robe = new THREE.Mesh(robeGeo, mainMat)
    robe.position.y = H * 0.15
    robe.rotation.x = Math.PI // Flip cone
    robe.castShadow = true
    group.add(robe)

    group.visible = false
    this.scene.add(group)

    this.bosses.set('alexanderPrime', {
      type: 'alexanderPrime',
      mesh: group,
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
   * Set boss position (group origin is at ground level).
   */
  setPosition(type: BossType, position: THREE.Vector3): void {
    const boss = this.bosses.get(type)
    if (!boss) return

    boss.mesh.position.set(position.x, 0, position.z)
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
   * Get boss mesh group (for advanced manipulation).
   */
  getMesh(type: BossType): THREE.Group | null {
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

        boss.mesh.position.set(x, arcY, z)

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

        boss.mesh.position.set(x, 0, z)

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
        // Dispose all child meshes in the group
        boss.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose()
            if (child.material instanceof THREE.Material) {
              child.material.dispose()
            }
          }
        })
      }
    }
    this.bosses.clear()
  }
}
