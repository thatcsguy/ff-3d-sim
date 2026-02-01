import * as THREE from 'three'
import { ARENA_RADIUS } from './constants'

export class Arena {
  private radius: number
  private mesh: THREE.Mesh | null = null

  constructor(radius: number = ARENA_RADIUS) {
    this.radius = radius
  }

  create(scene: THREE.Scene): void {
    const geometry = new THREE.CircleGeometry(this.radius, 64)
    const material = new THREE.MeshStandardMaterial({
      color: 0x2d3436,
      side: THREE.DoubleSide,
    })
    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.rotation.x = -Math.PI / 2
    this.mesh.position.y = 0
    this.mesh.receiveShadow = true
    scene.add(this.mesh)
  }

  clampToArena(position: THREE.Vector3): THREE.Vector3 {
    const distanceFromCenter = Math.sqrt(
      position.x * position.x + position.z * position.z
    )

    if (distanceFromCenter > this.radius) {
      const scale = this.radius / distanceFromCenter
      position.x *= scale
      position.z *= scale
    }

    return position
  }

  getRadius(): number {
    return this.radius
  }

  getMesh(): THREE.Mesh | null {
    return this.mesh
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose()
      if (this.mesh.material instanceof THREE.Material) {
        this.mesh.material.dispose()
      }
    }
  }
}
