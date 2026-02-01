import * as THREE from 'three'
import { PLAYER_HEIGHT, PLAYER_RADIUS, ARENA_RADIUS } from './constants'
import { InputManager } from './InputManager'
import { CameraController } from './CameraController'
import { PlayerController } from './PlayerController'
import { Arena } from './Arena'
import { NPCManager } from './NPCManager'
import { HUD } from './HUD'
import { SettingsMenu } from './SettingsMenu'
import { Timeline } from './Timeline'
import { AoEManager } from './AoEManager'
import { BossManager } from './BossManager'
import { NumberSpriteManager } from './NumberSpriteManager'

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
  private npcManager: NPCManager
  private hud: HUD
  private settingsMenu: SettingsMenu
  private timeline: Timeline
  private aoeManager: AoEManager
  private bossManager: BossManager
  private numberSpriteManager: NumberSpriteManager

  constructor() {
    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
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
    // Light from the north (negative Z), high in the sky
    directionalLight.position.set(0, 50, -30)
    directionalLight.castShadow = true
    // Shadow camera covers the arena
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.near = 10
    directionalLight.shadow.camera.far = 100
    directionalLight.shadow.camera.left = -ARENA_RADIUS - 5
    directionalLight.shadow.camera.right = ARENA_RADIUS + 5
    directionalLight.shadow.camera.top = ARENA_RADIUS + 5
    directionalLight.shadow.camera.bottom = -ARENA_RADIUS - 5
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
    this.playerMesh.castShadow = true
    this.scene.add(this.playerMesh)

    // Player controller setup (must be after playerMesh is created)
    this.playerController = new PlayerController(this.playerMesh, this.inputManager)

    // NPC manager setup
    this.npcManager = new NPCManager(this.arena)
    this.npcManager.spawn(this.scene)

    // HUD setup
    this.hud = new HUD()

    // Settings menu setup
    this.settingsMenu = new SettingsMenu()
    this.settingsMenu.setOnSettingsChange(() => {
      this.applySettings()
    })
    this.applySettings()

    // Timeline and AoE manager setup
    this.timeline = new Timeline()
    this.aoeManager = new AoEManager(this.scene)

    // Boss manager setup
    this.bossManager = new BossManager()
    this.bossManager.spawn(this.scene)

    // Number sprite manager setup
    this.numberSpriteManager = new NumberSpriteManager()
    this.numberSpriteManager.init(this.scene)

    this.setupTestTimeline()

    // Handle window resize
    window.addEventListener('resize', this.onResize)
  }

  /**
   * Temporary test timeline with a single circle AoE.
   * This will be replaced with the full Wormhole mechanic.
   */
  private setupTestTimeline(): void {
    this.timeline.addEvent({
      id: 'test-aoe-1',
      time: 2.0, // Spawn after 2 seconds
      handler: () => {
        this.aoeManager.spawn({
          id: 'circle-aoe-1',
          shape: 'circle',
          position: new THREE.Vector3(0, 0, 0), // Center of arena
          radius: 5,
          telegraphDuration: 2.0, // 2 seconds to get out
          onResolve: () => {
            console.log('Circle AoE resolved!')
          },
        })
      },
    })

    // Test number sprite assignment at start
    this.timeline.addEvent({
      id: 'test-numbers-assign',
      time: 0.5,
      handler: () => {
        // Assign player number 1
        this.numberSpriteManager.assignNumber('player', this.playerMesh, 1)
        // Assign NPCs numbers 2-8
        const npcs = this.npcManager.getMeshes()
        for (let i = 0; i < npcs.length; i++) {
          this.numberSpriteManager.assignNumber(`npc-${i}`, npcs[i], i + 2)
        }
      },
    })

    // Test Cruise Chaser spawn and Limit Cut dash
    this.timeline.addEvent({
      id: 'test-cc-spawn',
      time: 3.0,
      handler: () => {
        // Show Cruise Chaser at west side of arena
        this.bossManager.show(
          'cruiseChaser',
          new THREE.Vector3(-10, 0, 0)
        )
        // Face east (toward center)
        this.bossManager.setRotation('cruiseChaser', Math.PI / 2)
      },
    })

    // Test line AoE (Limit Cut dash style) - CC dashes through center
    this.timeline.addEvent({
      id: 'test-line-aoe-1',
      time: 4.0, // After CC appears
      handler: () => {
        this.aoeManager.spawn({
          id: 'line-aoe-1',
          shape: 'line',
          position: new THREE.Vector3(0, 0, 0), // Center of arena
          length: 20, // Full arena width
          width: 2,
          rotation: Math.PI / 2, // East-West line (90 degrees)
          telegraphDuration: 1.5,
          onResolve: () => {
            console.log('Cruise Chaser dash resolved!')
            // Teleport CC to east side after dash
            this.bossManager.setPosition(
              'cruiseChaser',
              new THREE.Vector3(10, 0, 0)
            )
            this.bossManager.setRotation('cruiseChaser', -Math.PI / 2)
          },
        })
      },
    })

    // Test Brute Justice spawn (Super Jump source position)
    this.timeline.addEvent({
      id: 'test-bj-spawn',
      time: 6.0,
      handler: () => {
        // Show Brute Justice at north side of arena
        this.bossManager.show(
          'bruteJustice',
          new THREE.Vector3(0, 0, -10)
        )
        // Face south (toward center)
        this.bossManager.setRotation('bruteJustice', Math.PI)
      },
    })

    // Test Alexander Prime spawn (Sacrament position)
    this.timeline.addEvent({
      id: 'test-alex-spawn',
      time: 8.0,
      handler: () => {
        // Show Alexander Prime at south side of arena
        this.bossManager.show(
          'alexanderPrime',
          new THREE.Vector3(0, 0, 10)
        )
        // Face north (toward center)
        this.bossManager.setRotation('alexanderPrime', 0)
      },
    })

    // Start the timeline automatically for testing
    this.timeline.start()
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  private applySettings(): void {
    // Character screen position: 0 = bottom, 1 = top, 0.5 = center
    // Passed directly to camera controller which uses FOV math to maintain
    // consistent screen position regardless of zoom level
    this.cameraController.setTargetScreenY(this.settingsMenu.getCharacterScreenPosition())
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

    // Update NPCs
    this.npcManager.update(deltaTime)

    // Update timeline
    this.timeline.update(deltaTime)

    // Update bosses
    this.bossManager.update(deltaTime)

    // Update number sprites (follow their entities)
    this.numberSpriteManager.update()

    // Update AoEs and check for hits
    const hits = this.aoeManager.update(deltaTime, this.playerMesh.position)
    if (hits.length > 0) {
      console.log('Player hit by AoEs:', hits)
      // TODO: Trigger failure state
    }

    // Update camera to orbit around player (follow jumping)
    // Target 75% up from player's feet (upper chest/neck area)
    const playerPosition = this.playerMesh.position.clone()
    const playerBottom = this.playerMesh.position.y - PLAYER_HEIGHT / 2
    playerPosition.y = playerBottom + PLAYER_HEIGHT * 0.75
    this.cameraController.update(deltaTime, playerPosition)

    // Update HUD
    this.hud.update(this.playerMesh.position)
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
    this.hud.dispose()
    this.settingsMenu.dispose()
    this.npcManager.dispose()
    this.aoeManager.dispose()
    this.bossManager.dispose()
    this.numberSpriteManager.dispose()
    this.cameraController.dispose()
    this.inputManager.dispose()
    this.arena.dispose()

    // Dispose player mesh resources
    this.playerMesh.geometry.dispose()
    if (this.playerMesh.material instanceof THREE.Material) {
      this.playerMesh.material.dispose()
    }

    // Dispose renderer
    this.renderer.dispose()
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

  getNPCManager(): NPCManager {
    return this.npcManager
  }

  getHUD(): HUD {
    return this.hud
  }

  getSettingsMenu(): SettingsMenu {
    return this.settingsMenu
  }

  getBossManager(): BossManager {
    return this.bossManager
  }
}
