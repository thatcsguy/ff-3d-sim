import * as THREE from 'three'
import { PLAYER_HEIGHT, PLAYER_RADIUS } from './constants'
import { InputManager } from './InputManager'
import { CameraController } from './CameraController'
import { PlayerController } from './PlayerController'
import { Arena } from './Arena'

export class Game {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private playerMesh: THREE.Mesh
  private animationFrameId: number | null = null
  private lastTime: number = 0
  private inputManager: InputManager
  private cameraController: CameraController
  private playerController: PlayerController
  private arena: Arena

  constructor() {
    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    document.body.appendChild(this.renderer.domElement)

    // Scene setup
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1a2e)

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )

    // Input and camera controller setup
    this.inputManager = new InputManager(this.renderer.domElement)
    this.cameraController = new CameraController(this.camera, this.inputManager)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(10, 20, 10)
    this.scene.add(directionalLight)

    // Arena floor (circular platform)
    this.arena = new Arena()
    this.arena.create(this.scene)

    // Player cylinder (blue)
    const playerGeometry = new THREE.CylinderGeometry(
      PLAYER_RADIUS,
      PLAYER_RADIUS,
      PLAYER_HEIGHT,
      16
    )
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x0984e3 })
    this.playerMesh = new THREE.Mesh(playerGeometry, playerMaterial)
    this.playerMesh.position.set(0, PLAYER_HEIGHT / 2, 0)
    this.scene.add(this.playerMesh)

    // Player controller setup (must be after playerMesh is created)
    this.playerController = new PlayerController(this.playerMesh, this.inputManager)

    // Handle window resize
    window.addEventListener('resize', this.onResize)
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  private gameLoop = (time: number): void => {
    const deltaTime = this.lastTime ? (time - this.lastTime) / 1000 : 0
    this.lastTime = time

    // Update logic will go here
    this.update(deltaTime)

    // Render
    this.renderer.render(this.scene, this.camera)
    this.animationFrameId = requestAnimationFrame(this.gameLoop)
  }

  private update(deltaTime: number): void {
    // Update player movement
    this.playerController.update(deltaTime, this.cameraController)

    // Clamp player to arena boundary
    this.arena.clampToArena(this.playerMesh.position)

    // Update camera to orbit around player
    const playerPosition = this.playerMesh.position.clone()
    playerPosition.y = PLAYER_HEIGHT // Look at player's head height
    this.cameraController.update(deltaTime, playerPosition)
  }

  start(): void {
    this.lastTime = 0
    this.animationFrameId = requestAnimationFrame(this.gameLoop)
  }

  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
    window.removeEventListener('resize', this.onResize)
    this.cameraController.dispose()
    this.inputManager.dispose()
  }

  getInputManager(): InputManager {
    return this.inputManager
  }

  getCameraController(): CameraController {
    return this.cameraController
  }

  getPlayerController(): PlayerController {
    return this.playerController
  }

  getArena(): Arena {
    return this.arena
  }
}
