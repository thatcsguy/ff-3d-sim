import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import { CameraController } from './CameraController'
import { InputManager } from './InputManager'
import {
  CAMERA_MIN_ZOOM,
  CAMERA_MAX_ZOOM,
  CAMERA_DEFAULT_ZOOM,
  CAMERA_MIN_PITCH,
  CAMERA_MAX_PITCH,
} from './constants'

describe('CameraController', () => {
  let camera: THREE.PerspectiveCamera
  let inputManager: InputManager
  let cameraController: CameraController
  let element: HTMLElement

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)
    element = document.createElement('div')
    document.body.appendChild(element)
    inputManager = new InputManager(element)
    cameraController = new CameraController(camera, inputManager)
  })

  afterEach(() => {
    cameraController.dispose()
    inputManager.dispose()
    document.body.removeChild(element)
  })

  describe('yaw rotation', () => {
    it('rotates horizontally when right-click held and mouse moved', () => {
      const initialYaw = cameraController.getYaw()
      element.dispatchEvent(new MouseEvent('mousedown', { button: 2 }))
      element.dispatchEvent(new MouseEvent('mousemove', { movementX: 100, movementY: 0 }))

      cameraController.update(0.016, new THREE.Vector3(0, 0, 0))

      expect(cameraController.getYaw()).not.toBe(initialYaw)
    })

    it('does not rotate when no mouse button held', () => {
      const initialYaw = cameraController.getYaw()
      element.dispatchEvent(new MouseEvent('mousemove', { movementX: 100, movementY: 0 }))

      cameraController.update(0.016, new THREE.Vector3(0, 0, 0))

      expect(cameraController.getYaw()).toBe(initialYaw)
    })

    it('rotates with left-click as well', () => {
      const initialYaw = cameraController.getYaw()
      element.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))
      element.dispatchEvent(new MouseEvent('mousemove', { movementX: 100, movementY: 0 }))

      cameraController.update(0.016, new THREE.Vector3(0, 0, 0))

      expect(cameraController.getYaw()).not.toBe(initialYaw)
    })
  })

  describe('pitch clamping', () => {
    it('clamps pitch to maximum', () => {
      element.dispatchEvent(new MouseEvent('mousedown', { button: 2 }))
      // Move mouse far down to pitch up beyond limit
      element.dispatchEvent(new MouseEvent('mousemove', { movementX: 0, movementY: -10000 }))

      cameraController.update(0.016, new THREE.Vector3(0, 0, 0))

      expect(cameraController.getPitch()).toBeLessThanOrEqual(CAMERA_MAX_PITCH)
    })

    it('clamps pitch to minimum', () => {
      element.dispatchEvent(new MouseEvent('mousedown', { button: 2 }))
      // Move mouse far up to pitch down beyond limit
      element.dispatchEvent(new MouseEvent('mousemove', { movementX: 0, movementY: 10000 }))

      cameraController.update(0.016, new THREE.Vector3(0, 0, 0))

      expect(cameraController.getPitch()).toBeGreaterThanOrEqual(CAMERA_MIN_PITCH)
    })
  })

  describe('zoom', () => {
    it('starts at default zoom', () => {
      expect(cameraController.getZoom()).toBe(CAMERA_DEFAULT_ZOOM)
    })

    it('zooms out on scroll down', () => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }))

      expect(cameraController.getZoom()).toBeGreaterThan(CAMERA_DEFAULT_ZOOM)
    })

    it('zooms in on scroll up', () => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 }))

      expect(cameraController.getZoom()).toBeLessThan(CAMERA_DEFAULT_ZOOM)
    })

    it('clamps zoom to maximum', () => {
      // Scroll down many times
      for (let i = 0; i < 50; i++) {
        window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }))
      }

      expect(cameraController.getZoom()).toBeLessThanOrEqual(CAMERA_MAX_ZOOM)
    })

    it('clamps zoom to minimum', () => {
      // Scroll up many times
      for (let i = 0; i < 50; i++) {
        window.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 }))
      }

      expect(cameraController.getZoom()).toBeGreaterThanOrEqual(CAMERA_MIN_ZOOM)
    })
  })

  describe('forward direction', () => {
    it('returns normalized vector', () => {
      const forward = cameraController.getForwardDirection()
      expect(forward.length()).toBeCloseTo(1)
    })

    it('has no Y component (stays on XZ plane)', () => {
      element.dispatchEvent(new MouseEvent('mousedown', { button: 2 }))
      element.dispatchEvent(new MouseEvent('mousemove', { movementX: 50, movementY: 50 }))
      cameraController.update(0.016, new THREE.Vector3(0, 0, 0))

      const forward = cameraController.getForwardDirection()
      expect(forward.y).toBe(0)
    })

    it('changes with yaw rotation', () => {
      const initialForward = cameraController.getForwardDirection().clone()

      element.dispatchEvent(new MouseEvent('mousedown', { button: 2 }))
      element.dispatchEvent(new MouseEvent('mousemove', { movementX: 100, movementY: 0 }))
      cameraController.update(0.016, new THREE.Vector3(0, 0, 0))

      const newForward = cameraController.getForwardDirection()
      expect(newForward.x).not.toBeCloseTo(initialForward.x)
    })
  })

  describe('right direction', () => {
    it('returns normalized vector', () => {
      const right = cameraController.getRightDirection()
      expect(right.length()).toBeCloseTo(1)
    })

    it('has no Y component (stays on XZ plane)', () => {
      const right = cameraController.getRightDirection()
      expect(right.y).toBe(0)
    })

    it('is perpendicular to forward direction', () => {
      const forward = cameraController.getForwardDirection()
      const right = cameraController.getRightDirection()
      const dot = forward.dot(right)
      expect(dot).toBeCloseTo(0)
    })
  })

  describe('camera positioning', () => {
    it('positions camera at zoom distance from target', () => {
      const target = new THREE.Vector3(5, 2, 3)
      cameraController.update(0.016, target)

      const distance = camera.position.distanceTo(target)
      expect(distance).toBeCloseTo(cameraController.getZoom(), 1)
    })

    it('camera looks at target', () => {
      const target = new THREE.Vector3(5, 2, 3)
      cameraController.update(0.016, target)

      // Get world direction camera is facing
      const cameraDirection = new THREE.Vector3()
      camera.getWorldDirection(cameraDirection)

      // Direction from camera to target
      const toTarget = target.clone().sub(camera.position).normalize()

      expect(cameraDirection.dot(toTarget)).toBeCloseTo(1, 1)
    })
  })
})
