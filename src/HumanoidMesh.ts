import * as THREE from 'three'

/**
 * Creates a humanoid mesh group with head, torso, arms, and legs.
 * Includes simple walking animation.
 */
export class HumanoidMesh {
  public group: THREE.Group
  private head: THREE.Mesh
  private torso: THREE.Mesh
  private leftArm: THREE.Group
  private rightArm: THREE.Group
  private leftLeg: THREE.Group
  private rightLeg: THREE.Group

  // Animation state
  private walkCycle: number = 0
  private isMoving: boolean = false
  private targetRotation: number = 0
  private currentRotation: number = 0

  // Body proportions (relative to PLAYER_HEIGHT of 1.8m)
  private static readonly HEAD_RADIUS = 0.18
  private static readonly TORSO_HEIGHT = 0.5
  private static readonly TORSO_WIDTH = 0.35
  private static readonly TORSO_DEPTH = 0.2
  private static readonly ARM_LENGTH = 0.45
  private static readonly ARM_RADIUS = 0.07
  private static readonly LEG_LENGTH = 0.5
  private static readonly LEG_RADIUS = 0.09

  constructor(color: number) {
    this.group = new THREE.Group()

    const material = new THREE.MeshStandardMaterial({ color })

    // Calculate vertical positions (from feet at y=0)
    const torsoY = HumanoidMesh.LEG_LENGTH + HumanoidMesh.TORSO_HEIGHT / 2
    const headY = HumanoidMesh.LEG_LENGTH + HumanoidMesh.TORSO_HEIGHT + HumanoidMesh.HEAD_RADIUS
    const armY = HumanoidMesh.LEG_LENGTH + HumanoidMesh.TORSO_HEIGHT - 0.05
    const shoulderOffset = HumanoidMesh.TORSO_WIDTH / 2 + HumanoidMesh.ARM_RADIUS

    // Head (sphere)
    const headGeometry = new THREE.SphereGeometry(HumanoidMesh.HEAD_RADIUS, 12, 8)
    this.head = new THREE.Mesh(headGeometry, material)
    this.head.position.y = headY
    this.head.castShadow = true
    this.group.add(this.head)

    // Face (smiley on front of head)
    const faceTexture = this.createFaceTexture()
    const faceMaterial = new THREE.MeshBasicMaterial({
      map: faceTexture,
      transparent: true,
      depthWrite: false,
    })
    const faceSize = HumanoidMesh.HEAD_RADIUS * 1.2
    const faceGeometry = new THREE.PlaneGeometry(faceSize, faceSize)
    const face = new THREE.Mesh(faceGeometry, faceMaterial)
    // Position slightly in front of head center (positive Z is forward)
    face.position.set(0, headY, HumanoidMesh.HEAD_RADIUS * 0.95)
    this.group.add(face)

    // Torso (box)
    const torsoGeometry = new THREE.BoxGeometry(
      HumanoidMesh.TORSO_WIDTH,
      HumanoidMesh.TORSO_HEIGHT,
      HumanoidMesh.TORSO_DEPTH
    )
    this.torso = new THREE.Mesh(torsoGeometry, material)
    this.torso.position.y = torsoY
    this.torso.castShadow = true
    this.group.add(this.torso)

    // Arms (cylinders inside groups for rotation pivots)
    const armGeometry = new THREE.CylinderGeometry(
      HumanoidMesh.ARM_RADIUS,
      HumanoidMesh.ARM_RADIUS,
      HumanoidMesh.ARM_LENGTH,
      8
    )

    // Left arm
    this.leftArm = new THREE.Group()
    this.leftArm.position.set(-shoulderOffset, armY, 0)
    const leftArmMesh = new THREE.Mesh(armGeometry, material)
    leftArmMesh.position.y = -HumanoidMesh.ARM_LENGTH / 2
    leftArmMesh.castShadow = true
    this.leftArm.add(leftArmMesh)
    this.group.add(this.leftArm)

    // Right arm
    this.rightArm = new THREE.Group()
    this.rightArm.position.set(shoulderOffset, armY, 0)
    const rightArmMesh = new THREE.Mesh(armGeometry, material)
    rightArmMesh.position.y = -HumanoidMesh.ARM_LENGTH / 2
    rightArmMesh.castShadow = true
    this.rightArm.add(rightArmMesh)
    this.group.add(this.rightArm)

    // Legs (cylinders inside groups for rotation pivots)
    const legGeometry = new THREE.CylinderGeometry(
      HumanoidMesh.LEG_RADIUS,
      HumanoidMesh.LEG_RADIUS,
      HumanoidMesh.LEG_LENGTH,
      8
    )
    const hipOffset = HumanoidMesh.TORSO_WIDTH / 4

    // Left leg
    this.leftLeg = new THREE.Group()
    this.leftLeg.position.set(-hipOffset, HumanoidMesh.LEG_LENGTH, 0)
    const leftLegMesh = new THREE.Mesh(legGeometry, material)
    leftLegMesh.position.y = -HumanoidMesh.LEG_LENGTH / 2
    leftLegMesh.castShadow = true
    this.leftLeg.add(leftLegMesh)
    this.group.add(this.leftLeg)

    // Right leg
    this.rightLeg = new THREE.Group()
    this.rightLeg.position.set(hipOffset, HumanoidMesh.LEG_LENGTH, 0)
    const rightLegMesh = new THREE.Mesh(legGeometry, material)
    rightLegMesh.position.y = -HumanoidMesh.LEG_LENGTH / 2
    rightLegMesh.castShadow = true
    this.rightLeg.add(rightLegMesh)
    this.group.add(this.rightLeg)
  }

