import * as THREE from 'three'
import { Arena } from './Arena'
import {
  NPC_COUNT,
  NPC_WANDER_RADIUS,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  ARENA_RADIUS,
} from './constants'

const NPC_SPEED = 2.0 // meters per second (slower than player)
const NPC_COLORS = [
  0xe74c3c, // red
  0x2ecc71, // green
  0x9b59b6, // purple
  0xe67e22, // orange
  0x1abc9c, // teal
  0xf1c40f, // yellow
  0xecf0f1, // white
]

interface NPC {
  mesh: THREE.Mesh
  homePosition: THREE.Vector3
  targetPosition: THREE.Vector3
  wanderTimer: number
}

export class NPCManager {
  private npcs: NPC[] = []
  private scene: THREE.Scene | null = null
  private arena: Arena

  constructor(arena: Arena) {
    this.arena = arena
  }

  spawn(scene: THREE.Scene, count: number = NPC_COUNT): void {
    this.scene = scene

    for (let i = 0; i < count; i++) {
      // Random home position within arena (with buffer from edge)
      const spawnRadius = ARENA_RADIUS - NPC_WANDER_RADIUS - 1
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5
      const distance = spawnRadius * 0.3 + Math.random() * spawnRadius * 0.6

      const homePosition = new THREE.Vector3(
        Math.cos(angle) * distance,
        PLAYER_HEIGHT / 2,
        Math.sin(angle) * distance
      )

      // Create NPC mesh
      const geometry = new THREE.CylinderGeometry(
        PLAYER_RADIUS,
        PLAYER_RADIUS,
        PLAYER_HEIGHT,
        16
      )
      const material = new THREE.MeshStandardMaterial({
        color: NPC_COLORS[i % NPC_COLORS.length],
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.copy(homePosition)
      scene.add(mesh)

      const npc: NPC = {
        mesh,
        homePosition: homePosition.clone(),
        targetPosition: homePosition.clone(),
        wanderTimer: Math.random() * 2, // Stagger initial wander
      }

      this.npcs.push(npc)
    }
  }

  update(deltaTime: number): void {
    for (const npc of this.npcs) {
      // Update wander timer
      npc.wanderTimer -= deltaTime

      // Pick new target when timer expires
      if (npc.wanderTimer <= 0) {
        npc.wanderTimer = 2 + Math.random() * 3 // 2-5 seconds between moves

        // Random offset from home position
        const angle = Math.random() * Math.PI * 2
        const distance = Math.random() * NPC_WANDER_RADIUS

        npc.targetPosition.set(
          npc.homePosition.x + Math.cos(angle) * distance,
          npc.homePosition.y,
          npc.homePosition.z + Math.sin(angle) * distance
        )

        // Clamp target to arena
        this.arena.clampToArena(npc.targetPosition)
      }

      // Move toward target
      const direction = new THREE.Vector3()
        .subVectors(npc.targetPosition, npc.mesh.position)
        .setY(0) // Keep movement horizontal

      const distanceToTarget = direction.length()

      if (distanceToTarget > 0.1) {
        direction.normalize()
        const moveDistance = Math.min(NPC_SPEED * deltaTime, distanceToTarget)
        npc.mesh.position.x += direction.x * moveDistance
        npc.mesh.position.z += direction.z * moveDistance
      }

      // Safety clamp to arena
      this.arena.clampToArena(npc.mesh.position)
    }
  }

  getNPCs(): NPC[] {
    return this.npcs
  }

  getNPCCount(): number {
    return this.npcs.length
  }

  getMeshes(): THREE.Mesh[] {
    return this.npcs.map((npc) => npc.mesh)
  }

  dispose(): void {
    if (this.scene) {
      for (const npc of this.npcs) {
        this.scene.remove(npc.mesh)
        npc.mesh.geometry.dispose()
        if (npc.mesh.material instanceof THREE.Material) {
          npc.mesh.material.dispose()
        }
      }
    }
    this.npcs = []
  }
}
