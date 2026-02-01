import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import { PlayerController } from './PlayerController'
import { InputManager } from './InputManager'
import { CameraController } from './CameraController'
import { PLAYER_SPEED, PLAYER_HEIGHT } from './constants'

describe('PlayerController', () => {
  let mesh: THREE.Mesh
  let inputManager: InputManager
  let cameraController: CameraController
  let playerController: PlayerController
  let element: HTMLElement
  let camera: THREE.PerspectiveCamera

  beforeEach(() => {
    // Create player mesh
    mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 1.8, 16),
      new THREE.MeshStandardMaterial()
    )
    mesh.position.set(0, PLAYER_HEIGHT / 2, 0)

    // Create input manager with DOM element
    element = document.createElement('div')
    document.body.appendChild(element)
    inputManager = new InputManager(element)

    // Create camera controller
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)
    cameraController = new CameraController(camera, inputManager)

    // Create player controller
    playerController = new PlayerController(mesh, inputManager)
  })

  afterEach(() => {
    cameraController.dispose()
    inputManager.dispose()
    document.body.removeChild(element)
  })

  describe('WASD movement', () => {
    it('moves forward when W is pressed', () => {
      const initialZ = mesh.position.z
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))

      playerController.update(0.1, cameraController)

      // Default camera faces -Z direction
      expect(mesh.position.z).toBeLessThan(initialZ)
    })

    it('moves backward when S is pressed', () => {
      const initialZ = mesh.position.z
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }))

      playerController.update(0.1, cameraController)

      expect(mesh.position.z).toBeGreaterThan(initialZ)
    })

    it('strafes left when A is pressed', () => {
      const initialX = mesh.position.x
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }))

      playerController.update(0.1, cameraController)

      expect(mesh.position.x).toBeLessThan(initialX)
    })

    it('strafes right when D is pressed', () => {
      const initialX = mesh.position.x
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))

      playerController.update(0.1, cameraController)

      expect(mesh.position.x).toBeGreaterThan(initialX)
    })

    it('moves diagonally when W+D pressed', () => {
      const initialPos = mesh.position.clone()
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))

      playerController.update(0.1, cameraController)

      expect(mesh.position.z).toBeLessThan(initialPos.z)
      expect(mesh.position.x).toBeGreaterThan(initialPos.x)
    })

    it('does not move when no keys pressed', () => {
      const initialPos = mesh.position.clone()

      playerController.update(0.1, cameraController)

      expect(mesh.position.x).toBe(initialPos.x)
      expect(mesh.position.z).toBe(initialPos.z)
    })

    it('stops moving when key released', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
      playerController.update(0.1, cameraController)
      const posAfterMove = mesh.position.clone()

      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))
      playerController.update(0.1, cameraController)

      expect(mesh.position.x).toBe(posAfterMove.x)
      expect(mesh.position.z).toBe(posAfterMove.z)
    })
  })

  describe('movement speed', () => {
    it('moves at PLAYER_SPEED units per second', () => {
      const initialPos = mesh.position.clone()
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))

      const deltaTime = 1.0 // 1 second
      playerController.update(deltaTime, cameraController)

      const distance = Math.sqrt(
        Math.pow(mesh.position.x - initialPos.x, 2) +
        Math.pow(mesh.position.z - initialPos.z, 2)
      )
      expect(distance).toBeCloseTo(PLAYER_SPEED, 1)
    })

    it('normalizes diagonal movement', () => {
      // Move diagonally
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))
      const initialPos = mesh.position.clone()

      const deltaTime = 1.0
      playerController.update(deltaTime, cameraController)

      const distance = Math.sqrt(
        Math.pow(mesh.position.x - initialPos.x, 2) +
        Math.pow(mesh.position.z - initialPos.z, 2)
      )
      // Diagonal movement should still be PLAYER_SPEED, not sqrt(2) * PLAYER_SPEED
      expect(distance).toBeCloseTo(PLAYER_SPEED, 1)
    })
  })

  describe('mouse button movement', () => {
    it('moves forward when both mouse buttons held', () => {
      const initialZ = mesh.position.z
      element.dispatchEvent(new MouseEvent('mousedown', { button: 0 })) // Left
      element.dispatchEvent(new MouseEvent('mousedown', { button: 2 })) // Right

      playerController.update(0.1, cameraController)

      expect(mesh.position.z).toBeLessThan(initialZ)
    })

    it('does not move forward with only left button', () => {
      const initialZ = mesh.position.z
      element.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))

      playerController.update(0.1, cameraController)

      expect(mesh.position.z).toBe(initialZ)
    })

    it('does not move forward with only right button', () => {
      const initialZ = mesh.position.z
      element.dispatchEvent(new MouseEvent('mousedown', { button: 2 }))

      playerController.update(0.1, cameraController)

      expect(mesh.position.z).toBe(initialZ)
    })
  })

  describe('jump', () => {
    it('starts on ground', () => {
      expect(mesh.position.y).toBe(PLAYER_HEIGHT / 2)
      expect(playerController.isInAir()).toBe(false)
    })

    it('jumps when spacebar pressed', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))

      playerController.update(0.1, cameraController)

      expect(mesh.position.y).toBeGreaterThan(PLAYER_HEIGHT / 2)
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

      expect(mesh.position.y).toBe(PLAYER_HEIGHT / 2)
      expect(playerController.isInAir()).toBe(false)
    })

    it('can move horizontally while jumping', () => {
      const initialX = mesh.position.x
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))

      playerController.update(0.1, cameraController)

      expect(mesh.position.y).toBeGreaterThan(PLAYER_HEIGHT / 2)
      expect(mesh.position.x).toBeGreaterThan(initialX)
    })
  })

  describe('getPosition', () => {
    it('returns current position', () => {
      const pos = playerController.getPosition()
      expect(pos.x).toBe(mesh.position.x)
      expect(pos.y).toBe(mesh.position.y)
      expect(pos.z).toBe(mesh.position.z)
    })

    it('returns a clone, not reference', () => {
      const pos = playerController.getPosition()
      pos.x = 999

      expect(mesh.position.x).not.toBe(999)
    })
  })

  describe('getMesh', () => {
    it('returns the player mesh', () => {
      expect(playerController.getMesh()).toBe(mesh)
    })
  })
})
