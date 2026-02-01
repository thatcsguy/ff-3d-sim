export enum MouseButton {
  Left = 0,
  Middle = 1,
  Right = 2,
}

export interface MouseDelta {
  x: number
  y: number
}

export class InputManager {
  private keys: Set<string> = new Set()
  private mouseButtons: Set<MouseButton> = new Set()
  private mouseDelta: MouseDelta = { x: 0, y: 0 }
  private element: HTMLElement

  constructor(element: HTMLElement = document.body) {
    this.element = element
    this.attachListeners()
  }

  private attachListeners(): void {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    this.element.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)
    this.element.addEventListener('mousemove', this.onMouseMove)
    this.element.addEventListener('contextmenu', this.onContextMenu)
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code)
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code)
  }

  private onMouseDown = (event: MouseEvent): void => {
    this.mouseButtons.add(event.button as MouseButton)
  }

  private onMouseUp = (event: MouseEvent): void => {
    this.mouseButtons.delete(event.button as MouseButton)
  }

  private onMouseMove = (event: MouseEvent): void => {
    this.mouseDelta.x += event.movementX
    this.mouseDelta.y += event.movementY
  }

  private onContextMenu = (event: Event): void => {
    event.preventDefault()
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code)
  }

  isMouseButtonDown(button: MouseButton): boolean {
    return this.mouseButtons.has(button)
  }

  getMouseDelta(): MouseDelta {
    return { x: this.mouseDelta.x, y: this.mouseDelta.y }
  }

  resetMouseDelta(): void {
    this.mouseDelta.x = 0
    this.mouseDelta.y = 0
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.element.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mouseup', this.onMouseUp)
    this.element.removeEventListener('mousemove', this.onMouseMove)
    this.element.removeEventListener('contextmenu', this.onContextMenu)
  }
}
