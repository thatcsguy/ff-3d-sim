import * as THREE from 'three'
import { InputManager, MouseButton } from './InputManager'
import {
  CAMERA_MIN_ZOOM,
  CAMERA_MAX_ZOOM,
  CAMERA_DEFAULT_ZOOM,
  CAMERA_MIN_PITCH,
  CAMERA_MAX_PITCH,
  CAMERA_FLOOR_HEIGHT,
} from './constants'

const ROTATION_SENSITIVITY = 0.003
const ZOOM_SENSITIVITY = 1.5
const GAMEPAD_ROTATION_SPEED = 2.5 // radians per second at full stick deflection
const STICK_DEADZONE = 0.1

export class CameraController {
  private camera: THREE.PerspectiveCamera
  private inputManager: InputManager
  private yaw: number = 0 // Horizontal rotation in radians
  private pitch: number = 0.5 // Vertical rotation in radians (start slightly elevated)
  private zoom: number = CAMERA_DEFAULT_ZOOM

  constructor(camera: THREE.PerspectiveCamera, inputManager: InputManager) {
    this.camera = camera
    this.inputManager = inputManager
    this.attachScrollListener()
  }

  private attachScrollListener(): void {
    window.addEventListener('wheel', this.onWheel, { passive: false })
  }

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    const delta = event.deltaY > 0 ? ZOOM_SENSITIVITY : -ZOOM_SENSITIVITY
    this.zoom = Math.max(CAMERA_MIN_ZOOM, Math.min(CAMERA_MAX_ZOOM, this.zoom + delta))
  }

  update(deltaTime: number, targetPosition: THREE.Vector3): void {
    // Only rotate camera when right-click or left-click is held
    if (
      this.inputManager.isMouseButtonDown(MouseButton.Right) ||
      this.inputManager.isMouseButtonDown(MouseButton.Left)
    ) {
      const delta = this.inputManager.getMouseDelta()
      this.yaw -= delta.x * ROTATION_SENSITIVITY
      this.pitch += delta.y * ROTATION_SENSITIVITY
      this.pitch = Math.max(CAMERA_MIN_PITCH, Math.min(CAMERA_MAX_PITCH, this.pitch))
    }

    this.inputManager.resetMouseDelta()

    // Gamepad right stick camera rotation
    const rightStick = this.inputManager.getRightStick()
    if (Math.abs(rightStick.x) > STICK_DEADZONE || Math.abs(rightStick.y) > STICK_DEADZONE) {
      this.yaw -= rightStick.x * GAMEPAD_ROTATION_SPEED * deltaTime
      this.pitch += rightStick.y * GAMEPAD_ROTATION_SPEED * deltaTime
      this.pitch = Math.max(CAMERA_MIN_PITCH, Math.min(CAMERA_MAX_PITCH, this.pitch))
    }

    // Calculate camera position in spherical coordinates around target
    // Apply floor collision: reduce effective zoom if camera would go below floor
    let effectiveZoom = this.zoom
    const offsetY = effectiveZoom * Math.sin(this.pitch)
    const cameraY = targetPosition.y + offsetY

    if (cameraY < CAMERA_FLOOR_HEIGHT && this.pitch < 0) {
      // Camera would be below floor - calculate max zoom that keeps it above
      const maxZoomForFloor = (targetPosition.y - CAMERA_FLOOR_HEIGHT) / Math.abs(Math.sin(this.pitch))
      effectiveZoom = Math.max(CAMERA_MIN_ZOOM, Math.min(effectiveZoom, maxZoomForFloor))
    }

    const finalOffsetX = effectiveZoom * Math.sin(this.yaw) * Math.cos(this.pitch)
    const finalOffsetY = effectiveZoom * Math.sin(this.pitch)
    const finalOffsetZ = effectiveZoom * Math.cos(this.yaw) * Math.cos(this.pitch)

    this.camera.position.set(
      targetPosition.x + finalOffsetX,
      Math.max(CAMERA_FLOOR_HEIGHT, targetPosition.y + finalOffsetY),
      targetPosition.z + finalOffsetZ
    )
    this.camera.lookAt(targetPosition)
  }

  getForwardDirection(): THREE.Vector3 {
    // Forward direction on the XZ plane (ignores pitch)
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize()
  }

  getRightDirection(): THREE.Vector3 {
    // Right direction perpendicular to forward on XZ plane
    // Forward = (-sin(yaw), 0, -cos(yaw)), so right = (cos(yaw), 0, -sin(yaw))
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize()
  }

  getYaw(): number {
    return this.yaw
  }

  getPitch(): number {
    return this.pitch
  }

  getZoom(): number {
    return this.zoom
  }

  dispose(): void {
    window.removeEventListener('wheel', this.onWheel)
  }
}
