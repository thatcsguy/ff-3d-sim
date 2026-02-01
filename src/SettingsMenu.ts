export class SettingsMenu {
  private element: HTMLDivElement
  private isVisible: boolean = false

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
      <p style="margin: 0; color: #888;">Press Escape to close</p>
    `

    document.body.appendChild(this.element)
    window.addEventListener('keydown', this.onKeyDown)
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Escape') {
      this.toggle()
    }
  }

  toggle(): void {
    this.isVisible = !this.isVisible
    this.element.style.display = this.isVisible ? 'block' : 'none'
  }

  isOpen(): boolean {
    return this.isVisible
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element)
    }
  }
}
