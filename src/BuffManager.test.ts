import { describe, it, expect, beforeEach } from 'vitest'
import { BuffManager, StatusEffectConfig } from './BuffManager'

describe('BuffManager', () => {
  let buffManager: BuffManager

  const sprintBuff: StatusEffectConfig = {
    id: 'sprint',
    name: 'Sprint',
    type: 'buff',
    duration: 10,
  }

  const armsLengthBuff: StatusEffectConfig = {
    id: 'arms-length',
    name: "Arm's Length",
    type: 'buff',
    duration: 6,
  }

  const magicVulnDebuff: StatusEffectConfig = {
    id: 'magic-vuln',
    name: 'Magic Vulnerability Up',
    type: 'debuff',
    duration: 10,
  }

  const physicalVulnDebuff: StatusEffectConfig = {
    id: 'physical-vuln',
    name: 'Physical Vulnerability Up',
    type: 'debuff',
    duration: 17,
  }

  beforeEach(() => {
    buffManager = new BuffManager()
  })

  describe('apply', () => {
    it('adds a buff to an entity', () => {
      buffManager.apply('player', sprintBuff)

      expect(buffManager.has('player', 'sprint')).toBe(true)
    })

    it('adds a debuff to an entity', () => {
      buffManager.apply('player', magicVulnDebuff)

      expect(buffManager.has('player', 'magic-vuln')).toBe(true)
    })

    it('sets initial remaining time to full duration', () => {
      buffManager.apply('player', sprintBuff)

      const effect = buffManager.get('player', 'sprint')
      expect(effect?.remainingTime).toBe(10)
    })

    it('refreshes duration when reapplying same effect', () => {
      buffManager.apply('player', sprintBuff)

      // Simulate time passing
      buffManager.update(5) // 5 seconds left

      // Reapply - should refresh to full duration
      buffManager.apply('player', sprintBuff)

      const effect = buffManager.get('player', 'sprint')
      expect(effect?.remainingTime).toBe(10)
    })

    it('allows different effects on same entity', () => {
      buffManager.apply('player', sprintBuff)
      buffManager.apply('player', armsLengthBuff)

      expect(buffManager.has('player', 'sprint')).toBe(true)
      expect(buffManager.has('player', 'arms-length')).toBe(true)
    })

    it('allows same effect on different entities', () => {
      buffManager.apply('player', sprintBuff)
      buffManager.apply('npc1', sprintBuff)

      expect(buffManager.has('player', 'sprint')).toBe(true)
      expect(buffManager.has('npc1', 'sprint')).toBe(true)
    })
  })

  describe('remove', () => {
    it('removes an effect from an entity', () => {
      buffManager.apply('player', sprintBuff)
      buffManager.remove('player', 'sprint')

      expect(buffManager.has('player', 'sprint')).toBe(false)
    })

    it('does not affect other effects on same entity', () => {
      buffManager.apply('player', sprintBuff)
      buffManager.apply('player', armsLengthBuff)

      buffManager.remove('player', 'sprint')

      expect(buffManager.has('player', 'sprint')).toBe(false)
      expect(buffManager.has('player', 'arms-length')).toBe(true)
    })

    it('does not affect same effect on other entities', () => {
      buffManager.apply('player', sprintBuff)
      buffManager.apply('npc1', sprintBuff)

      buffManager.remove('player', 'sprint')

      expect(buffManager.has('player', 'sprint')).toBe(false)
      expect(buffManager.has('npc1', 'sprint')).toBe(true)
    })

    it('handles removing non-existent effect gracefully', () => {
      expect(() => {
        buffManager.remove('player', 'nonexistent')
      }).not.toThrow()
    })
  })

  describe('has', () => {
    it('returns true for existing effect', () => {
      buffManager.apply('player', sprintBuff)

      expect(buffManager.has('player', 'sprint')).toBe(true)
    })

    it('returns false for non-existent effect', () => {
      expect(buffManager.has('player', 'sprint')).toBe(false)
    })

    it('returns false for effect on different entity', () => {
      buffManager.apply('npc1', sprintBuff)

      expect(buffManager.has('player', 'sprint')).toBe(false)
    })
  })

  describe('get', () => {
    it('returns effect config and remaining time', () => {
      buffManager.apply('player', sprintBuff)

      const effect = buffManager.get('player', 'sprint')

      expect(effect?.config).toEqual(sprintBuff)
      expect(effect?.remainingTime).toBe(10)
    })

    it('returns undefined for non-existent effect', () => {
      expect(buffManager.get('player', 'sprint')).toBeUndefined()
    })
  })

  describe('getBuffs', () => {
    it('returns only buffs for entity', () => {
      buffManager.apply('player', sprintBuff)
      buffManager.apply('player', armsLengthBuff)
      buffManager.apply('player', magicVulnDebuff)

      const buffs = buffManager.getBuffs('player')

      expect(buffs).toHaveLength(2)
      expect(buffs.map((b) => b.config.id)).toContain('sprint')
      expect(buffs.map((b) => b.config.id)).toContain('arms-length')
    })

    it('returns empty array when no buffs', () => {
      buffManager.apply('player', magicVulnDebuff)

      expect(buffManager.getBuffs('player')).toHaveLength(0)
    })
  })

  describe('getDebuffs', () => {
    it('returns only debuffs for entity', () => {
      buffManager.apply('player', sprintBuff)
      buffManager.apply('player', magicVulnDebuff)
      buffManager.apply('player', physicalVulnDebuff)

      const debuffs = buffManager.getDebuffs('player')

      expect(debuffs).toHaveLength(2)
      expect(debuffs.map((d) => d.config.id)).toContain('magic-vuln')
      expect(debuffs.map((d) => d.config.id)).toContain('physical-vuln')
    })

    it('returns empty array when no debuffs', () => {
      buffManager.apply('player', sprintBuff)

      expect(buffManager.getDebuffs('player')).toHaveLength(0)
    })
  })

  describe('getAll', () => {
    it('returns all effects for entity', () => {
      buffManager.apply('player', sprintBuff)
      buffManager.apply('player', magicVulnDebuff)

      const all = buffManager.getAll('player')

      expect(all).toHaveLength(2)
    })

    it('does not include effects from other entities', () => {
      buffManager.apply('player', sprintBuff)
      buffManager.apply('npc1', armsLengthBuff)

      const all = buffManager.getAll('player')

      expect(all).toHaveLength(1)
      expect(all[0].config.id).toBe('sprint')
    })
  })

  describe('update', () => {
    it('decrements remaining time', () => {
      buffManager.apply('player', sprintBuff)

      buffManager.update(3)

      const effect = buffManager.get('player', 'sprint')
      expect(effect?.remainingTime).toBe(7)
    })

    it('removes effects when time expires', () => {
      buffManager.apply('player', sprintBuff)

      buffManager.update(10) // Exactly full duration

      expect(buffManager.has('player', 'sprint')).toBe(false)
    })

    it('removes effects when time goes negative', () => {
      buffManager.apply('player', sprintBuff)

      buffManager.update(15) // More than duration

      expect(buffManager.has('player', 'sprint')).toBe(false)
    })

    it('returns expired effect IDs', () => {
      buffManager.apply('player', sprintBuff)
      buffManager.apply('player', armsLengthBuff)

      // Arms Length (6s) should expire, Sprint (10s) should not
      const expired = buffManager.update(7)

      expect(expired).toContain('arms-length')
      expect(expired).not.toContain('sprint')
    })

    it('handles multiple effects expiring same frame', () => {
      buffManager.apply('player', sprintBuff)
      buffManager.apply('player', armsLengthBuff)

      const expired = buffManager.update(11)

      expect(expired).toContain('sprint')
      expect(expired).toContain('arms-length')
    })

    it('updates effects on all entities', () => {
      buffManager.apply('player', sprintBuff)
      buffManager.apply('npc1', sprintBuff)

      buffManager.update(3)

      expect(buffManager.get('player', 'sprint')?.remainingTime).toBe(7)
      expect(buffManager.get('npc1', 'sprint')?.remainingTime).toBe(7)
    })
  })

  describe('clearEntity', () => {
    it('removes all effects from specified entity', () => {
      buffManager.apply('player', sprintBuff)
      buffManager.apply('player', magicVulnDebuff)

      buffManager.clearEntity('player')

      expect(buffManager.getAll('player')).toHaveLength(0)
    })

    it('does not affect other entities', () => {
      buffManager.apply('player', sprintBuff)
      buffManager.apply('npc1', sprintBuff)

      buffManager.clearEntity('player')

      expect(buffManager.has('player', 'sprint')).toBe(false)
      expect(buffManager.has('npc1', 'sprint')).toBe(true)
    })
  })

  describe('clear', () => {
    it('removes all effects from all entities', () => {
      buffManager.apply('player', sprintBuff)
      buffManager.apply('npc1', armsLengthBuff)
      buffManager.apply('npc2', magicVulnDebuff)

      buffManager.clear()

      expect(buffManager.getAll('player')).toHaveLength(0)
      expect(buffManager.getAll('npc1')).toHaveLength(0)
      expect(buffManager.getAll('npc2')).toHaveLength(0)
    })
  })

  describe('dispose', () => {
    it('clears all effects', () => {
      buffManager.apply('player', sprintBuff)

      buffManager.dispose()

      expect(buffManager.has('player', 'sprint')).toBe(false)
    })
  })
})
