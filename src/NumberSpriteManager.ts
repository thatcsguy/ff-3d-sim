import * as THREE from 'three'
import { PLAYER_HEIGHT } from './constants'

// Number sprite settings
const NUMBER_SPRITE_SIZE = 0.8 // meters
const NUMBER_SPRITE_OFFSET_Y = 0.5 // meters above entity head

interface TrackedEntity {
  mesh: THREE.Object3D
  sprite: THREE.Sprite
  number: number
}

/**
 * Manages overhead number sprites for party members (player and NPCs).
 * Numbers are displayed as FFXIV-style circular markers that billboard toward the camera.
 */
export class NumberSpriteManager {
  private scene: THREE.Scene | null = null
  private entities: Map<string, TrackedEntity> = new Map()

  /**
   * Initializes the manager with a scene reference.
   */
  init(scene: THREE.Scene): void {
    this.scene = scene
  }

  /**
   * Creates a canvas-based texture for a number sprite.
   * Returns a texture with the number rendered in FFXIV-style.
   */
  private createNumberTexture(num: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    const size = 128
    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext('2d')!

    // Draw circular background (orange/yellow like FFXIV markers)
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2)
    ctx.fillStyle = '#ff9500'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 4
    ctx.stroke()

    // Draw number
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 72px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(num.toString(), size / 2, size / 2)

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
  }

  /**
   * Creates a sprite with a number.
   */
  private createSprite(num: number): THREE.Sprite {
    const texture = this.createNumberTexture(num)
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false, // Always render on top
    })
    const sprite = new THREE.Sprite(material)
    sprite.scale.set(NUMBER_SPRITE_SIZE, NUMBER_SPRITE_SIZE, 1)
    return sprite
  }

  /**
   * Assigns a number to an entity (identified by a unique ID).
   * The sprite will follow the entity's mesh position.
   */
  assignNumber(id: string, mesh: THREE.Object3D, num: number): void {
    if (!this.scene) return

    // Remove existing sprite for this entity if any
    this.removeNumber(id)

    // Create new sprite
    const sprite = this.createSprite(num)
    sprite.position.copy(mesh.position)
    sprite.position.y = mesh.position.y + PLAYER_HEIGHT / 2 + NUMBER_SPRITE_OFFSET_Y
    this.scene.add(sprite)

    this.entities.set(id, { mesh, sprite, number: num })
  }

  /**
   * Removes the number sprite for an entity.
   */
  removeNumber(id: string): void {
    const entity = this.entities.get(id)
    if (entity && this.scene) {
      this.scene.remove(entity.sprite)
      if (entity.sprite.material instanceof THREE.SpriteMaterial) {
        entity.sprite.material.map?.dispose()
        entity.sprite.material.dispose()
      }
      this.entities.delete(id)
    }
  }

  /**
   * Clears all number sprites.
   */
  clearAll(): void {
    for (const id of this.entities.keys()) {
      this.removeNumber(id)
    }
  }

  /**
   * Updates sprite positions to follow their meshes.
   * Should be called every frame.
   */
  update(): void {
    for (const entity of this.entities.values()) {
      entity.sprite.position.copy(entity.mesh.position)
      entity.sprite.position.y =
        entity.mesh.position.y + PLAYER_HEIGHT / 2 + NUMBER_SPRITE_OFFSET_Y
    }
  }

  /**
   * Cleans up all resources.
   */
  dispose(): void {
    this.clearAll()
    this.scene = null
  }
}
