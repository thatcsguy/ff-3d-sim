import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { InputManager, MouseButton } from './InputManager'

describe('InputManager', () => {
  let inputManager: InputManager
  let element: HTMLElement

  beforeEach(() => {
    element = document.createElement('div')
    document.body.appendChild(element)
    inputManager = new InputManager(element)
  })

  afterEach(() => {
    inputManager.dispose()
    document.body.removeChild(element)
  })

  describe('keyboard input', () => {
    it('tracks key press', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
      expect(inputManager.isKeyDown('KeyW')).toBe(true)
    })

    it('tracks key release', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))
      expect(inputManager.isKeyDown('KeyW')).toBe(false)
    })

    it('tracks multiple simultaneous keys', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }))
      expect(inputManager.isKeyDown('KeyW')).toBe(true)
      expect(inputManager.isKeyDown('KeyA')).toBe(true)
    })

    it('returns false for unpressed keys', () => {
      expect(inputManager.isKeyDown('KeyW')).toBe(false)
    })
  })

  describe('mouse button input', () => {
    it('tracks left mouse button press', () => {
      element.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))
      expect(inputManager.isMouseButtonDown(MouseButton.Left)).toBe(true)
    })

    it('tracks right mouse button press', () => {
      element.dispatchEvent(new MouseEvent('mousedown', { button: 2 }))
      expect(inputManager.isMouseButtonDown(MouseButton.Right)).toBe(true)
    })

    it('tracks middle mouse button press', () => {
      element.dispatchEvent(new MouseEvent('mousedown', { button: 1 }))
      expect(inputManager.isMouseButtonDown(MouseButton.Middle)).toBe(true)
    })

    it('tracks mouse button release', () => {
      element.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))
      window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }))
      expect(inputManager.isMouseButtonDown(MouseButton.Left)).toBe(false)
    })

    it('tracks multiple simultaneous mouse buttons', () => {
      element.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))
      element.dispatchEvent(new MouseEvent('mousedown', { button: 2 }))
      expect(inputManager.isMouseButtonDown(MouseButton.Left)).toBe(true)
      expect(inputManager.isMouseButtonDown(MouseButton.Right)).toBe(true)
    })
  })

  describe('mouse movement', () => {
    it('accumulates mouse delta', () => {
      element.dispatchEvent(new MouseEvent('mousemove', { movementX: 10, movementY: 5 }))
      const delta = inputManager.getMouseDelta()
      expect(delta.x).toBe(10)
      expect(delta.y).toBe(5)
    })

    it('accumulates multiple movements', () => {
      element.dispatchEvent(new MouseEvent('mousemove', { movementX: 10, movementY: 5 }))
      element.dispatchEvent(new MouseEvent('mousemove', { movementX: -3, movementY: 7 }))
      const delta = inputManager.getMouseDelta()
      expect(delta.x).toBe(7)
      expect(delta.y).toBe(12)
    })

    it('resets mouse delta', () => {
      element.dispatchEvent(new MouseEvent('mousemove', { movementX: 10, movementY: 5 }))
      inputManager.resetMouseDelta()
      const delta = inputManager.getMouseDelta()
      expect(delta.x).toBe(0)
      expect(delta.y).toBe(0)
    })

    it('returns copy of delta not reference', () => {
      element.dispatchEvent(new MouseEvent('mousemove', { movementX: 10, movementY: 5 }))
      const delta = inputManager.getMouseDelta()
      delta.x = 999
      expect(inputManager.getMouseDelta().x).toBe(10)
    })
  })

  describe('combined inputs', () => {
    it('tracks keyboard and mouse simultaneously', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
      element.dispatchEvent(new MouseEvent('mousedown', { button: 2 }))
      element.dispatchEvent(new MouseEvent('mousemove', { movementX: 5, movementY: 3 }))

      expect(inputManager.isKeyDown('KeyW')).toBe(true)
      expect(inputManager.isMouseButtonDown(MouseButton.Right)).toBe(true)
      expect(inputManager.getMouseDelta()).toEqual({ x: 5, y: 3 })
    })
  })

  describe('gamepad input', () => {
    function createGamepadEvent(type: string, index: number): Event {
      const event = new Event(type) as Event & { gamepad: Partial<Gamepad> }
      event.gamepad = { index }
      return event
    }

    it('starts with no gamepad connected', () => {
      expect(inputManager.isGamepadConnected()).toBe(false)
    })

    it('detects gamepad connection', () => {
      window.dispatchEvent(createGamepadEvent('gamepadconnected', 0))
      expect(inputManager.isGamepadConnected()).toBe(true)
    })

    it('detects gamepad disconnection', () => {
      window.dispatchEvent(createGamepadEvent('gamepadconnected', 0))
      window.dispatchEvent(createGamepadEvent('gamepaddisconnected', 0))
      expect(inputManager.isGamepadConnected()).toBe(false)
    })

    it('returns zero stick input when no gamepad connected', () => {
      const stick = inputManager.getLeftStick()
      expect(stick.x).toBe(0)
      expect(stick.y).toBe(0)
    })

    it('reads left stick values from connected gamepad', () => {
      const mockGamepad = {
        index: 0,
        axes: [0.5, -0.75, 0, 0],
      } as unknown as Gamepad

      Object.defineProperty(navigator, 'getGamepads', {
        value: () => [mockGamepad, null, null, null],
        configurable: true,
      })

      window.dispatchEvent(createGamepadEvent('gamepadconnected', 0))
      const stick = inputManager.getLeftStick()
      expect(stick.x).toBe(0.5)
      expect(stick.y).toBe(-0.75)
    })

    it('returns zero when gamepad not found in navigator', () => {
      Object.defineProperty(navigator, 'getGamepads', {
        value: () => [null, null, null, null],
        configurable: true,
      })

      window.dispatchEvent(createGamepadEvent('gamepadconnected', 0))
      const stick = inputManager.getLeftStick()
      expect(stick.x).toBe(0)
      expect(stick.y).toBe(0)
    })
  })
})
