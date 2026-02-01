/**
 * Overlay UI for displaying FAILED or CLEAR result screens.
 * Shows large centered text with restart prompt.
 */

export type ResultType = 'failed' | 'clear'

export class ResultOverlay {
  private container: HTMLDivElement
  private resultText: HTMLDivElement
  private promptText: HTMLDivElement
  private isVisible: boolean = false

  constructor() {
    // Container for full-screen overlay
    this.container = document.createElement('div')
    this.container.id = 'result-overlay'
    this.container.style.position = 'fixed'
    this.container.style.top = '0'
    this.container.style.left = '0'
    this.container.style.width = '100%'
    this.container.style.height = '100%'
    this.container.style.display = 'none'
    this.container.style.flexDirection = 'column'
    this.container.style.justifyContent = 'center'
    this.container.style.alignItems = 'center'
    this.container.style.background = 'rgba(0, 0, 0, 0.7)'
    this.container.style.zIndex = '2000'
    this.container.style.pointerEvents = 'none'

    // Main result text (FAILED / CLEAR!)
    this.resultText = document.createElement('div')
    this.resultText.style.fontSize = '96px'
    this.resultText.style.fontFamily = 'sans-serif'
    this.resultText.style.fontWeight = 'bold'
    this.resultText.style.textShadow = '0 4px 8px rgba(0, 0, 0, 0.5)'
    this.resultText.style.marginBottom = '24px'
    this.container.appendChild(this.resultText)

    // Restart prompt text
    this.promptText = document.createElement('div')
    this.promptText.style.fontSize = '24px'
    this.promptText.style.fontFamily = 'sans-serif'
    this.promptText.style.color = '#ffffff'
    this.promptText.style.opacity = '0.8'
    this.promptText.textContent = 'Press R to restart'
    this.container.appendChild(this.promptText)

    document.body.appendChild(this.container)
  }

  /**
   * Show the result overlay with the specified result type.
   */
  show(result: ResultType): void {
    if (result === 'failed') {
      this.resultText.textContent = 'FAILED'
      this.resultText.style.color = '#ff4444'
    } else {
      this.resultText.textContent = 'CLEAR!'
      this.resultText.style.color = '#44ff44'
    }

    this.container.style.display = 'flex'
    this.isVisible = true
  }

  /**
   * Hide the result overlay.
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
