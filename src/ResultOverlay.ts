/**
 * Overlay UI for displaying FAILED or CLEAR result screens.
 * Shows large centered text with restart prompt.
 */

export type ResultType = 'failed' | 'clear'

export class ResultOverlay {
  private container: HTMLDivElement
  private resultText: HTMLDivElement
  private reasonText: HTMLDivElement
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

    // Failure reason text
    this.reasonText = document.createElement('div')
    this.reasonText.style.fontSize = '24px'
    this.reasonText.style.fontFamily = 'sans-serif'
    this.reasonText.style.color = '#ffaaaa'
    this.reasonText.style.marginBottom = '24px'
    this.reasonText.style.textAlign = 'center'
    this.reasonText.style.maxWidth = '600px'
    this.container.appendChild(this.reasonText)

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
   * @param result The result type (failed or clear)
   * @param reason Optional explanation for failure
   */
  show(result: ResultType, reason?: string): void {
    if (result === 'failed') {
      this.resultText.textContent = 'FAILED'
      this.resultText.style.color = '#ff4444'
      this.reasonText.textContent = reason || ''
      this.reasonText.style.display = reason ? 'block' : 'none'
    } else {
      this.resultText.textContent = 'CLEAR!'
      this.resultText.style.color = '#44ff44'
      this.reasonText.style.display = 'none'
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
