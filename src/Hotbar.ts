import { AbilitySystem, AbilityConfig } from './AbilitySystem'

/**
 * FFXIV-style hotbar UI showing player abilities with cooldown states.
 * Renders as a DOM overlay at the bottom center of the screen.
 */
export class Hotbar {
  private container: HTMLDivElement
  private slots: Map<string, HTMLDivElement> = new Map()
  private abilitySystem: AbilitySystem

  constructor(abilitySystem: AbilitySystem) {
    this.abilitySystem = abilitySystem

    // Container: fixed bottom center
    this.container = document.createElement('div')
    this.container.id = 'hotbar'
    this.container.style.position = 'fixed'
    this.container.style.bottom = '20px'
    this.container.style.left = '50%'
    this.container.style.transform = 'translateX(-50%)'
    this.container.style.display = 'flex'
    this.container.style.gap = '4px'
    this.container.style.pointerEvents = 'none'
    this.container.style.zIndex = '1000'
    document.body.appendChild(this.container)

    // Create slots for each ability
    for (const ability of abilitySystem.getAbilities()) {
      this.createSlot(ability.config)
    }
  }

  /**
   * Create a hotbar slot for an ability
   */
  private createSlot(config: AbilityConfig): void {
    const slot = document.createElement('div')
    slot.style.width = '48px'
    slot.style.height = '48px'
    slot.style.position = 'relative'
    slot.style.border = '2px solid #444'
    slot.style.borderRadius = '4px'
    slot.style.background = '#1a1a1a'
    slot.style.overflow = 'hidden'

    // Icon
    if (config.iconUrl) {
      const icon = document.createElement('img')
      icon.src = config.iconUrl
      icon.style.width = '100%'
      icon.style.height = '100%'
      icon.style.objectFit = 'cover'
      icon.style.display = 'block'
      icon.draggable = false
      slot.appendChild(icon)
    }

    // Cooldown overlay (hidden initially)
    const cooldownOverlay = document.createElement('div')
    cooldownOverlay.className = 'cooldown-overlay'
    cooldownOverlay.style.position = 'absolute'
    cooldownOverlay.style.top = '0'
    cooldownOverlay.style.left = '0'
    cooldownOverlay.style.width = '100%'
    cooldownOverlay.style.height = '100%'
    cooldownOverlay.style.background = 'rgba(0, 0, 0, 0.7)'
    cooldownOverlay.style.display = 'none'
    cooldownOverlay.style.alignItems = 'center'
    cooldownOverlay.style.justifyContent = 'center'
    slot.appendChild(cooldownOverlay)

    // Cooldown timer text
    const cooldownText = document.createElement('span')
    cooldownText.className = 'cooldown-text'
    cooldownText.style.color = '#fff'
    cooldownText.style.fontSize = '16px'
    cooldownText.style.fontFamily = 'sans-serif'
    cooldownText.style.fontWeight = 'bold'
    cooldownText.style.textShadow = '1px 1px 2px #000'
    cooldownOverlay.appendChild(cooldownText)

    // Hotkey label (bottom right corner)
    const hotkeyLabel = document.createElement('span')
    hotkeyLabel.textContent = config.hotkey
    hotkeyLabel.style.position = 'absolute'
    hotkeyLabel.style.bottom = '2px'
    hotkeyLabel.style.right = '4px'
    hotkeyLabel.style.color = '#fff'
    hotkeyLabel.style.fontSize = '12px'
    hotkeyLabel.style.fontFamily = 'sans-serif'
    hotkeyLabel.style.fontWeight = 'bold'
    hotkeyLabel.style.textShadow = '1px 1px 2px #000'
    slot.appendChild(hotkeyLabel)

    this.container.appendChild(slot)
    this.slots.set(config.id, slot)
  }

  /**
   * Update the hotbar display. Call each frame.
   */
  update(): void {
    for (const ability of this.abilitySystem.getAbilities()) {
      const slot = this.slots.get(ability.config.id)
      if (!slot) continue

      const cooldownOverlay = slot.querySelector('.cooldown-overlay') as HTMLDivElement
      const cooldownText = slot.querySelector('.cooldown-text') as HTMLSpanElement

      if (ability.remainingCooldown > 0) {
        // Show cooldown overlay with timer
        cooldownOverlay.style.display = 'flex'
        cooldownText.textContent = Math.ceil(ability.remainingCooldown).toString()
      } else {
        // Hide cooldown overlay
        cooldownOverlay.style.display = 'none'
      }
    }
  }

  /**
   * Clean up DOM elements
   */
  dispose(): void {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
    this.slots.clear()
  }
}
