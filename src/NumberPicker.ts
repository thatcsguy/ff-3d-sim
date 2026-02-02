export class NumberPicker {
  private container: HTMLDivElement
  private buttons: HTMLButtonElement[] = []
  private selectedNumber: number | null = null // null = random
  private onSelect: (num: number | null) => void

  constructor(onSelect: (num: number | null) => void) {
    this.onSelect = onSelect

    this.container = document.createElement('div')
    this.container.id = 'number-picker'
    this.container.style.position = 'fixed'
    this.container.style.left = '10px'
    this.container.style.top = '50%'
    this.container.style.transform = 'translateY(-50%)'
    this.container.style.display = 'flex'
    this.container.style.flexDirection = 'column'
    this.container.style.gap = '4px'
    this.container.style.zIndex = '1000'

    // Create R button first (random - default selected)
    this.createButton('R', null)

    // Create number buttons 1-8
    for (let i = 1; i <= 8; i++) {
      this.createButton(String(i), i)
    }

    document.body.appendChild(this.container)

    // Select random by default
    this.setSelected(null)
  }

  private createButton(label: string, value: number | null): void {
    const button = document.createElement('button')
    button.textContent = label
    button.style.width = '36px'
    button.style.height = '36px'
    button.style.border = '2px solid #555'
    button.style.borderRadius = '4px'
    button.style.background = 'rgba(0, 0, 0, 0.7)'
    button.style.color = '#fff'
    button.style.fontFamily = 'monospace'
    button.style.fontSize = '16px'
    button.style.fontWeight = 'bold'
    button.style.cursor = 'pointer'
    button.style.transition = 'all 0.15s ease'

    button.addEventListener('mouseenter', () => {
      if (this.selectedNumber !== value) {
        button.style.background = 'rgba(50, 50, 50, 0.9)'
      }
    })

    button.addEventListener('mouseleave', () => {
      if (this.selectedNumber !== value) {
        button.style.background = 'rgba(0, 0, 0, 0.7)'
      }
    })

    button.addEventListener('click', () => {
      this.setSelected(value)
      this.onSelect(value)
    })

    this.buttons.push(button)
    this.container.appendChild(button)
  }

  private setSelected(value: number | null): void {
    this.selectedNumber = value

    this.buttons.forEach((btn, index) => {
      // Index 0 = R (null), index 1-8 = numbers 1-8
      const btnValue = index === 0 ? null : index
      const isSelected = btnValue === value

      if (isSelected) {
        btn.style.background = 'rgba(255, 165, 0, 0.8)'
        btn.style.borderColor = '#ffa500'
        btn.style.color = '#000'
      } else {
        btn.style.background = 'rgba(0, 0, 0, 0.7)'
        btn.style.borderColor = '#555'
        btn.style.color = '#fff'
      }
    })
  }

  getSelectedNumber(): number | null {
    return this.selectedNumber
  }

  dispose(): void {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
  }
}
