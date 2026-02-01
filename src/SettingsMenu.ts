export class SettingsMenu {
  private element: HTMLDivElement
  private isVisible: boolean = false
  private characterScreenPosition: number = 0.5 // 0 = bottom, 1 = top, 0.5 = center
  private onSettingsChange: (() => void) | null = null

  constructor() {
    this.element = document.createElement('div')
    this.element.id = 'settings-menu'
    this.element.style.position = 'fixed'
    this.element.style.top = '50%'
    this.element.style.left = '50%'
    this.element.style.transform = 'translate(-50%, -50%)'
    this.element.style.color = '#fff'
    this.element.style.fontFamily = 'monospace'
    this.element.style.fontSize = '16px'
    this.element.style.background = 'rgba(0, 0, 0, 0.85)'
    this.element.style.padding = '24px 32px'
    this.element.style.borderRadius = '8px'
    this.element.style.zIndex = '2000'
    this.element.style.display = 'none'
    this.element.style.minWidth = '300px'

    this.element.innerHTML = `
      <h2 style="margin: 0 0 16px 0; font-size: 20px;">Settings</h2>
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px;">Character Screen Position</label>
        <input type="range" id="character-position-slider" min="0" max="1" step="0.05" value="0.5"
          style="width: 100%; cursor: pointer;">
        <div style="display: flex; justify-content: space-between; color: #888; font-size: 12px; margin-top: 4px;">
          <span>Bottom</span>
          <span>Top</span>
        </div>
      </div>
      <p style="margin: 0; color: #888;">Press Escape to close</p>
    `

    document.body.appendChild(this.element)
    window.addEventListener('keydown', this.onKeyDown)

    const slider = this.element.querySelector('#character-position-slider') as HTMLInputElement
    slider.addEventListener('input', this.onSliderChange)
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Escape') {
      this.toggle()
    }
  }

  private onSliderChange = (event: Event): void => {
    const slider = event.target as HTMLInputElement
    this.characterScreenPosition = parseFloat(slider.value)
    if (this.onSettingsChange) {
      this.onSettingsChange()
    }
  }

  toggle(): void {
    this.isVisible = !this.isVisible
    this.element.style.display = this.isVisible ? 'block' : 'none'
  }

  isOpen(): boolean {
    return this.isVisible
  }

  getCharacterScreenPosition(): number {
    return this.characterScreenPosition
  }

  setOnSettingsChange(callback: () => void): void {
    this.onSettingsChange = callback
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    const slider = this.element.querySelector('#character-position-slider') as HTMLInputElement
    if (slider) {
      slider.removeEventListener('input', this.onSliderChange)
    }
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element)
    }
  }
}
