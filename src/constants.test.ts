import { describe, it, expect } from 'vitest'
import {
  ARENA_RADIUS,
  PLAYER_SPEED,
  CAMERA_MIN_ZOOM,
  CAMERA_MAX_ZOOM,
  NPC_COUNT,
} from './constants'

describe('constants', () => {
  it('has valid arena radius', () => {
    expect(ARENA_RADIUS).toBeGreaterThan(0)
    expect(ARENA_RADIUS).toBeCloseTo(18.3, 1) // ~20 yalms
  })

  it('has valid player speed', () => {
    expect(PLAYER_SPEED).toBeGreaterThan(0)
  })

  it('has valid camera zoom range', () => {
    expect(CAMERA_MIN_ZOOM).toBeLessThan(CAMERA_MAX_ZOOM)
    expect(CAMERA_MIN_ZOOM).toBeGreaterThan(0)
  })

  it('has correct NPC count', () => {
    expect(NPC_COUNT).toBe(7)
  })
})
