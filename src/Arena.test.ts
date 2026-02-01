import { describe, it, expect, beforeEach } from 'vitest'
import * as THREE from 'three'
import { Arena } from './Arena'
import { ARENA_RADIUS } from './constants'

describe('Arena', () => {
  let arena: Arena

  beforeEach(() => {
    arena = new Arena()
  })

  describe('constructor', () => {
    it('uses default radius from constants', () => {
      expect(arena.getRadius()).toBe(ARENA_RADIUS)
    })

    it('accepts custom radius', () => {
      const customArena = new Arena(10)
      expect(customArena.getRadius()).toBe(10)
    })
  })

  describe('clampToArena', () => {
    it('does not modify positions inside arena', () => {
      const position = new THREE.Vector3(5, 1, 5)
      arena.clampToArena(position)

      expect(position.x).toBe(5)
      expect(position.y).toBe(1) // Y unchanged
      expect(position.z).toBe(5)
    })

    it('does not modify position at origin', () => {
      const position = new THREE.Vector3(0, 0.9, 0)
      arena.clampToArena(position)

      expect(position.x).toBe(0)
      expect(position.y).toBe(0.9)
      expect(position.z).toBe(0)
    })

    it('clamps positions outside arena to boundary', () => {
      const position = new THREE.Vector3(30, 1, 0) // Way outside on X axis
      arena.clampToArena(position)

      expect(position.x).toBeCloseTo(ARENA_RADIUS)
      expect(position.y).toBe(1) // Y unchanged
      expect(position.z).toBeCloseTo(0)
    })

    it('clamps diagonal positions outside arena', () => {
      // Position at 45 degrees, far outside
      const position = new THREE.Vector3(20, 1, 20)
      arena.clampToArena(position)

      const distanceFromCenter = Math.sqrt(
        position.x * position.x + position.z * position.z
      )
      expect(distanceFromCenter).toBeCloseTo(ARENA_RADIUS)
      expect(position.y).toBe(1)
      // Should maintain direction (45 degrees)
      expect(position.x).toBeCloseTo(position.z)
    })

    it('does not modify positions exactly on boundary', () => {
      // Position exactly on boundary along X axis
      const position = new THREE.Vector3(ARENA_RADIUS, 1, 0)
      arena.clampToArena(position)

      expect(position.x).toBeCloseTo(ARENA_RADIUS)
      expect(position.y).toBe(1)
      expect(position.z).toBeCloseTo(0)
    })

    it('handles negative coordinates outside arena', () => {
      const position = new THREE.Vector3(-30, 1, -30)
      arena.clampToArena(position)

      const distanceFromCenter = Math.sqrt(
        position.x * position.x + position.z * position.z
      )
      expect(distanceFromCenter).toBeCloseTo(ARENA_RADIUS)
      expect(position.x).toBeLessThan(0)
      expect(position.z).toBeLessThan(0)
    })

    it('preserves Y coordinate (height)', () => {
      const position = new THREE.Vector3(30, 5, 0)
      arena.clampToArena(position)

      expect(position.y).toBe(5)
    })

    it('returns the modified position', () => {
      const position = new THREE.Vector3(30, 1, 0)
      const result = arena.clampToArena(position)

      expect(result).toBe(position)
    })
  })

  describe('create', () => {
    it('creates arena mesh and adds to scene', () => {
      const scene = new THREE.Scene()
      arena.create(scene)

      expect(arena.getMesh()).not.toBeNull()
      expect(scene.children).toContain(arena.getMesh())
    })

    it('positions arena floor at y=0', () => {
      const scene = new THREE.Scene()
      arena.create(scene)

      expect(arena.getMesh()!.position.y).toBe(0)
    })
  })
})
