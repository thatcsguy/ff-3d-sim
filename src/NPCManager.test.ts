import { describe, it, expect, beforeEach } from 'vitest'
import * as THREE from 'three'
import { NPCManager } from './NPCManager'
import { Arena } from './Arena'
import {
  NPC_COUNT,
  NPC_WANDER_RADIUS,
  ARENA_RADIUS,
  PLAYER_HEIGHT,
} from './constants'

describe('NPCManager', () => {
  let npcManager: NPCManager
  let arena: Arena
  let scene: THREE.Scene

  beforeEach(() => {
    arena = new Arena()
    npcManager = new NPCManager(arena)
    scene = new THREE.Scene()
  })

  describe('spawn', () => {
    it('spawns the default number of NPCs', () => {
      npcManager.spawn(scene)

      expect(npcManager.getNPCCount()).toBe(NPC_COUNT)
    })

    it('spawns a custom number of NPCs', () => {
      npcManager.spawn(scene, 3)

      expect(npcManager.getNPCCount()).toBe(3)
    })

    it('adds NPC meshes to the scene', () => {
      npcManager.spawn(scene)

      const meshes = npcManager.getMeshes()
      for (const mesh of meshes) {
        expect(scene.children).toContain(mesh)
      }
    })

    it('spawns NPCs within arena bounds', () => {
      npcManager.spawn(scene)

      const npcs = npcManager.getNPCs()
      for (const npc of npcs) {
        const distance = Math.sqrt(
          npc.mesh.position.x ** 2 + npc.mesh.position.z ** 2
        )
        expect(distance).toBeLessThanOrEqual(ARENA_RADIUS)
      }
    })

    it('spawns NPCs at correct height', () => {
      npcManager.spawn(scene)

      const npcs = npcManager.getNPCs()
      for (const npc of npcs) {
        expect(npc.mesh.position.y).toBeCloseTo(PLAYER_HEIGHT / 2)
      }
    })

    it('gives each NPC a unique color', () => {
      npcManager.spawn(scene, 7)

      const meshes = npcManager.getMeshes()
      const colors = meshes.map((mesh) => {
        const material = mesh.material as THREE.MeshStandardMaterial
        return material.color.getHex()
      })

      // All 7 should be unique
      const uniqueColors = new Set(colors)
      expect(uniqueColors.size).toBe(7)
    })
  })

  describe('update', () => {
    it('moves NPCs toward their target position', () => {
      npcManager.spawn(scene, 1)
      const npc = npcManager.getNPCs()[0]

      // Set a specific target far from current position
      const startX = npc.mesh.position.x
      npc.targetPosition.set(startX + 5, npc.mesh.position.y, npc.mesh.position.z)

      // Update should move NPC toward target
      npcManager.update(1) // 1 second

      // Should have moved closer to target
      const movedX = npc.mesh.position.x
      expect(Math.abs(movedX - (startX + 5))).toBeLessThan(Math.abs(startX - (startX + 5)))
    })

    it('keeps NPCs within arena bounds', () => {
      npcManager.spawn(scene, 1)
      const npc = npcManager.getNPCs()[0]

      // Set target outside arena
      npc.homePosition.set(ARENA_RADIUS - 1, PLAYER_HEIGHT / 2, 0)
      npc.targetPosition.set(ARENA_RADIUS + 10, PLAYER_HEIGHT / 2, 0)
      npc.mesh.position.copy(npc.homePosition)

      // Multiple updates
      for (let i = 0; i < 100; i++) {
        npcManager.update(0.1)
      }

      const distance = Math.sqrt(
        npc.mesh.position.x ** 2 + npc.mesh.position.z ** 2
      )
      expect(distance).toBeLessThanOrEqual(ARENA_RADIUS + 0.01) // Small tolerance
    })

    it('NPCs stay within wander radius of home position', () => {
      npcManager.spawn(scene, 1)
      const npc = npcManager.getNPCs()[0]

      // Force timer to pick new targets many times
      for (let i = 0; i < 50; i++) {
        npc.wanderTimer = 0
        npcManager.update(0.1)

        // Target should be within wander radius of home
        const targetDistance = Math.sqrt(
          (npc.targetPosition.x - npc.homePosition.x) ** 2 +
            (npc.targetPosition.z - npc.homePosition.z) ** 2
        )
        expect(targetDistance).toBeLessThanOrEqual(NPC_WANDER_RADIUS + 0.01)
      }
    })

    it('NPCs stop moving when at target', () => {
      npcManager.spawn(scene, 1)
      const npc = npcManager.getNPCs()[0]

      // Put NPC at its target
      npc.targetPosition.copy(npc.mesh.position)
      npc.wanderTimer = 100 // Prevent picking new target

      const startPos = npc.mesh.position.clone()
      npcManager.update(1)

      expect(npc.mesh.position.x).toBeCloseTo(startPos.x, 2)
      expect(npc.mesh.position.z).toBeCloseTo(startPos.z, 2)
    })
  })

  describe('dispose', () => {
    it('removes all NPC meshes from scene', () => {
      npcManager.spawn(scene)
      const meshCount = scene.children.length

      npcManager.dispose()

      expect(scene.children.length).toBe(meshCount - NPC_COUNT)
    })

    it('clears internal NPC list', () => {
      npcManager.spawn(scene)
      npcManager.dispose()

      expect(npcManager.getNPCCount()).toBe(0)
    })
  })

  describe('getMeshes', () => {
    it('returns array of all NPC meshes', () => {
      npcManager.spawn(scene, 5)

      const meshes = npcManager.getMeshes()

      expect(meshes).toHaveLength(5)
      for (const mesh of meshes) {
        expect(mesh).toBeInstanceOf(THREE.Mesh)
      }
    })
  })
})
