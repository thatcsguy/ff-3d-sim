import * as THREE from 'three'
import { ARENA_RADIUS } from './constants'

export class Arena {
  private radius: number
  private mesh: THREE.Mesh | null = null
  private textureLoader: THREE.TextureLoader

  constructor(radius: number = ARENA_RADIUS) {
    this.radius = radius
    this.textureLoader = new THREE.TextureLoader()
  }

  create(scene: THREE.Scene): void {
    const geometry = new THREE.CircleGeometry(this.radius, 64)

    // Scale UVs so the arena edge aligns with the golden ring outside the red gems
    const uvScale = 0.93
    const uvAttribute = geometry.attributes.uv
    for (let i = 0; i < uvAttribute.count; i++) {
      const u = uvAttribute.getX(i)
      const v = uvAttribute.getY(i)
      // Remap from [0,1] to centered and scaled
      uvAttribute.setXY(i, (u - 0.5) * uvScale + 0.5, (v - 0.5) * uvScale + 0.5)
    }

    const texture = this.textureLoader.load('textures/arena-floor.jpg')
    texture.colorSpace = THREE.SRGBColorSpace

    const material = new THREE.MeshStandardMaterial({
      map: texture,
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
      if (this.mesh.material instanceof THREE.MeshStandardMaterial) {
        if (this.mesh.material.map) {
          this.mesh.material.map.dispose()
        }
        this.mesh.material.dispose()
      }
    }
  }
}
