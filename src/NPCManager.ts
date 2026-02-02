import * as THREE from 'three'
import { Arena } from './Arena'
import {
  NPC_COUNT,
  NPC_WANDER_RADIUS,
  ARENA_RADIUS,
  PLAYER_SPEED,
} from './constants'
import { HumanoidMesh } from './HumanoidMesh'

const NPC_SPEED = PLAYER_SPEED // Same speed as player
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
  humanoid: HumanoidMesh
  homePosition: THREE.Vector3
  targetPosition: THREE.Vector3
  wanderTimer: number
  lastMoveDirection: THREE.Vector3
}

export class NPCManager {
  private npcs: NPC[] = []
  private scene: THREE.Scene | null = null
  private arena: Arena
  private scriptedMode: boolean = false
  private scriptedPositions: Map<number, THREE.Vector3> = new Map()

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
        0,
        Math.sin(angle) * distance
      )

      // Create NPC humanoid mesh
      const humanoid = new HumanoidMesh(NPC_COLORS[i % NPC_COLORS.length])
      humanoid.group.position.copy(homePosition)
      scene.add(humanoid.group)

      const npc: NPC = {
        humanoid,
        homePosition: homePosition.clone(),
        targetPosition: homePosition.clone(),
        wanderTimer: Math.random() * 2, // Stagger initial wander
        lastMoveDirection: new THREE.Vector3(),
      }

      this.npcs.push(npc)
    }
  }

  update(deltaTime: number): void {
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i]
      const group = npc.humanoid.group

      // In scripted mode, move toward scripted position instead of wandering
      if (this.scriptedMode) {
        const scriptedPos = this.scriptedPositions.get(i)
        if (scriptedPos) {
          npc.targetPosition.copy(scriptedPos)
          npc.targetPosition.y = 0 // Keep at ground level
        }
      } else {
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
            0,
            npc.homePosition.z + Math.sin(angle) * distance
          )

          // Clamp target to arena
          this.arena.clampToArena(npc.targetPosition)
        }
      }

      // Move toward target
      const direction = new THREE.Vector3()
        .subVectors(npc.targetPosition, group.position)
        .setY(0) // Keep movement horizontal

      const distanceToTarget = direction.length()

      if (distanceToTarget > 0.1) {
        direction.normalize()
        npc.lastMoveDirection.copy(direction)
        const moveDistance = Math.min(NPC_SPEED * deltaTime, distanceToTarget)
        group.position.x += direction.x * moveDistance
        group.position.z += direction.z * moveDistance
      }

      // Safety clamp to arena
      this.arena.clampToArena(group.position)

      // Update humanoid animation
      const animationDirection = distanceToTarget > 0.1 ? npc.lastMoveDirection : undefined
      npc.humanoid.update(deltaTime, animationDirection)
    }
  }

  getNPCs(): NPC[] {
    return this.npcs
  }

  getNPCCount(): number {
    return this.npcs.length
  }

  getGroups(): THREE.Group[] {
    return this.npcs.map((npc) => npc.humanoid.group)
  }

  /**
   * Enable or disable scripted movement mode.
   * When enabled, NPCs move toward scripted positions instead of wandering.
   */
  setScriptedMode(enabled: boolean): void {
    this.scriptedMode = enabled
  }

  /**
   * Set a scripted position for an NPC (by index).
   * NPC will move toward this position when in scripted mode.
   */
  setScriptedPosition(npcIndex: number, position: THREE.Vector3): void {
    this.scriptedPositions.set(npcIndex, position.clone())
  }

  /**
   * Set scripted positions for all NPCs based on their assigned party numbers.
   * @param positions Map of party number (1-8) to position. Player is excluded.
   * @param playerNumber The number assigned to the player (to skip).
   */
  setScriptedPositionsByNumber(
    positions: Map<number, THREE.Vector3>,
    playerNumber: number
  ): void {
    // NPCs are numbered 2-8 when player is 1, but can shift based on player's number
    // NPC index i has party number: if partyNum <= playerNumber, it's i+2, else i+1
    // Actually simpler: NPCs fill slots not taken by player
    let npcIndex = 0
    for (let partyNum = 1; partyNum <= 8; partyNum++) {
      if (partyNum === playerNumber) continue
      const pos = positions.get(partyNum)
      if (pos && npcIndex < this.npcs.length) {
        this.setScriptedPosition(npcIndex, pos)
      }
      npcIndex++
    }
  }

  /**
   * Clear all scripted positions.
   */
  clearScriptedPositions(): void {
    this.scriptedPositions.clear()
  }

  /**
   * Immediately teleport an NPC to a position.
   */
  teleportNPC(npcIndex: number, position: THREE.Vector3): void {
    if (npcIndex >= 0 && npcIndex < this.npcs.length) {
      this.npcs[npcIndex].humanoid.group.position.copy(position)
      this.npcs[npcIndex].humanoid.group.position.y = 0
    }
  }

  /**
   * Teleport all NPCs by party number (excluding player).
   */
  teleportByNumber(
    positions: Map<number, THREE.Vector3>,
    playerNumber: number
  ): void {
    let npcIndex = 0
    for (let partyNum = 1; partyNum <= 8; partyNum++) {
      if (partyNum === playerNumber) continue
      const pos = positions.get(partyNum)
      if (pos && npcIndex < this.npcs.length) {
        this.teleportNPC(npcIndex, pos)
      }
      npcIndex++
    }
  }

  dispose(): void {
    if (this.scene) {
      for (const npc of this.npcs) {
        this.scene.remove(npc.humanoid.group)
        npc.humanoid.dispose()
      }
    }
    this.npcs = []
  }
}
