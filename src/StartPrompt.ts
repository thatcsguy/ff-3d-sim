/**
 * Overlay UI for displaying "Press [key] to start" prompt.
 * Shows before the mechanic begins, hidden once started.
 */

export class StartPrompt {
  private container: HTMLDivElement
  private promptText: HTMLDivElement
  private isVisible: boolean = false

  constructor() {
    // Container for full-screen overlay
    this.container = document.createElement('div')
    this.container.id = 'start-prompt'
    this.container.style.position = 'fixed'
    this.container.style.top = '0'
    this.container.style.left = '0'
    this.container.style.width = '100%'
    this.container.style.height = '100%'
    this.container.style.display = 'none'
    this.container.style.flexDirection = 'column'
    this.container.style.justifyContent = 'center'
    this.container.style.alignItems = 'center'
    this.container.style.background = 'rgba(0, 0, 0, 0.5)'
    this.container.style.zIndex = '2000'
    this.container.style.pointerEvents = 'none'

    // Prompt text
    this.promptText = document.createElement('div')
    this.promptText.style.fontSize = '36px'
    this.promptText.style.fontFamily = 'sans-serif'
    this.promptText.style.fontWeight = 'bold'
    this.promptText.style.color = '#ffffff'
    this.promptText.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.5)'
    this.promptText.textContent = 'Press Space to start'
    this.container.appendChild(this.promptText)

    document.body.appendChild(this.container)
  }

  /**
   * Show the start prompt overlay.
   */
  show(): void {
    this.container.style.display = 'flex'
    this.isVisible = true
  }

  /**
   * Hide the start prompt overlay.
   */
  hide(): void {
    this.container.style.display = 'none'
    this.isVisible = false
  }

  /**
   * Check if the overlay is currently visible.
   */
  getIsVisible(): boolean {
    return this.isVisible
  }

  /**
   * Clean up DOM elements.
   */
  dispose(): void {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
  }
}
