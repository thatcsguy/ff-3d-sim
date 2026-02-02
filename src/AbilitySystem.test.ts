import { describe, it, expect, beforeEach } from 'vitest'
import { AbilitySystem, ABILITIES } from './AbilitySystem'
import { BuffManager } from './BuffManager'

describe('AbilitySystem', () => {
  let abilitySystem: AbilitySystem
  let buffManager: BuffManager

  beforeEach(() => {
    buffManager = new BuffManager()
    abilitySystem = new AbilitySystem(buffManager)
  })

  describe('constructor', () => {
    it('registers default abilities', () => {
      const abilities = abilitySystem.getAbilities()

      expect(abilities).toHaveLength(2)
      expect(abilities.map((a) => a.config.id)).toContain('arms-length')
      expect(abilities.map((a) => a.config.id)).toContain('sprint')
    })

    it('initializes abilities off cooldown', () => {
      expect(abilitySystem.isReady('sprint')).toBe(true)
      expect(abilitySystem.isReady('arms-length')).toBe(true)
    })
  })

  describe('use', () => {
    it('returns true when ability is used', () => {
      expect(abilitySystem.use('sprint')).toBe(true)
    })

    it('returns false when ability is on cooldown', () => {
      abilitySystem.use('sprint')

      expect(abilitySystem.use('sprint')).toBe(false)
    })

    it('returns false for non-existent ability', () => {
      expect(abilitySystem.use('nonexistent')).toBe(false)
    })

    it('applies buff to entity via BuffManager', () => {
      abilitySystem.use('sprint')

      expect(buffManager.has('player', 'sprint')).toBe(true)
    })

    it('applies buff with correct duration', () => {
      abilitySystem.use('sprint')

      const effect = buffManager.get('player', 'sprint')
      expect(effect?.remainingTime).toBe(10)
    })

    it('starts cooldown on use', () => {
      abilitySystem.use('sprint')

      expect(abilitySystem.getCooldown('sprint')).toBe(60)
      expect(abilitySystem.isReady('sprint')).toBe(false)
    })

    it('applies Arms Length buff correctly', () => {
      abilitySystem.use('arms-length')

      expect(buffManager.has('player', 'arms-length')).toBe(true)
      expect(buffManager.get('player', 'arms-length')?.remainingTime).toBe(6)
    })
  })

  describe('isReady', () => {
    it('returns true when ability is off cooldown', () => {
      expect(abilitySystem.isReady('sprint')).toBe(true)
    })

    it('returns false when ability is on cooldown', () => {
      abilitySystem.use('sprint')

      expect(abilitySystem.isReady('sprint')).toBe(false)
    })

    it('returns false for non-existent ability', () => {
      expect(abilitySystem.isReady('nonexistent')).toBe(false)
    })
  })

  describe('getCooldown', () => {
    it('returns 0 when ability is ready', () => {
      expect(abilitySystem.getCooldown('sprint')).toBe(0)
    })

    it('returns remaining cooldown after use', () => {
      abilitySystem.use('sprint')

      expect(abilitySystem.getCooldown('sprint')).toBe(60)
    })

    it('returns undefined for non-existent ability', () => {
      expect(abilitySystem.getCooldown('nonexistent')).toBeUndefined()
    })
  })

  describe('getAbilities', () => {
    it('returns all abilities with current state', () => {
      abilitySystem.use('sprint')

      const abilities = abilitySystem.getAbilities()
      const sprint = abilities.find((a) => a.config.id === 'sprint')
      const armsLength = abilities.find((a) => a.config.id === 'arms-length')

      expect(sprint?.remainingCooldown).toBe(60)
      expect(armsLength?.remainingCooldown).toBe(0)
    })

    it('includes ability config', () => {
      const abilities = abilitySystem.getAbilities()
      const sprint = abilities.find((a) => a.config.id === 'sprint')

      expect(sprint?.config.name).toBe('Sprint')
      expect(sprint?.config.cooldown).toBe(60)
      expect(sprint?.config.hotkey).toBe('2')
    })
  })

  describe('update', () => {
    it('decrements cooldowns', () => {
      abilitySystem.use('sprint')

      abilitySystem.update(10)

      expect(abilitySystem.getCooldown('sprint')).toBe(50)
    })

    it('ability becomes ready when cooldown reaches 0', () => {
      abilitySystem.use('sprint')

      abilitySystem.update(60)

      expect(abilitySystem.isReady('sprint')).toBe(true)
      expect(abilitySystem.getCooldown('sprint')).toBe(0)
    })

    it('cooldown does not go negative', () => {
      abilitySystem.use('sprint')

      abilitySystem.update(100)

      expect(abilitySystem.getCooldown('sprint')).toBe(0)
    })

    it('does not affect abilities already off cooldown', () => {
      abilitySystem.update(10)

      expect(abilitySystem.isReady('sprint')).toBe(true)
    })
  })

  describe('reset', () => {
    it('clears all ability cooldowns', () => {
      abilitySystem.use('sprint')
      abilitySystem.use('arms-length')

      abilitySystem.reset()

      expect(abilitySystem.isReady('sprint')).toBe(true)
      expect(abilitySystem.isReady('arms-length')).toBe(true)
    })

    it('allows abilities to be used again after reset', () => {
      abilitySystem.use('sprint')
      abilitySystem.reset()

      expect(abilitySystem.use('sprint')).toBe(true)
    })
  })

  describe('registerAbility', () => {
    it('adds custom ability', () => {
      abilitySystem.registerAbility({
        id: 'custom',
        name: 'Custom Ability',
        cooldown: 30,
        hotkey: '3',
      })

      expect(abilitySystem.isReady('custom')).toBe(true)
    })

    it('custom ability can be used', () => {
      abilitySystem.registerAbility({
        id: 'custom',
        name: 'Custom Ability',
        cooldown: 30,
        hotkey: '3',
        buff: {
          id: 'custom-buff',
          name: 'Custom Buff',
          type: 'buff',
          duration: 5,
        },
      })

      abilitySystem.use('custom')

      expect(buffManager.has('player', 'custom-buff')).toBe(true)
    })
  })

  describe('entity isolation', () => {
    it('applies buffs to specified entity', () => {
      const npcBuffManager = new BuffManager()
      const npcAbilitySystem = new AbilitySystem(npcBuffManager, 'npc1')

      npcAbilitySystem.use('sprint')

      expect(npcBuffManager.has('npc1', 'sprint')).toBe(true)
      expect(npcBuffManager.has('player', 'sprint')).toBe(false)
    })
  })

  describe('dispose', () => {
    it('clears all abilities', () => {
      abilitySystem.dispose()

      expect(abilitySystem.getAbilities()).toHaveLength(0)
    })
  })

  describe('ABILITIES constants', () => {
    it('has correct Sprint config', () => {
      expect(ABILITIES.SPRINT.id).toBe('sprint')
      expect(ABILITIES.SPRINT.cooldown).toBe(60)
      expect(ABILITIES.SPRINT.buff?.duration).toBe(10)
    })

    it('has correct Arms Length config', () => {
      expect(ABILITIES.ARMS_LENGTH.id).toBe('arms-length')
      expect(ABILITIES.ARMS_LENGTH.cooldown).toBe(120)
      expect(ABILITIES.ARMS_LENGTH.buff?.duration).toBe(6)
    })
  })
})
