import { BuffManager, StatusEffectConfig } from './BuffManager'

/**
 * UI component displaying active buffs and debuffs.
 * Renders at top-center of screen: buffs on left, debuffs on right.
 */
export class BuffDisplay {
  private container: HTMLDivElement
  private buffsContainer: HTMLDivElement
  private debuffsContainer: HTMLDivElement
  private buffManager: BuffManager
  private entityId: string

  constructor(buffManager: BuffManager, entityId: string = 'player') {
    this.buffManager = buffManager
    this.entityId = entityId

    // Main container: fixed top center
    this.container = document.createElement('div')
    this.container.id = 'buff-display'
    this.container.style.position = 'fixed'
    this.container.style.top = '40px'
    this.container.style.left = '50%'
    this.container.style.transform = 'translateX(-50%)'
    this.container.style.display = 'flex'
    this.container.style.gap = '40px'
    this.container.style.pointerEvents = 'none'
    this.container.style.zIndex = '1000'
    document.body.appendChild(this.container)

    // Buffs container (left side)
    this.buffsContainer = document.createElement('div')
    this.buffsContainer.style.display = 'flex'
    this.buffsContainer.style.gap = '4px'
    this.buffsContainer.style.flexDirection = 'row-reverse' // grow toward center
    this.container.appendChild(this.buffsContainer)

    // Debuffs container (right side)
    this.debuffsContainer = document.createElement('div')
    this.debuffsContainer.style.display = 'flex'
    this.debuffsContainer.style.gap = '4px'
    this.container.appendChild(this.debuffsContainer)
  }

  /**
   * Create a status effect indicator element
   */
  private createIndicator(config: StatusEffectConfig, remainingTime: number): HTMLDivElement {
    const indicator = document.createElement('div')
    indicator.style.width = '36px'
    indicator.style.height = '36px'
    indicator.style.position = 'relative'

    // Icon
    if (config.iconUrl) {
      const icon = document.createElement('img')
      icon.src = config.iconUrl
      icon.style.width = '100%'
      icon.style.height = '100%'
      icon.style.objectFit = 'cover'
      icon.style.display = 'block'
      icon.draggable = false
      indicator.appendChild(icon)
    }

    // Timer text
    const timerText = document.createElement('span')
    timerText.textContent = Math.ceil(remainingTime).toString()
    timerText.style.position = 'absolute'
    timerText.style.bottom = '0'
    timerText.style.left = '0'
    timerText.style.width = '100%'
    timerText.style.color = '#fff'
    timerText.style.fontSize = '11px'
    timerText.style.fontFamily = 'sans-serif'
    timerText.style.fontWeight = 'bold'
    timerText.style.textAlign = 'center'
    timerText.style.textShadow = '1px 1px 1px #000'
    indicator.appendChild(timerText)

    return indicator
  }

  /**
   * Update the display. Call each frame.
   */
  update(): void {
    // Clear existing indicators
    this.buffsContainer.innerHTML = ''
    this.debuffsContainer.innerHTML = ''

    // Get current buffs and debuffs
    const buffs = this.buffManager.getBuffs(this.entityId)
    const debuffs = this.buffManager.getDebuffs(this.entityId)

    // Render buffs
    for (const buff of buffs) {
      const indicator = this.createIndicator(buff.config, buff.remainingTime)
      this.buffsContainer.appendChild(indicator)
    }

    // Render debuffs
    for (const debuff of debuffs) {
      const indicator = this.createIndicator(debuff.config, debuff.remainingTime)
      this.debuffsContainer.appendChild(indicator)
    }
  }

  /**
   * Clean up DOM elements
   */
  dispose(): void {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
  }
}
