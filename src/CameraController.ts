import * as THREE from 'three'
import { InputManager, MouseButton } from './InputManager'
import {
  CAMERA_MIN_ZOOM,
  CAMERA_MAX_ZOOM,
  CAMERA_DEFAULT_ZOOM,
  CAMERA_MIN_PITCH,
  CAMERA_MAX_PITCH,
} from './constants'

const ROTATION_SENSITIVITY = 0.003
const ZOOM_SENSITIVITY = 1.5

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

  update(_deltaTime: number, targetPosition: THREE.Vector3): void {
    // Only rotate camera when right-click or left-click is held
    if (
      this.inputManager.isMouseButtonDown(MouseButton.Right) ||
      this.inputManager.isMouseButtonDown(MouseButton.Left)
    ) {
      const delta = this.inputManager.getMouseDelta()
      this.yaw -= delta.x * ROTATION_SENSITIVITY
      this.pitch -= delta.y * ROTATION_SENSITIVITY
      this.pitch = Math.max(CAMERA_MIN_PITCH, Math.min(CAMERA_MAX_PITCH, this.pitch))
    }

    this.inputManager.resetMouseDelta()

    // Calculate camera position in spherical coordinates around target
    const offsetX = this.zoom * Math.sin(this.yaw) * Math.cos(this.pitch)
    const offsetY = this.zoom * Math.sin(this.pitch)
    const offsetZ = this.zoom * Math.cos(this.yaw) * Math.cos(this.pitch)

    this.camera.position.set(
      targetPosition.x + offsetX,
      targetPosition.y + offsetY,
      targetPosition.z + offsetZ
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
