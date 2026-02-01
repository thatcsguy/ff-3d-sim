import * as THREE from 'three'

export class HUD {
  private element: HTMLDivElement

  constructor() {
    this.element = document.createElement('div')
    this.element.id = 'hud'
    this.element.style.position = 'fixed'
    this.element.style.top = '10px'
    this.element.style.left = '10px'
    this.element.style.color = '#fff'
    this.element.style.fontFamily = 'monospace'
    this.element.style.fontSize = '14px'
    this.element.style.background = 'rgba(0, 0, 0, 0.5)'
    this.element.style.padding = '8px 12px'
    this.element.style.borderRadius = '4px'
    this.element.style.pointerEvents = 'none'
    this.element.style.zIndex = '1000'
    document.body.appendChild(this.element)
  }

  update(playerPosition: THREE.Vector3): void {
    const x = playerPosition.x.toFixed(2)
    const y = playerPosition.y.toFixed(2)
    const z = playerPosition.z.toFixed(2)
    this.element.textContent = `X: ${x}  Y: ${y}  Z: ${z}`
  }

  dispose(): void {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element)
    }
  }

  getElement(): HTMLDivElement {
    return this.element
  }
}
