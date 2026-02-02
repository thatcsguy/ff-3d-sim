import { BuffManager, StatusEffectConfig } from './BuffManager'

/**
 * Ability definition
 */
export interface AbilityConfig {
  id: string
  name: string
  cooldown: number // seconds
  buff?: StatusEffectConfig // buff to apply when used
  hotkey: string // display label (e.g., "1", "2")
  iconUrl?: string // action icon URL
}

/**
 * Tracked state for an ability
 */
interface AbilityState {
  config: AbilityConfig
  remainingCooldown: number // 0 = ready
}

/**
 * Predefined ability configurations
 */
export const ABILITIES = {
  ARMS_LENGTH: {
    id: 'arms-length',
    name: "Arm's Length",
    cooldown: 120,
    hotkey: '1',
    iconUrl: '/icons/arms-length-action.png',
    buff: {
      id: 'arms-length',
      name: "Arm's Length",
      type: 'buff' as const,
      duration: 6,
      iconUrl: '/icons/arms-length-buff.png',
    },
  },
  SPRINT: {
    id: 'sprint',
    name: 'Sprint',
    cooldown: 60,
    hotkey: '2',
    iconUrl: '/icons/sprint-action.png',
    buff: {
      id: 'sprint',
      name: 'Sprint',
      type: 'buff' as const,
      duration: 10,
      iconUrl: '/icons/sprint-buff.png',
    },
  },
} as const

/**
 * Manages player abilities and cooldowns.
 * Integrates with BuffManager to apply buffs when abilities are used.
 */
export class AbilitySystem {
  private abilities: Map<string, AbilityState> = new Map()
  private buffManager: BuffManager
  private entityId: string

  constructor(buffManager: BuffManager, entityId: string = 'player') {
    this.buffManager = buffManager
    this.entityId = entityId

    // Register default abilities
    this.registerAbility(ABILITIES.ARMS_LENGTH)
    this.registerAbility(ABILITIES.SPRINT)
  }

  /**
   * Register an ability with the system
   */
  registerAbility(config: AbilityConfig): void {
    this.abilities.set(config.id, {
      config,
      remainingCooldown: 0,
    })
  }

  /**
   * Use an ability if it's off cooldown.
   * @returns true if ability was used, false if on cooldown or not found
   */
  use(abilityId: string): boolean {
    const state = this.abilities.get(abilityId)
    if (!state) return false

    // Check if on cooldown
    if (state.remainingCooldown > 0) return false

    // Start cooldown
    state.remainingCooldown = state.config.cooldown

    // Apply buff if ability has one
    if (state.config.buff) {
      this.buffManager.apply(this.entityId, state.config.buff)
    }

    return true
  }

  /**
   * Check if an ability is ready (off cooldown)
   */
  isReady(abilityId: string): boolean {
    const state = this.abilities.get(abilityId)
    if (!state) return false
    return state.remainingCooldown <= 0
  }

  /**
   * Get remaining cooldown for an ability
   * @returns remaining seconds, or 0 if ready, or undefined if not found
   */
  getCooldown(abilityId: string): number | undefined {
    const state = this.abilities.get(abilityId)
    if (!state) return undefined
    return Math.max(0, state.remainingCooldown)
  }

  /**
   * Get all registered abilities with their current state
   */
  getAbilities(): { config: AbilityConfig; remainingCooldown: number }[] {
    return Array.from(this.abilities.values()).map((state) => ({
      config: state.config,
      remainingCooldown: Math.max(0, state.remainingCooldown),
    }))
  }

  /**
   * Update cooldowns. Call each frame.
   * @param deltaTime Time elapsed in seconds
   */
  update(deltaTime: number): void {
    for (const state of this.abilities.values()) {
      if (state.remainingCooldown > 0) {
        state.remainingCooldown -= deltaTime
      }
    }
  }

  /**
   * Reset all ability cooldowns (e.g., on encounter restart)
   */
  reset(): void {
    for (const state of this.abilities.values()) {
      state.remainingCooldown = 0
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.abilities.clear()
  }
}
