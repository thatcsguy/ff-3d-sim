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
import { ResultOverlay } from './ResultOverlay'
import { StartPrompt } from './StartPrompt'
import { ChakramManager } from './ChakramManager'

type GameState = 'waiting' | 'playing' | 'failed' | 'clear'

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
  private resultOverlay: ResultOverlay
  private startPrompt: StartPrompt
  private chakramManager: ChakramManager
  private gameState: GameState = 'waiting'
  // Time to wait after all AoEs resolve before declaring success (seconds)
  private readonly successDelayAfterLastAoE: number = 0.5
  private successCheckTime: number | null = null
  // Player's assigned party number for this attempt (1-8)
  private playerNumber: number = 1

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

    // Result overlay setup
    this.resultOverlay = new ResultOverlay()

    // Start prompt setup
    this.startPrompt = new StartPrompt()

    // Chakram manager setup
    this.chakramManager = new ChakramManager(this.scene)

    this.setupTestTimeline()

    // Show start prompt (don't start timeline yet)
    this.startPrompt.show()

    // Listen for restart key
    window.addEventListener('keydown', this.onKeyDown)

    // Handle window resize
    window.addEventListener('resize', this.onResize)
  }

  /**
   * Get Braindead strategy positions for a given phase.
   * Returns a Map of party number (1-8) to position.
   *
   * Braindead strategy:
   * - Odds (1,3,5,7) go West (-X)
   * - Evens (2,4,6,8) go East (+X)
   * - 1/2 and 5/6 resolve north (-Z), 3/4 and 7/8 resolve south (+Z)
   */
  private getBraindeadPositions(phase: string): Map<number, THREE.Vector3> {
    const positions = new Map<number, THREE.Vector3>()
    const y = PLAYER_HEIGHT / 2

    // Positions relative to arena (arena radius ~18m)
    const westX = -8
    const eastX = 8
    const northZ = -8
    const southZ = 8
    const centerZ = 0
    const farWestX = -12
    const farEastX = 12

    switch (phase) {
      case 'start':
        // Everyone stacks center
        for (let i = 1; i <= 8; i++) {
          positions.set(i, new THREE.Vector3(0, y, 0))
        }
        break

      case 'spread':
        // After chakrams, odds go west, evens go east
        // Spread out vertically based on number pairs
        positions.set(1, new THREE.Vector3(westX, y, northZ - 2)) // 1 north-west, top
        positions.set(2, new THREE.Vector3(eastX, y, northZ - 2)) // 2 north-east, top
        positions.set(3, new THREE.Vector3(westX, y, southZ + 2)) // 3 south-west, bottom
        positions.set(4, new THREE.Vector3(eastX, y, southZ + 2)) // 4 south-east, bottom
        positions.set(5, new THREE.Vector3(westX, y, northZ + 2)) // 5 north-west, below 1
        positions.set(6, new THREE.Vector3(eastX, y, northZ + 2)) // 6 north-east, below 2
        positions.set(7, new THREE.Vector3(westX, y, southZ - 2)) // 7 south-west, above 3
        positions.set(8, new THREE.Vector3(eastX, y, southZ - 2)) // 8 south-east, above 4
        break

      case 'limit-cut-1-2':
        // 1 and 2 go north to bait first Limit Cut
        // Others stay at sides
        positions.set(1, new THREE.Vector3(westX - 2, y, northZ))
        positions.set(2, new THREE.Vector3(eastX + 2, y, northZ))
        positions.set(3, new THREE.Vector3(westX, y, southZ))
        positions.set(4, new THREE.Vector3(eastX, y, southZ))
        positions.set(5, new THREE.Vector3(farWestX, y, centerZ - 3)) // 5 far west, moving to puddle
        positions.set(6, new THREE.Vector3(farEastX, y, centerZ - 3)) // 6 far east, moving to puddle
        positions.set(7, new THREE.Vector3(westX, y, centerZ))
        positions.set(8, new THREE.Vector3(eastX, y, centerZ))
        break

      case 'puddle-1':
        // 5/6 soak first puddles (far west/east)
        positions.set(1, new THREE.Vector3(westX, y, northZ))
        positions.set(2, new THREE.Vector3(eastX, y, northZ))
        positions.set(3, new THREE.Vector3(westX, y, southZ))
        positions.set(4, new THREE.Vector3(eastX, y, southZ))
        positions.set(5, new THREE.Vector3(farWestX, y, centerZ)) // 5 soaking west puddle
        positions.set(6, new THREE.Vector3(farEastX, y, centerZ)) // 6 soaking east puddle
        positions.set(7, new THREE.Vector3(westX, y, centerZ))
        positions.set(8, new THREE.Vector3(eastX, y, centerZ))
        break

      case 'limit-cut-3-4':
        // 3/4 go south, 3 baits Super Jump
        // 5/6 swap north with 1/2
        positions.set(1, new THREE.Vector3(westX, y, centerZ + 2))
        positions.set(2, new THREE.Vector3(eastX, y, centerZ + 2))
        positions.set(3, new THREE.Vector3(westX - 2, y, southZ)) // 3 baits Super Jump
        positions.set(4, new THREE.Vector3(eastX + 2, y, southZ))
        positions.set(5, new THREE.Vector3(westX, y, northZ)) // 5 now north
        positions.set(6, new THREE.Vector3(eastX, y, northZ)) // 6 now north
        positions.set(7, new THREE.Vector3(farWestX, y, centerZ - 2)) // 7 moving to puddle
        positions.set(8, new THREE.Vector3(farEastX, y, centerZ - 2)) // 8 moving to puddle
        break

      case 'puddle-2':
        // 7/8 soak second puddles
        positions.set(1, new THREE.Vector3(westX, y, centerZ))
        positions.set(2, new THREE.Vector3(eastX, y, centerZ))
        positions.set(3, new THREE.Vector3(westX, y, southZ - 4)) // 3 dodging Apoc Ray
        positions.set(4, new THREE.Vector3(eastX, y, southZ - 4)) // 4 dodging Apoc Ray
        positions.set(5, new THREE.Vector3(westX, y, northZ))
        positions.set(6, new THREE.Vector3(eastX, y, northZ))
        positions.set(7, new THREE.Vector3(farWestX, y, centerZ)) // 7 soaking west puddle
        positions.set(8, new THREE.Vector3(farEastX, y, centerZ)) // 8 soaking east puddle
        break

      case 'limit-cut-5-6':
        // 5/6 bait north
        // 1/2 move to puddles
        positions.set(1, new THREE.Vector3(farWestX, y, centerZ - 2)) // 1 moving to puddle
        positions.set(2, new THREE.Vector3(farEastX, y, centerZ - 2)) // 2 moving to puddle
        positions.set(3, new THREE.Vector3(westX, y, southZ))
        positions.set(4, new THREE.Vector3(eastX, y, southZ))
        positions.set(5, new THREE.Vector3(westX - 2, y, northZ)) // 5 baiting
        positions.set(6, new THREE.Vector3(eastX + 2, y, northZ)) // 6 baiting
        positions.set(7, new THREE.Vector3(westX, y, centerZ))
        positions.set(8, new THREE.Vector3(eastX, y, centerZ))
        break

      case 'puddle-3':
        // 1/2 soak third puddles
        positions.set(1, new THREE.Vector3(farWestX, y, centerZ)) // 1 soaking west puddle
        positions.set(2, new THREE.Vector3(farEastX, y, centerZ)) // 2 soaking east puddle
        positions.set(3, new THREE.Vector3(westX, y, southZ))
        positions.set(4, new THREE.Vector3(eastX, y, southZ))
        positions.set(5, new THREE.Vector3(westX, y, northZ))
        positions.set(6, new THREE.Vector3(eastX, y, northZ))
        positions.set(7, new THREE.Vector3(westX, y, centerZ - 3))
        positions.set(8, new THREE.Vector3(eastX, y, centerZ - 3))
        break

      case 'limit-cut-7-8':
        // 7/8 bait south
        positions.set(1, new THREE.Vector3(westX, y, centerZ))
        positions.set(2, new THREE.Vector3(eastX, y, centerZ))
        positions.set(3, new THREE.Vector3(westX, y, southZ - 4))
        positions.set(4, new THREE.Vector3(eastX, y, southZ - 4))
        positions.set(5, new THREE.Vector3(westX, y, northZ))
        positions.set(6, new THREE.Vector3(eastX, y, northZ))
        positions.set(7, new THREE.Vector3(westX - 2, y, southZ)) // 7 baiting
        positions.set(8, new THREE.Vector3(eastX + 2, y, southZ)) // 8 baiting
        break

      case 'sacrament':
        // All dodge Sacrament - avoid center and edges
        // Move to safe spots (sides of T-laser)
        positions.set(1, new THREE.Vector3(westX, y, northZ - 2))
        positions.set(2, new THREE.Vector3(eastX, y, northZ - 2))
        positions.set(3, new THREE.Vector3(westX, y, northZ + 2))
        positions.set(4, new THREE.Vector3(eastX, y, northZ + 2))
        positions.set(5, new THREE.Vector3(westX - 4, y, northZ))
        positions.set(6, new THREE.Vector3(eastX + 4, y, northZ))
        positions.set(7, new THREE.Vector3(westX - 4, y, centerZ))
        positions.set(8, new THREE.Vector3(eastX + 4, y, centerZ))
        break

      case 'stack':
        // Final stack for Enumeration
        for (let i = 1; i <= 8; i++) {
          // Slight spread to avoid overlap
          const angle = ((i - 1) / 8) * Math.PI * 2
          positions.set(
            i,
            new THREE.Vector3(Math.cos(angle) * 2, y, Math.sin(angle) * 2)
          )
        }
        break
    }

    return positions
  }

  /**
   * Set NPC positions for current phase (NPCs only, player must move themselves)
   */
  private setNPCPositions(phase: string): void {
    const positions = this.getBraindeadPositions(phase)
    this.npcManager.setScriptedPositionsByNumber(positions, this.playerNumber)
  }

  /**
   * Setup the Wormhole Formation timeline with Braindead strategy.
   */
  private setupTestTimeline(): void {
    // Randomly assign player number (1-8)
    this.playerNumber = Math.floor(Math.random() * 8) + 1

    // Enable scripted NPC movement
    this.npcManager.setScriptedMode(true)

    // Start with everyone at center
    this.timeline.addEvent({
      id: 'phase-start',
      time: 0.1,
      handler: () => {
        // Teleport all NPCs to center
        const startPos = this.getBraindeadPositions('start')
        this.npcManager.teleportByNumber(startPos, this.playerNumber)
        this.setNPCPositions('start')
      },
    })

    // Assign number sprites
    this.timeline.addEvent({
      id: 'numbers-assign',
      time: 0.5,
      handler: () => {
        // Assign player their random number
        this.numberSpriteManager.assignNumber(
          'player',
          this.playerMesh,
          this.playerNumber
        )
        // Assign NPCs the remaining numbers
        const npcs = this.npcManager.getMeshes()
        let npcIndex = 0
        for (let partyNum = 1; partyNum <= 8; partyNum++) {
          if (partyNum === this.playerNumber) continue
          if (npcIndex < npcs.length) {
            this.numberSpriteManager.assignNumber(
              `npc-${npcIndex}`,
              npcs[npcIndex],
              partyNum
            )
            npcIndex++
          }
        }
      },
    })

    // Chakrams spawn at cardinals and cross through center
    // Two pairs: North<->South and West<->East cross simultaneously
    this.timeline.addEvent({
      id: 'chakrams-spawn',
      time: 2.0,
      handler: () => {
        const arenaEdge = 18 // Arena radius
        const travelTime = 2.0 // Time to cross arena
        const chakramRadius = 1.2
        const hitRadius = 2.5 // Generous hit detection

        // North to South chakram
        this.chakramManager.spawn({
          id: 'chakram-north',
          startPosition: new THREE.Vector3(0, 0, -arenaEdge),
          endPosition: new THREE.Vector3(0, 0, arenaEdge),
          travelTime,
          radius: chakramRadius,
          hitRadius,
        })

        // South to North chakram
        this.chakramManager.spawn({
          id: 'chakram-south',
          startPosition: new THREE.Vector3(0, 0, arenaEdge),
          endPosition: new THREE.Vector3(0, 0, -arenaEdge),
          travelTime,
          radius: chakramRadius,
          hitRadius,
        })

        // West to East chakram
        this.chakramManager.spawn({
          id: 'chakram-west',
          startPosition: new THREE.Vector3(-arenaEdge, 0, 0),
          endPosition: new THREE.Vector3(arenaEdge, 0, 0),
          travelTime,
          radius: chakramRadius,
          hitRadius,
        })

        // East to West chakram
        this.chakramManager.spawn({
          id: 'chakram-east',
          startPosition: new THREE.Vector3(arenaEdge, 0, 0),
          endPosition: new THREE.Vector3(-arenaEdge, 0, 0),
          travelTime,
          radius: chakramRadius,
          hitRadius,
        })

        console.log('Chakrams spawned!')
      },
    })

    // NPCs spread to sides after chakram telegraph appears
    this.timeline.addEvent({
      id: 'phase-spread',
      time: 2.5,
      handler: () => {
        this.setNPCPositions('spread')
      },
    })

    // Cruise Chaser spawns for Limit Cut
    this.timeline.addEvent({
      id: 'cc-spawn',
      time: 4.5,
      handler: () => {
        this.bossManager.show('cruiseChaser', new THREE.Vector3(-10, 0, 0))
        this.bossManager.setRotation('cruiseChaser', Math.PI / 2)
      },
    })

    // Limit Cut 1/2 - CC dashes north
    this.timeline.addEvent({
      id: 'phase-limit-cut-1-2',
      time: 5.0,
      handler: () => {
        this.setNPCPositions('limit-cut-1-2')
      },
    })

    this.timeline.addEvent({
      id: 'limit-cut-1-2-dash',
      time: 5.5,
      handler: () => {
        this.aoeManager.spawn({
          id: 'lc-dash-1',
          shape: 'line',
          position: new THREE.Vector3(0, 0, -8),
          length: 20,
          width: 2.5,
          rotation: Math.PI / 2,
          telegraphDuration: 1.2,
          onResolve: () => {
            this.bossManager.setPosition(
              'cruiseChaser',
              new THREE.Vector3(10, 0, -8)
            )
          },
        })
      },
    })

    // Spawn first puddles (west and east)
    this.timeline.addEvent({
      id: 'puddle-spawn-1',
      time: 6.8,
      handler: () => {
        // West puddle (soaked by 5)
        this.aoeManager.spawn({
          id: 'puddle-1-west',
          shape: 'puddle',
          position: new THREE.Vector3(-12, 0, 0),
          soakRadius: 2.5,
          soakCount: 1,
          telegraphDuration: 3.0,
          onResolve: () => {
            console.log('Puddle 1 west resolved')
          },
        })
        // East puddle (soaked by 6)
        this.aoeManager.spawn({
          id: 'puddle-1-east',
          shape: 'puddle',
          position: new THREE.Vector3(12, 0, 0),
          soakRadius: 2.5,
          soakCount: 1,
          telegraphDuration: 3.0,
          onResolve: () => {
            console.log('Puddle 1 east resolved')
          },
        })
      },
    })

    // First puddle soak (5/6)
    this.timeline.addEvent({
      id: 'phase-puddle-1',
      time: 7.0,
      handler: () => {
        this.setNPCPositions('puddle-1')
      },
    })

    // Limit Cut 3/4 + Super Jump bait
    this.timeline.addEvent({
      id: 'phase-limit-cut-3-4',
      time: 8.5,
      handler: () => {
        this.setNPCPositions('limit-cut-3-4')
      },
    })

    // Brute Justice spawns for Super Jump
    this.timeline.addEvent({
      id: 'bj-spawn',
      time: 9.0,
      handler: () => {
        this.bossManager.show('bruteJustice', new THREE.Vector3(0, 0, -12))
        this.bossManager.setRotation('bruteJustice', Math.PI)
      },
    })

    this.timeline.addEvent({
      id: 'limit-cut-3-4-dash',
      time: 9.5,
      handler: () => {
        this.aoeManager.spawn({
          id: 'lc-dash-2',
          shape: 'line',
          position: new THREE.Vector3(0, 0, 8),
          length: 20,
          width: 2.5,
          rotation: Math.PI / 2,
          telegraphDuration: 1.2,
          onResolve: () => {
            this.bossManager.setPosition(
              'cruiseChaser',
              new THREE.Vector3(-10, 0, 8)
            )
          },
        })
      },
    })

    // Super Jump lands + Apocalyptic Ray
    this.timeline.addEvent({
      id: 'super-jump-land',
      time: 11.0,
      handler: () => {
        // BJ jumps to south
        this.bossManager.setPosition(
          'bruteJustice',
          new THREE.Vector3(0, 0, 10)
        )
        this.bossManager.setRotation('bruteJustice', 0)
      },
    })

    this.timeline.addEvent({
      id: 'apocalyptic-ray',
      time: 11.5,
      handler: () => {
        this.aoeManager.spawn({
          id: 'apoc-ray',
          shape: 'cone',
          position: new THREE.Vector3(0, 0, 10),
          radius: 15,
          angle: Math.PI / 3,
          rotation: 0, // Pointing north
          telegraphDuration: 2.0,
          onResolve: () => {
            console.log('Apocalyptic Ray resolved!')
          },
        })
      },
    })

    // Spawn second puddles
    this.timeline.addEvent({
      id: 'puddle-spawn-2',
      time: 11.8,
      handler: () => {
        // West puddle (soaked by 7)
        this.aoeManager.spawn({
          id: 'puddle-2-west',
          shape: 'puddle',
          position: new THREE.Vector3(-12, 0, 0),
          soakRadius: 2.5,
          soakCount: 1,
          telegraphDuration: 3.0,
          onResolve: () => {
            console.log('Puddle 2 west resolved')
          },
        })
        // East puddle (soaked by 8)
        this.aoeManager.spawn({
          id: 'puddle-2-east',
          shape: 'puddle',
          position: new THREE.Vector3(12, 0, 0),
          soakRadius: 2.5,
          soakCount: 1,
          telegraphDuration: 3.0,
          onResolve: () => {
            console.log('Puddle 2 east resolved')
          },
        })
      },
    })

    // Second puddle soak (7/8)
    this.timeline.addEvent({
      id: 'phase-puddle-2',
      time: 12.0,
      handler: () => {
        this.setNPCPositions('puddle-2')
      },
    })

    // Limit Cut 5/6
    this.timeline.addEvent({
      id: 'phase-limit-cut-5-6',
      time: 14.0,
      handler: () => {
        this.setNPCPositions('limit-cut-5-6')
      },
    })

    this.timeline.addEvent({
      id: 'limit-cut-5-6-dash',
      time: 14.5,
      handler: () => {
        this.aoeManager.spawn({
          id: 'lc-dash-3',
          shape: 'line',
          position: new THREE.Vector3(0, 0, -8),
          length: 20,
          width: 2.5,
          rotation: Math.PI / 2,
          telegraphDuration: 1.2,
          onResolve: () => {
            this.bossManager.setPosition(
              'cruiseChaser',
              new THREE.Vector3(10, 0, -8)
            )
          },
        })
      },
    })

    // Spawn third puddles
    this.timeline.addEvent({
      id: 'puddle-spawn-3',
      time: 15.8,
      handler: () => {
        // West puddle (soaked by 1)
        this.aoeManager.spawn({
          id: 'puddle-3-west',
          shape: 'puddle',
          position: new THREE.Vector3(-12, 0, 0),
          soakRadius: 2.5,
          soakCount: 1,
          telegraphDuration: 3.0,
          onResolve: () => {
            console.log('Puddle 3 west resolved')
          },
        })
        // East puddle (soaked by 2)
        this.aoeManager.spawn({
          id: 'puddle-3-east',
          shape: 'puddle',
          position: new THREE.Vector3(12, 0, 0),
          soakRadius: 2.5,
          soakCount: 1,
          telegraphDuration: 3.0,
          onResolve: () => {
            console.log('Puddle 3 east resolved')
          },
        })
      },
    })

    // Third puddle soak (1/2)
    this.timeline.addEvent({
      id: 'phase-puddle-3',
      time: 16.0,
      handler: () => {
        this.setNPCPositions('puddle-3')
      },
    })

    // Limit Cut 7/8
    this.timeline.addEvent({
      id: 'phase-limit-cut-7-8',
      time: 17.5,
      handler: () => {
        this.setNPCPositions('limit-cut-7-8')
      },
    })

    this.timeline.addEvent({
      id: 'limit-cut-7-8-dash',
      time: 18.0,
      handler: () => {
        this.aoeManager.spawn({
          id: 'lc-dash-4',
          shape: 'line',
          position: new THREE.Vector3(0, 0, 8),
          length: 20,
          width: 2.5,
          rotation: Math.PI / 2,
          telegraphDuration: 1.2,
          onResolve: () => {
            this.bossManager.hide('cruiseChaser')
          },
        })
      },
    })

    // Alexander Prime spawns
    this.timeline.addEvent({
      id: 'alex-spawn',
      time: 19.5,
      handler: () => {
        this.bossManager.show('alexanderPrime', new THREE.Vector3(0, 0, 12))
        this.bossManager.setRotation('alexanderPrime', 0)
      },
    })

    // Sacrament
    this.timeline.addEvent({
      id: 'phase-sacrament',
      time: 20.0,
      handler: () => {
        this.setNPCPositions('sacrament')
      },
    })

    this.timeline.addEvent({
      id: 'sacrament-cast',
      time: 20.5,
      handler: () => {
        this.aoeManager.spawn({
          id: 'sacrament-aoe',
          shape: 'tshape',
          position: new THREE.Vector3(0, 0, 12),
          stemLength: 24,
          stemWidth: 4,
          barLength: 20,
          barWidth: 4,
          rotation: 0,
          telegraphDuration: 2.5,
          onResolve: () => {
            console.log('Sacrament resolved!')
          },
        })
      },
    })

    // Final stack
    this.timeline.addEvent({
      id: 'phase-stack',
      time: 23.5,
      handler: () => {
        this.setNPCPositions('stack')
        this.bossManager.hide('bruteJustice')
        this.bossManager.hide('alexanderPrime')
      },
    })

    // Timeline is started when player presses Space
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    // Start mechanic on Space key when in waiting state
    if (event.key === ' ') {
      if (this.gameState === 'waiting') {
        this.startMechanic()
      }
    }
    // Restart on R key when in failed or clear state
    if (event.key === 'r' || event.key === 'R') {
      if (this.gameState === 'failed' || this.gameState === 'clear') {
        this.restart()
      }
    }
  }

  /**
   * Start the mechanic after player presses the start key.
   */
  private startMechanic(): void {
    this.startPrompt.hide()
    this.gameState = 'playing'
    this.timeline.start()
  }

  /**
   * Restart the mechanic from the beginning.
   */
  private restart(): void {
    // Hide result overlay
    this.resultOverlay.hide()

    // Reset game state to waiting
    this.gameState = 'waiting'
    this.successCheckTime = null

    // Reset player position to center
    this.playerMesh.position.set(0, PLAYER_HEIGHT / 2, 0)

    // Reset timeline
    this.timeline.reset()
    this.timeline.clearEvents()

    // Clear all AoEs
    this.aoeManager.dispose()
    this.aoeManager = new AoEManager(this.scene)

    // Clear all chakrams
    this.chakramManager.dispose()
    this.chakramManager = new ChakramManager(this.scene)

    // Hide all bosses
    this.bossManager.hide('cruiseChaser')
    this.bossManager.hide('bruteJustice')
    this.bossManager.hide('alexanderPrime')

    // Clear number sprites
    this.numberSpriteManager.dispose()
    this.numberSpriteManager = new NumberSpriteManager()
    this.numberSpriteManager.init(this.scene)

    // Reset NPC scripted mode and positions
    this.npcManager.setScriptedMode(false)
    this.npcManager.clearScriptedPositions()

    // Re-setup timeline (don't start yet - will assign new random number)
    this.setupTestTimeline()

    // Show start prompt
    this.startPrompt.show()
  }

  /**
   * Trigger failure state when player is hit by an AoE.
   */
  private triggerFailure(): void {
    if (this.gameState !== 'playing') return
    this.gameState = 'failed'
    this.timeline.stop()
    this.resultOverlay.show('failed')
  }

  /**
   * Trigger success state when all mechanics are survived.
   */
  private triggerSuccess(): void {
    if (this.gameState !== 'playing') return
    this.gameState = 'clear'
    this.timeline.stop()
    this.resultOverlay.show('clear')
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
    if (hits.length > 0 && this.gameState === 'playing') {
      console.log('Player hit by AoEs:', hits)
      this.triggerFailure()
    }

    // Update chakrams and check for hits
    const chakramHits = this.chakramManager.update(
      deltaTime,
      this.playerMesh.position
    )
    if (chakramHits.length > 0 && this.gameState === 'playing') {
      console.log('Player hit by chakrams:', chakramHits)
      this.triggerFailure()
    }

    // Check for success: timeline complete and no active AoEs, with a small delay
    if (this.gameState === 'playing' && this.timeline.isComplete()) {
      const activeAoECount = this.aoeManager.getActiveCount()
      if (activeAoECount === 0) {
        // Start success delay timer if not already started
        if (this.successCheckTime === null) {
          this.successCheckTime = 0
        }
        this.successCheckTime += deltaTime
        if (this.successCheckTime >= this.successDelayAfterLastAoE) {
          this.triggerSuccess()
        }
      } else {
        // Reset timer if there are still active AoEs
        this.successCheckTime = null
      }
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
    window.removeEventListener('keydown', this.onKeyDown)
    this.hud.dispose()
    this.settingsMenu.dispose()
    this.npcManager.dispose()
    this.aoeManager.dispose()
    this.chakramManager.dispose()
    this.bossManager.dispose()
    this.numberSpriteManager.dispose()
    this.resultOverlay.dispose()
    this.startPrompt.dispose()
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