  /**
   * Update walking animation and facing direction.
   * @param deltaTime Time since last frame in seconds
   * @param movementDirection Normalized direction of movement (or zero vector if stationary)
   */
  update(deltaTime: number, movementDirection?: THREE.Vector3): void {
    // Check if moving
    const wasMoving = this.isMoving
    this.isMoving = movementDirection !== undefined && movementDirection.lengthSq() > 0.01

    // Update target rotation based on movement direction
    if (this.isMoving && movementDirection) {
      this.targetRotation = Math.atan2(movementDirection.x, movementDirection.z)
    }

    // Smoothly interpolate rotation
    const rotationSpeed = 10 // radians per second
    let rotationDiff = this.targetRotation - this.currentRotation

    // Normalize to [-PI, PI] for shortest path
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2

    const maxRotation = rotationSpeed * deltaTime
    if (Math.abs(rotationDiff) < maxRotation) {
      this.currentRotation = this.targetRotation
    } else {
      this.currentRotation += Math.sign(rotationDiff) * maxRotation
    }

    // Normalize current rotation
    while (this.currentRotation > Math.PI) this.currentRotation -= Math.PI * 2
    while (this.currentRotation < -Math.PI) this.currentRotation += Math.PI * 2

    this.group.rotation.y = this.currentRotation

    // Walking animation
    if (this.isMoving) {
      // Advance walk cycle
      const walkSpeed = 10 // cycles per second
      this.walkCycle += deltaTime * walkSpeed

      // Sinusoidal arm/leg swing
      const swingAngle = Math.sin(this.walkCycle) * 0.5 // ~30 degrees max

      // Arms swing opposite to legs
      this.leftArm.rotation.x = swingAngle
      this.rightArm.rotation.x = -swingAngle

      // Legs swing
      this.leftLeg.rotation.x = -swingAngle
      this.rightLeg.rotation.x = swingAngle
    } else {
      // Smoothly return to idle pose
      const returnSpeed = 5
      this.leftArm.rotation.x *= Math.max(0, 1 - returnSpeed * deltaTime)
      this.rightArm.rotation.x *= Math.max(0, 1 - returnSpeed * deltaTime)
      this.leftLeg.rotation.x *= Math.max(0, 1 - returnSpeed * deltaTime)
      this.rightLeg.rotation.x *= Math.max(0, 1 - returnSpeed * deltaTime)

      // Reset walk cycle
      if (!wasMoving) {
        this.walkCycle = 0
      }
    }
  }

  /**
   * Create a canvas texture with a simple smiley face.
   */
  private createFaceTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    const size = 64
    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext('2d')!

    // Transparent background
    ctx.clearRect(0, 0, size, size)

    // Eyes (black dots)
    ctx.fillStyle = '#000000'
    const eyeY = size * 0.38
    const eyeRadius = size * 0.08
    // Left eye
    ctx.beginPath()
    ctx.arc(size * 0.35, eyeY, eyeRadius, 0, Math.PI * 2)
    ctx.fill()
    // Right eye
    ctx.beginPath()
    ctx.arc(size * 0.65, eyeY, eyeRadius, 0, Math.PI * 2)
    ctx.fill()

    // Smile (arc)
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = size * 0.06
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(size * 0.5, size * 0.45, size * 0.25, Math.PI * 0.2, Math.PI * 0.8)
    ctx.stroke()

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
  }

  /**
   * Set the facing direction immediately without animation.
   */
  setRotation(rotation: number): void {
    this.currentRotation = rotation
    this.targetRotation = rotation
    this.group.rotation.y = rotation
  }

  /**
   * Get the current facing rotation.
   */
  getRotation(): number {
    return this.currentRotation
  }

  /**
   * Dispose of all geometries and materials.
   */
  dispose(): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (child.material instanceof THREE.Material) {
          child.material.dispose()
        }
      }
    })
  }
}
