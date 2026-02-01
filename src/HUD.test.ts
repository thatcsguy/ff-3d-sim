import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import { HUD } from './HUD'

describe('HUD', () => {
  let hud: HUD

  beforeEach(() => {
    hud = new HUD()
  })

  afterEach(() => {
    hud.dispose()
  })

  describe('initialization', () => {
    it('creates an element in the DOM', () => {
      const element = hud.getElement()
      expect(element).toBeInstanceOf(HTMLDivElement)
      expect(document.body.contains(element)).toBe(true)
    })

    it('has fixed positioning', () => {
      const element = hud.getElement()
      expect(element.style.position).toBe('fixed')
    })

    it('is positioned in top-left corner', () => {
      const element = hud.getElement()
      expect(element.style.top).toBe('10px')
      expect(element.style.left).toBe('10px')
    })

    it('uses monospace font', () => {
      const element = hud.getElement()
      expect(element.style.fontFamily).toBe('monospace')
    })

    it('has pointer-events disabled', () => {
      const element = hud.getElement()
      expect(element.style.pointerEvents).toBe('none')
    })
  })

  describe('update', () => {
    it('displays player coordinates', () => {
      const position = new THREE.Vector3(5.5, 1.8, -3.2)
      hud.update(position)

      const element = hud.getElement()
      expect(element.textContent).toContain('5.50')
      expect(element.textContent).toContain('1.80')
      expect(element.textContent).toContain('-3.20')
    })

    it('formats coordinates to 2 decimal places', () => {
      const position = new THREE.Vector3(1.123456, 2.999, 3.1)
      hud.update(position)

      const element = hud.getElement()
      expect(element.textContent).toContain('1.12')
      expect(element.textContent).toContain('3.00')
      expect(element.textContent).toContain('3.10')
    })

    it('handles zero coordinates', () => {
      const position = new THREE.Vector3(0, 0, 0)
      hud.update(position)

      const element = hud.getElement()
      expect(element.textContent).toContain('0.00')
    })

    it('handles negative coordinates', () => {
      const position = new THREE.Vector3(-10.5, -0.5, -15.75)
      hud.update(position)

      const element = hud.getElement()
      expect(element.textContent).toContain('-10.50')
      expect(element.textContent).toContain('-0.50')
      expect(element.textContent).toContain('-15.75')
    })

    it('includes X, Y, Z labels', () => {
      const position = new THREE.Vector3(1, 2, 3)
      hud.update(position)

      const element = hud.getElement()
      expect(element.textContent).toContain('X:')
      expect(element.textContent).toContain('Y:')
      expect(element.textContent).toContain('Z:')
    })
  })

  describe('dispose', () => {
    it('removes element from DOM', () => {
      const element = hud.getElement()
      expect(document.body.contains(element)).toBe(true)

      hud.dispose()

      expect(document.body.contains(element)).toBe(false)
    })

    it('can be called multiple times safely', () => {
      hud.dispose()
      expect(() => hud.dispose()).not.toThrow()
    })
  })
})
