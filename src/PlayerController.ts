import * as THREE from 'three'
import { InputManager, MouseButton } from './InputManager'
import { CameraController } from './CameraController'
import { PLAYER_SPEED, PLAYER_HEIGHT } from './constants'

const JUMP_VELOCITY = 8 // meters per second initial upward velocity
const GRAVITY = 20 // meters per second squared

export class PlayerController {
  private mesh: THREE.Mesh
  private inputManager: InputManager
  private velocity: THREE.Vector3 = new THREE.Vector3()
  private isJumping: boolean = false
  private jumpHorizontalVelocity: THREE.Vector3 = new THREE.Vector3()

  constructor(mesh: THREE.Mesh, inputManager: InputManager) {
    this.mesh = mesh
    this.inputManager = inputManager
  }

  update(deltaTime: number, cameraController: CameraController): void {
    // Get camera direction vectors for movement
    const forward = cameraController.getForwardDirection()
    const right = cameraController.getRightDirection()

    // Calculate movement direction based on input
    const moveDirection = new THREE.Vector3()

    // WASD movement
    if (this.inputManager.isKeyDown('KeyW')) {
      moveDirection.add(forward)
    }
    if (this.inputManager.isKeyDown('KeyS')) {
      moveDirection.sub(forward)
    }
    if (this.inputManager.isKeyDown('KeyA')) {
      moveDirection.sub(right)
    }
    if (this.inputManager.isKeyDown('KeyD')) {
      moveDirection.add(right)
    }

    // Gamepad left stick movement
    const leftStick = this.inputManager.getLeftStick()
    if (Math.abs(leftStick.x) > 0.1 || Math.abs(leftStick.y) > 0.1) {
      moveDirection.addScaledVector(right, leftStick.x)
      moveDirection.addScaledVector(forward, -leftStick.y)
    }

    // Both mouse buttons = move forward
    if (
      this.inputManager.isMouseButtonDown(MouseButton.Left) &&
      this.inputManager.isMouseButtonDown(MouseButton.Right)
    ) {
      moveDirection.add(forward)
    }

    // Calculate horizontal velocity from input
    const inputHorizontalVelocity = new THREE.Vector3()
    if (moveDirection.lengthSq() > 0) {
      moveDirection.normalize()
      inputHorizontalVelocity.set(
        moveDirection.x * PLAYER_SPEED,
        0,
        moveDirection.z * PLAYER_SPEED
      )
    }

    // Jump handling (Space key or Triangle button on gamepad)
    const jumpPressed = this.inputManager.isKeyDown('Space') || this.inputManager.isButtonPressed(3)
    if (jumpPressed && !this.isJumping) {
      this.isJumping = true
      this.velocity.y = JUMP_VELOCITY
      // Snapshot horizontal velocity at jump start
      this.jumpHorizontalVelocity.copy(inputHorizontalVelocity)
    }

    // Apply horizontal movement
    if (this.isJumping) {
      // Use snapshotted velocity while in air
      this.mesh.position.x += this.jumpHorizontalVelocity.x * deltaTime
      this.mesh.position.z += this.jumpHorizontalVelocity.z * deltaTime
    } else {
      // Use input velocity while on ground
      this.mesh.position.x += inputHorizontalVelocity.x * deltaTime
      this.mesh.position.z += inputHorizontalVelocity.z * deltaTime
    }

    if (this.isJumping) {
      // Apply gravity
      this.velocity.y -= GRAVITY * deltaTime
      this.mesh.position.y += this.velocity.y * deltaTime

      // Check for landing
      const groundY = PLAYER_HEIGHT / 2
      if (this.mesh.position.y <= groundY) {
        this.mesh.position.y = groundY
        this.velocity.y = 0
        this.isJumping = false
        this.jumpHorizontalVelocity.set(0, 0, 0)
      }
    }
  }

  getPosition(): THREE.Vector3 {
    return this.mesh.position.clone()
  }

  getMesh(): THREE.Mesh {
    return this.mesh
  }

  isInAir(): boolean {
    return this.isJumping
  }
}
