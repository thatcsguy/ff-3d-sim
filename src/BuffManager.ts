/**
 * Status effect types - buffs are positive, debuffs are negative
 */
export type StatusEffectType = 'buff' | 'debuff'

/**
 * Configuration for a status effect
 */
export interface StatusEffectConfig {
  id: string // unique identifier for this effect type (e.g., 'sprint', 'magic-vuln')
  name: string // display name
  type: StatusEffectType
  duration: number // duration in seconds
  iconUrl?: string // XIVAPI icon URL
}

/**
 * Active status effect instance on an entity
 */
interface ActiveStatusEffect {
  config: StatusEffectConfig
  remainingTime: number // seconds remaining
  entityId: string // which entity has this effect
}

/**
 * Manages status effects (buffs/debuffs) for all entities.
 * Tracks duration, handles expiration, and supports refresh-to-max behavior.
 */
export class BuffManager {
  private activeEffects: Map<string, ActiveStatusEffect> = new Map()

  /**
   * Create a unique key for an effect on an entity
   */
  private getKey(entityId: string, effectId: string): string {
    return `${entityId}:${effectId}`
  }

  /**
   * Apply a status effect to an entity.
   * If the effect already exists on the entity, refreshes to full duration.
   */
  apply(entityId: string, config: StatusEffectConfig): void {
    const key = this.getKey(entityId, config.id)

    // Create or refresh the effect
    this.activeEffects.set(key, {
      config,
      remainingTime: config.duration,
      entityId,
    })
  }

  /**
   * Remove a status effect from an entity.
   */
  remove(entityId: string, effectId: string): void {
    const key = this.getKey(entityId, effectId)
    this.activeEffects.delete(key)
  }

  /**
   * Check if an entity has a specific status effect.
   */
  has(entityId: string, effectId: string): boolean {
    const key = this.getKey(entityId, effectId)
    return this.activeEffects.has(key)
  }

  /**
   * Get a specific status effect for an entity.
   * Returns undefined if not found.
   */
  get(
    entityId: string,
    effectId: string
  ): { config: StatusEffectConfig; remainingTime: number } | undefined {
    const key = this.getKey(entityId, effectId)
    const effect = this.activeEffects.get(key)
    if (!effect) return undefined
    return {
      config: effect.config,
      remainingTime: effect.remainingTime,
    }
  }

  /**
   * Get all active buffs for an entity.
   */
  getBuffs(entityId: string): { config: StatusEffectConfig; remainingTime: number }[] {
    return this.getEffectsByType(entityId, 'buff')
  }

  /**
   * Get all active debuffs for an entity.
   */
  getDebuffs(entityId: string): { config: StatusEffectConfig; remainingTime: number }[] {
    return this.getEffectsByType(entityId, 'debuff')
  }

  /**
   * Get all effects of a specific type for an entity.
   */
  private getEffectsByType(
    entityId: string,
    type: StatusEffectType
  ): { config: StatusEffectConfig; remainingTime: number }[] {
    const results: { config: StatusEffectConfig; remainingTime: number }[] = []
    for (const effect of this.activeEffects.values()) {
      if (effect.entityId === entityId && effect.config.type === type) {
        results.push({
          config: effect.config,
          remainingTime: effect.remainingTime,
        })
      }
    }
    return results
  }

  /**
   * Get all active effects for an entity.
   */
  getAll(entityId: string): { config: StatusEffectConfig; remainingTime: number }[] {
    const results: { config: StatusEffectConfig; remainingTime: number }[] = []
    for (const effect of this.activeEffects.values()) {
      if (effect.entityId === entityId) {
        results.push({
          config: effect.config,
          remainingTime: effect.remainingTime,
        })
      }
    }
    return results
  }

  /**
   * Update all effects. Call each frame.
   * Decrements timers and removes expired effects.
   * @param deltaTime Time elapsed in seconds
   * @returns Array of effect IDs that expired this frame (for callbacks if needed)
   */
  update(deltaTime: number): string[] {
    const expired: string[] = []

    for (const [key, effect] of this.activeEffects) {
      effect.remainingTime -= deltaTime

      if (effect.remainingTime <= 0) {
        expired.push(effect.config.id)
        this.activeEffects.delete(key)
      }
    }

    return expired
  }

  /**
   * Remove all effects from an entity.
   */
  clearEntity(entityId: string): void {
    for (const [key, effect] of this.activeEffects) {
      if (effect.entityId === entityId) {
        this.activeEffects.delete(key)
      }
    }
  }

  /**
   * Remove all effects from all entities.
   */
  clear(): void {
    this.activeEffects.clear()
  }

  /**
   * Dispose of all resources.
   */
  dispose(): void {
    this.clear()
  }
}
