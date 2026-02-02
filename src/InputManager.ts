export enum MouseButton {
  Left = 0,
  Middle = 1,
  Right = 2,
}

export interface GamepadState {
  connected: boolean
  index: number
  id: string
}

export type ControllerType = 'xbox' | 'playstation' | 'unknown'

export interface StickInput {
  x: number
  y: number
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
  private isPointerLocked: boolean = false
  private gamepad: GamepadState = { connected: false, index: -1, id: '' }
  private previousButtonStates: boolean[] = []

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
    document.addEventListener('pointerlockchange', this.onPointerLockChange)
    window.addEventListener('gamepadconnected', this.onGamepadConnected)
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected)
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code)
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code)
  }

  private onMouseDown = (event: MouseEvent): void => {
    this.mouseButtons.add(event.button as MouseButton)
    if (
      (event.button === MouseButton.Left || event.button === MouseButton.Right) &&
      !this.isPointerLocked &&
      this.element.requestPointerLock
    ) {
      this.element.requestPointerLock()
    }
  }

  private onMouseUp = (event: MouseEvent): void => {
    this.mouseButtons.delete(event.button as MouseButton)
    if (
      this.isPointerLocked &&
      !this.mouseButtons.has(MouseButton.Left) &&
      !this.mouseButtons.has(MouseButton.Right) &&
      document.exitPointerLock
    ) {
      document.exitPointerLock()
    }
  }

  private onMouseMove = (event: MouseEvent): void => {
    this.mouseDelta.x += event.movementX
    this.mouseDelta.y += event.movementY
  }

  private onContextMenu = (event: Event): void => {
    event.preventDefault()
  }

  private onPointerLockChange = (): void => {
    this.isPointerLocked = document.pointerLockElement === this.element
  }

  private onGamepadConnected = (event: GamepadEvent): void => {
    this.gamepad = { connected: true, index: event.gamepad.index, id: event.gamepad.id }
    this.previousButtonStates = []
  }

  private onGamepadDisconnected = (): void => {
    this.gamepad = { connected: false, index: -1, id: '' }
    this.previousButtonStates = []
  }

  isGamepadConnected(): boolean {
    return this.gamepad.connected
  }

  getLeftStick(): StickInput {
    if (!this.gamepad.connected) {
      return { x: 0, y: 0 }
    }
    const gamepad = navigator.getGamepads()[this.gamepad.index]
    if (!gamepad) {
      return { x: 0, y: 0 }
    }
    return { x: gamepad.axes[0] ?? 0, y: gamepad.axes[1] ?? 0 }
  }

  getRightStick(): StickInput {
    if (!this.gamepad.connected) {
      return { x: 0, y: 0 }
    }
    const gamepad = navigator.getGamepads()[this.gamepad.index]
    if (!gamepad) {
      return { x: 0, y: 0 }
    }
    return { x: gamepad.axes[2] ?? 0, y: gamepad.axes[3] ?? 0 }
  }

  isButtonPressed(buttonIndex: number): boolean {
    if (!this.gamepad.connected) {
      return false
    }
    const gamepad = navigator.getGamepads()[this.gamepad.index]
    if (!gamepad) {
      return false
    }
    return gamepad.buttons[buttonIndex]?.pressed ?? false
  }

  /**
   * Check if a button was just pressed this frame (rising edge detection).
   * Call updateGamepadState() once per frame before checking.
   */
  isButtonJustPressed(buttonIndex: number): boolean {
    if (!this.gamepad.connected) {
      return false
    }
    const gamepad = navigator.getGamepads()[this.gamepad.index]
    if (!gamepad) {
      return false
    }
    const currentlyPressed = gamepad.buttons[buttonIndex]?.pressed ?? false
    const wasPressed = this.previousButtonStates[buttonIndex] ?? false
    return currentlyPressed && !wasPressed
  }

  /**
   * Update gamepad button states. Call once per frame before checking isButtonJustPressed.
   */
  updateGamepadState(): void {
    if (!this.gamepad.connected) {
      return
    }
    const gamepad = navigator.getGamepads()[this.gamepad.index]
    if (!gamepad) {
      return
    }
    this.previousButtonStates = gamepad.buttons.map((b) => b.pressed)
  }

  /**
   * Get the type of controller connected (xbox, playstation, or unknown).
   */
  getControllerType(): ControllerType {
    if (!this.gamepad.connected) {
      return 'unknown'
    }
    const id = this.gamepad.id.toLowerCase()
    if (id.includes('xbox') || id.includes('xinput')) {
      return 'xbox'
    }
    if (id.includes('dualshock') || id.includes('dualsense') || id.includes('054c') || id.includes('playstation')) {
      return 'playstation'
    }
    return 'unknown'
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
    document.removeEventListener('pointerlockchange', this.onPointerLockChange)
    window.removeEventListener('gamepadconnected', this.onGamepadConnected)
    window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected)
    if (this.isPointerLocked && document.exitPointerLock) {
      document.exitPointerLock()
    }
  }
}
