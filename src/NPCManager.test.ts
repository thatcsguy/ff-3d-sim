import { describe, it, expect, beforeEach } from 'vitest'
import * as THREE from 'three'
import { NPCManager } from './NPCManager'
import { Arena } from './Arena'
import {
  NPC_COUNT,
  NPC_WANDER_RADIUS,
  ARENA_RADIUS,
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

    it('adds NPC groups to the scene', () => {
      npcManager.spawn(scene)

      const groups = npcManager.getGroups()
      for (const group of groups) {
        expect(scene.children).toContain(group)
      }
    })

    it('spawns NPCs within arena bounds', () => {
      npcManager.spawn(scene)

      const npcs = npcManager.getNPCs()
      for (const npc of npcs) {
        const group = npc.humanoid.group
        const distance = Math.sqrt(
          group.position.x ** 2 + group.position.z ** 2
        )
        expect(distance).toBeLessThanOrEqual(ARENA_RADIUS)
      }
    })

    it('spawns NPCs at ground level', () => {
      npcManager.spawn(scene)

      const npcs = npcManager.getNPCs()
      for (const npc of npcs) {
        expect(npc.humanoid.group.position.y).toBeCloseTo(0)
      }
    })

    it('gives each NPC a unique color', () => {
      npcManager.spawn(scene, 7)

      const groups = npcManager.getGroups()
      const colors: number[] = []
      for (const group of groups) {
        // Get color from first mesh in group (head)
        group.traverse((child) => {
          if (child instanceof THREE.Mesh && colors.length < groups.indexOf(group) + 1) {
            const material = child.material as THREE.MeshStandardMaterial
            colors.push(material.color.getHex())
          }
        })
      }

      // All 7 should be unique
      const uniqueColors = new Set(colors)
      expect(uniqueColors.size).toBe(7)
    })
  })

  describe('update', () => {
    it('moves NPCs toward their target position', () => {
      npcManager.spawn(scene, 1)
      const npc = npcManager.getNPCs()[0]
      const group = npc.humanoid.group

      // Set a specific target far from current position
      const startX = group.position.x
      npc.targetPosition.set(startX + 5, group.position.y, group.position.z)

      // Update should move NPC toward target
      npcManager.update(1) // 1 second

      // Should have moved closer to target
      const movedX = group.position.x
      expect(Math.abs(movedX - (startX + 5))).toBeLessThan(Math.abs(startX - (startX + 5)))
    })

    it('keeps NPCs within arena bounds', () => {
      npcManager.spawn(scene, 1)
      const npc = npcManager.getNPCs()[0]
      const group = npc.humanoid.group

      // Set target outside arena
      npc.homePosition.set(ARENA_RADIUS - 1, 0, 0)
      npc.targetPosition.set(ARENA_RADIUS + 10, 0, 0)
      group.position.copy(npc.homePosition)

      // Multiple updates
      for (let i = 0; i < 100; i++) {
        npcManager.update(0.1)
      }

      const distance = Math.sqrt(
        group.position.x ** 2 + group.position.z ** 2
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
      const group = npc.humanoid.group

      // Put NPC at its target
      npc.targetPosition.copy(group.position)
      npc.wanderTimer = 100 // Prevent picking new target

      const startPos = group.position.clone()
      npcManager.update(1)

      expect(group.position.x).toBeCloseTo(startPos.x, 2)
      expect(group.position.z).toBeCloseTo(startPos.z, 2)
    })
  })

  describe('dispose', () => {
    it('removes all NPC groups from scene', () => {
      npcManager.spawn(scene)
      const childCount = scene.children.length

      npcManager.dispose()

      expect(scene.children.length).toBe(childCount - NPC_COUNT)
    })

    it('clears internal NPC list', () => {
      npcManager.spawn(scene)
      npcManager.dispose()

      expect(npcManager.getNPCCount()).toBe(0)
    })
  })

  describe('getGroups', () => {
    it('returns array of all NPC groups', () => {
      npcManager.spawn(scene, 5)

      const groups = npcManager.getGroups()

      expect(groups).toHaveLength(5)
      for (const group of groups) {
        expect(group).toBeInstanceOf(THREE.Group)
      }
    })
  })
})
