import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import { PlayerController } from './PlayerController'
import { InputManager } from './InputManager'
import { CameraController } from './CameraController'
import { PLAYER_SPEED } from './constants'
import { HumanoidMesh } from './HumanoidMesh'

describe('PlayerController', () => {
  let humanoid: HumanoidMesh
  let group: THREE.Group
  let inputManager: InputManager
  let cameraController: CameraController
  let playerController: PlayerController
  let element: HTMLElement
  let camera: THREE.PerspectiveCamera

  beforeEach(() => {
    // Create player humanoid
    humanoid = new HumanoidMesh(0x0984e3)
    group = humanoid.group
    group.position.set(0, 0, 0)

    // Create input manager with DOM element
    element = document.createElement('div')
    document.body.appendChild(element)
    inputManager = new InputManager(element)

    // Create camera controller
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)
    cameraController = new CameraController(camera, inputManager)

    // Create player controller
    playerController = new PlayerController(humanoid, inputManager)
  })

  afterEach(() => {
    cameraController.dispose()
    inputManager.dispose()
    document.body.removeChild(element)
    humanoid.dispose()
  })

  describe('WASD movement', () => {
    it('moves forward when W is pressed', () => {
      const initialZ = group.position.z
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))

      playerController.update(0.1, cameraController)

      // Default camera faces -Z direction
      expect(group.position.z).toBeLessThan(initialZ)
    })

    it('moves backward when S is pressed', () => {
      const initialZ = group.position.z
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }))

      playerController.update(0.1, cameraController)

      expect(group.position.z).toBeGreaterThan(initialZ)
    })

    it('strafes left when A is pressed', () => {
      const initialX = group.position.x
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }))

      playerController.update(0.1, cameraController)

      expect(group.position.x).toBeLessThan(initialX)
    })

    it('strafes right when D is pressed', () => {
      const initialX = group.position.x
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))

      playerController.update(0.1, cameraController)

      expect(group.position.x).toBeGreaterThan(initialX)
    })

    it('moves diagonally when W+D pressed', () => {
      const initialPos = group.position.clone()
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))

      playerController.update(0.1, cameraController)

      expect(group.position.z).toBeLessThan(initialPos.z)
      expect(group.position.x).toBeGreaterThan(initialPos.x)
    })

    it('does not move when no keys pressed', () => {
      const initialPos = group.position.clone()

      playerController.update(0.1, cameraController)

      expect(group.position.x).toBe(initialPos.x)
      expect(group.position.z).toBe(initialPos.z)
    })

    it('stops moving when key released', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
      playerController.update(0.1, cameraController)
      const posAfterMove = group.position.clone()

      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))
      playerController.update(0.1, cameraController)

      expect(group.position.x).toBe(posAfterMove.x)
      expect(group.position.z).toBe(posAfterMove.z)
    })
  })

  describe('movement speed', () => {
    it('moves at PLAYER_SPEED units per second', () => {
      const initialPos = group.position.clone()
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))

      const deltaTime = 1.0 // 1 second
      playerController.update(deltaTime, cameraController)

      const distance = Math.sqrt(
        Math.pow(group.position.x - initialPos.x, 2) +
        Math.pow(group.position.z - initialPos.z, 2)
      )
      expect(distance).toBeCloseTo(PLAYER_SPEED, 1)
    })

    it('normalizes diagonal movement', () => {
      // Move diagonally
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))
      const initialPos = group.position.clone()

      const deltaTime = 1.0
      playerController.update(deltaTime, cameraController)

      const distance = Math.sqrt(
        Math.pow(group.position.x - initialPos.x, 2) +
        Math.pow(group.position.z - initialPos.z, 2)
      )
      // Diagonal movement should still be PLAYER_SPEED, not sqrt(2) * PLAYER_SPEED
      expect(distance).toBeCloseTo(PLAYER_SPEED, 1)
    })
  })

  describe('mouse button movement', () => {
    it('moves forward when both mouse buttons held', () => {
      const initialZ = group.position.z
      element.dispatchEvent(new MouseEvent('mousedown', { button: 0 })) // Left
      element.dispatchEvent(new MouseEvent('mousedown', { button: 2 })) // Right

      playerController.update(0.1, cameraController)

      expect(group.position.z).toBeLessThan(initialZ)
    })

    it('does not move forward with only left button', () => {
      const initialZ = group.position.z
      element.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))

      playerController.update(0.1, cameraController)

      expect(group.position.z).toBe(initialZ)
    })

    it('does not move forward with only right button', () => {
      const initialZ = group.position.z
      element.dispatchEvent(new MouseEvent('mousedown', { button: 2 }))

      playerController.update(0.1, cameraController)

      expect(group.position.z).toBe(initialZ)
    })
  })

  describe('jump', () => {
    it('starts on ground', () => {
      expect(group.position.y).toBe(0)
      expect(playerController.isInAir()).toBe(false)
    })

    it('jumps when spacebar pressed', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))

      playerController.update(0.1, cameraController)

      expect(group.position.y).toBeGreaterThan(0)
      expect(playerController.isInAir()).toBe(true)
    })

    it('cannot double jump', () => {
      // Start jump
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
      playerController.update(0.1, cameraController)

      // Try to jump again mid-air
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
      playerController.update(0.01, cameraController)

      // Should still be in air (double jump didn't reset to ground)
      expect(playerController.isInAir()).toBe(true)
    })

    it('lands back on ground after jump', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
      playerController.update(0.016, cameraController) // Start jump

      // Release spacebar so we don't immediately jump again on landing
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))

      // Simulate several frames of falling (need enough frames for full jump arc)
      for (let i = 0; i < 200; i++) {
        playerController.update(0.016, cameraController)
      }

      expect(group.position.y).toBe(0)
      expect(playerController.isInAir()).toBe(false)
    })

    it('can move horizontally while jumping if moving when jump starts', () => {
      const initialX = group.position.x
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))

      playerController.update(0.1, cameraController)

      expect(group.position.y).toBeGreaterThan(0)
      expect(group.position.x).toBeGreaterThan(initialX)
    })

    it('snapshots velocity at jump start - cannot change direction mid-air', () => {
      // Start moving right and jump
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
      playerController.update(0.1, cameraController)

      const posAfterJump = group.position.clone()

      // Release D and press A (try to change direction mid-air)
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }))
      playerController.update(0.1, cameraController)

      // Should still be moving right (positive X), not left
      expect(group.position.x).toBeGreaterThan(posAfterJump.x)
    })

    it('snapshots velocity at jump start - stationary jump stays stationary', () => {
      // Jump without moving
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
      playerController.update(0.1, cameraController)

      const posAfterJump = group.position.clone()

      // Try to move mid-air
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))
      playerController.update(0.1, cameraController)

      // X position should not change (jumped with no horizontal velocity)
      expect(group.position.x).toBe(posAfterJump.x)
    })

    it('can move again after landing from stationary jump', () => {
      // Jump without moving
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
      playerController.update(0.016, cameraController)

      // Release space and wait to land
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
      for (let i = 0; i < 200; i++) {
        playerController.update(0.016, cameraController)
      }

      // Should be on ground now
      expect(playerController.isInAir()).toBe(false)
      const posOnGround = group.position.clone()

      // Now try to move right
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))
      playerController.update(0.1, cameraController)

      // Should be able to move again
      expect(group.position.x).toBeGreaterThan(posOnGround.x)
    })
  })

  describe('getPosition', () => {
    it('returns current position', () => {
      const pos = playerController.getPosition()
      expect(pos.x).toBe(group.position.x)
      expect(pos.y).toBe(group.position.y)
      expect(pos.z).toBe(group.position.z)
    })

    it('returns a clone, not reference', () => {
      const pos = playerController.getPosition()
      pos.x = 999

      expect(group.position.x).not.toBe(999)
    })
  })

  describe('getGroup', () => {
    it('returns the player group', () => {
      expect(playerController.getGroup()).toBe(group)
    })
  })
})
