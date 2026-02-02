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
import { BuffManager } from './BuffManager'
import { AbilitySystem } from './AbilitySystem'
import { Hotbar } from './Hotbar'
import { BuffDisplay } from './BuffDisplay'

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
  private buffManager: BuffManager
  private abilitySystem: AbilitySystem
  private hotbar: Hotbar
  private buffDisplay: BuffDisplay
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

    // Buff and ability system setup
    this.buffManager = new BuffManager()
    this.abilitySystem = new AbilitySystem(this.buffManager, 'player')
    this.hotbar = new Hotbar(this.abilitySystem)
    this.buffDisplay = new BuffDisplay(this.buffManager, 'player')

    // Player controller setup (must be after playerMesh is created)
    this.playerController = new PlayerController(this.playerMesh, this.inputManager, this.buffManager)

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
   * Wormhole Formation positions - matching accurate FFXIV mechanic.
   */
  private getBraindeadPositions(phase: string): Map<number, THREE.Vector3> {
    const positions = new Map<number, THREE.Vector3>()
    const y = PLAYER_HEIGHT / 2

    // Arena radius is ~18m, puddles at ESE/WNW (22.5° from E/W)
    const puddleDist = ARENA_RADIUS - 0.2 * ARENA_RADIUS // Distance to puddle center
    const puddleAngle = (22.5 * Math.PI) / 180
    const puddleCos = Math.cos(puddleAngle)
    const puddleSin = Math.sin(puddleAngle)
    // ESE puddle position components
    const esePuddleX = puddleDist * puddleCos
    const esePuddleZ = puddleDist * puddleSin
    // WNW puddle position components
    const wnwPuddleX = -puddleDist * puddleCos
    const wnwPuddleZ = -puddleDist * puddleSin
    const safeX = 8 // Safe spot X for avoiding mechanics
    const safeZ = 8 // Safe spot Z

    switch (phase) {
      case 'start':
        // Everyone stacks center at start
        for (let i = 1; i <= 8; i++) {
          positions.set(i, new THREE.Vector3(0, y, 0))
        }
        break

      case 'spread':
        // After boss spawn, spread to numbered positions
        // 1-4 north half, 5-8 south half
        // Odds west, evens east
        positions.set(1, new THREE.Vector3(-safeX, y, -safeZ))
        positions.set(2, new THREE.Vector3(safeX, y, -safeZ))
        positions.set(3, new THREE.Vector3(-safeX, y, -safeZ / 2))
        positions.set(4, new THREE.Vector3(safeX, y, -safeZ / 2))
        positions.set(5, new THREE.Vector3(-safeX, y, safeZ / 2))
        positions.set(6, new THREE.Vector3(safeX, y, safeZ / 2))
        positions.set(7, new THREE.Vector3(-safeX, y, safeZ))
        positions.set(8, new THREE.Vector3(safeX, y, safeZ))
        break

      case 'bj-bait':
        // #1 goes to far position to bait BJ Super Jump
        // Others spread along sides
        positions.set(1, new THREE.Vector3(0, y, safeZ + 4)) // Farthest from BJ (north)
        positions.set(2, new THREE.Vector3(safeX, y, -safeZ / 2))
        positions.set(3, new THREE.Vector3(-safeX, y, -safeZ / 2))
        positions.set(4, new THREE.Vector3(safeX, y, 0))
        positions.set(5, new THREE.Vector3(wnwPuddleX, y, wnwPuddleZ)) // WNW puddle soak ready
        positions.set(6, new THREE.Vector3(esePuddleX, y, esePuddleZ)) // ESE puddle soak ready
        positions.set(7, new THREE.Vector3(-safeX, y, safeZ / 2))
        positions.set(8, new THREE.Vector3(safeX, y, safeZ / 2))
        break

      case 'puddle-1':
        // #5/#6 soak ESE/WNW puddles (first soak)
        positions.set(1, new THREE.Vector3(0, y, safeZ))
        positions.set(2, new THREE.Vector3(safeX, y, -safeZ / 2))
        positions.set(3, new THREE.Vector3(-safeX, y, -safeZ / 2))
        positions.set(4, new THREE.Vector3(safeX, y, 0))
        positions.set(5, new THREE.Vector3(wnwPuddleX, y, wnwPuddleZ)) // Soaking WNW
        positions.set(6, new THREE.Vector3(esePuddleX, y, esePuddleZ)) // Soaking ESE
        positions.set(7, new THREE.Vector3(-safeX, y, safeZ / 2))
        positions.set(8, new THREE.Vector3(safeX, y, safeZ / 2))
        break

      case 'puddle-2':
        // #7/#8 soak ESE/WNW puddles (second soak - half radius)
        positions.set(1, new THREE.Vector3(0, y, safeZ))
        positions.set(2, new THREE.Vector3(safeX, y, -safeZ / 2))
        positions.set(3, new THREE.Vector3(-safeX, y, -safeZ / 2))
        positions.set(4, new THREE.Vector3(safeX, y, 0))
        positions.set(5, new THREE.Vector3(-safeX, y, safeZ / 2))
        positions.set(6, new THREE.Vector3(safeX, y, safeZ / 2))
        positions.set(7, new THREE.Vector3(wnwPuddleX, y, wnwPuddleZ)) // Soaking WNW
        positions.set(8, new THREE.Vector3(esePuddleX, y, esePuddleZ)) // Soaking ESE
        break

      case 'puddle-3':
        // Final soak - quarter radius
        positions.set(1, new THREE.Vector3(wnwPuddleX, y, wnwPuddleZ)) // #1 soak WNW
        positions.set(2, new THREE.Vector3(esePuddleX, y, esePuddleZ)) // #2 soak ESE
        positions.set(3, new THREE.Vector3(-safeX, y, -safeZ / 2))
        positions.set(4, new THREE.Vector3(safeX, y, -safeZ / 2))
        positions.set(5, new THREE.Vector3(-safeX, y, safeZ / 2))
        positions.set(6, new THREE.Vector3(safeX, y, safeZ / 2))
        positions.set(7, new THREE.Vector3(-safeX, y, safeZ))
        positions.set(8, new THREE.Vector3(safeX, y, safeZ))
        break

      case 'final':
        // After all soaks, everyone moves to center
        for (let i = 1; i <= 8; i++) {
          const angle = ((i - 1) / 8) * Math.PI * 2
          positions.set(
            i,
            new THREE.Vector3(Math.cos(angle) * 3, y, Math.sin(angle) * 3)
          )
        }
        break
    }

    return positions
  }

  /**
   * Add random offset to simulate realistic player positioning.
   * Returns the coordinate with +/- 0.5 random offset.
   */
  private randomizeCoord(value: number): number {
    return value + (Math.random() - 0.5)
  }

  /**
   * Check if a position should be kept precise (corner positions at +/-12, +/-12).
   */
  private isCornerPosition(x: number, z: number): boolean {
    return Math.abs(Math.abs(x) - 12) < 0.01 && Math.abs(Math.abs(z) - 12) < 0.01
  }

  /**
   * Apply randomization to a map of positions.
   * Positions at corners (+/-12, +/-12) are kept exact.
   */
  private randomizePositions(positions: Map<number, THREE.Vector3>): Map<number, THREE.Vector3> {
    const randomized = new Map<number, THREE.Vector3>()
    for (const [num, pos] of positions) {
      if (this.isCornerPosition(pos.x, pos.z)) {
        randomized.set(num, pos.clone())
      } else {
        randomized.set(num, new THREE.Vector3(
          this.randomizeCoord(pos.x),
          pos.y,
          this.randomizeCoord(pos.z)
        ))
      }
    }
    return randomized
  }

  /**
   * Set a single party member's target position.
   * If it's an NPC, sets their scripted position. Player must move themselves.
   * Adds +/- 0.5 randomization unless it's a corner position (+/-12, +/-12).
   * @param partyNum Party number (1-8)
   * @param x X coordinate
   * @param z Z coordinate
   */
  private setPartyMemberTarget(partyNum: number, x: number, z: number): void {
    if (partyNum === this.playerNumber) {
      // Player must move themselves, we don't control them
      return
    }

    // Apply randomization unless it's a corner position
    let finalX = x
    let finalZ = z
    if (!this.isCornerPosition(x, z)) {
      finalX = this.randomizeCoord(x)
      finalZ = this.randomizeCoord(z)
    }

    // Find NPC index for this party number
    let npcIndex = 0
    for (let num = 1; num <= 8; num++) {
      if (num === this.playerNumber) continue
      if (num === partyNum) {
        this.npcManager.setScriptedPosition(
          npcIndex,
          new THREE.Vector3(finalX, PLAYER_HEIGHT / 2, finalZ)
        )
        return
      }
      npcIndex++
    }
  }

  /**
   * Get the mesh for a party member by their assigned number (1-8).
   * Returns player mesh if partyNum matches playerNumber, otherwise returns NPC mesh.
   */
  private getEntityByNumber(partyNum: number): THREE.Mesh | null {
    if (partyNum === this.playerNumber) {
      return this.playerMesh
    }
    // NPCs fill slots not taken by player
    let npcIndex = 0
    for (let num = 1; num <= 8; num++) {
      if (num === this.playerNumber) continue
      if (num === partyNum) {
        const meshes = this.npcManager.getMeshes()
        return npcIndex < meshes.length ? meshes[npcIndex] : null
      }
      npcIndex++
    }
    return null
  }

  /**
   * Get the position of a party member by their assigned number (1-8).
   */
  private getEntityPosition(partyNum: number): THREE.Vector3 | null {
    const mesh = this.getEntityByNumber(partyNum)
    return mesh ? mesh.position.clone() : null
  }

  /**
   * Find the party member farthest from a given position.
   * Returns the party number (1-8) of the farthest member.
   */
  private getFarthestPlayerFrom(position: THREE.Vector3): number {
    let farthestNum = 1
    let farthestDistSq = 0

    for (let partyNum = 1; partyNum <= 8; partyNum++) {
      const entityPos = this.getEntityPosition(partyNum)
      if (!entityPos) continue

      const dx = entityPos.x - position.x
      const dz = entityPos.z - position.z
      const distSq = dx * dx + dz * dz

      if (distSq > farthestDistSq) {
        farthestDistSq = distSq
        farthestNum = partyNum
      }
    }

    return farthestNum
  }

  /**
   * Get positions of all party members (player + NPCs).
   * Returns array of 8 Vector3 positions.
   */
  private getAllPartyPositions(): THREE.Vector3[] {
    const positions: THREE.Vector3[] = []
    for (let partyNum = 1; partyNum <= 8; partyNum++) {
      const pos = this.getEntityPosition(partyNum)
      if (pos) {
        positions.push(pos)
      }
    }
    return positions
  }

  /**
   * Spawn Cruise Chaser cone attack on an odd-numbered player.
   * - If target is NPC: CC spawns slightly toward arena center, cone fires outward
   * - If target is player: CC spawns behind player (opposite facing), cone fires in facing direction
   */
  private spawnCruiseChaserCone(targetPlayerNum: number, coneId: string): void {
    const targetPos = this.getEntityPosition(targetPlayerNum)!
    const CC_OFFSET = 1 // How far CC spawns from the target

    let ccPosition: THREE.Vector3
    let coneRotation: number

    if (targetPlayerNum === this.playerNumber) {
      // Target is the human player - use camera facing direction
      const forwardDir = this.cameraController.getForwardDirection()
      // CC spawns behind player (opposite of facing)
      ccPosition = targetPos.clone().sub(forwardDir.clone().multiplyScalar(CC_OFFSET))
      // Cone fires in the direction the player is facing
      coneRotation = Math.atan2(forwardDir.x, forwardDir.z)
    } else {
      // Target is an NPC - use arena-relative positioning
      const toCenter = targetPos.clone().negate().normalize()
      // CC spawns toward arena center from NPC
      ccPosition = targetPos.clone().add(toCenter.clone().multiplyScalar(CC_OFFSET))
      // Cone fires radially outward (away from center)
      const outwardDir = targetPos.clone().normalize()
      coneRotation = Math.atan2(outwardDir.x, outwardDir.z)
    }

    this.bossManager.show('cruiseChaser', ccPosition)
    // Make CC face the cone direction
    this.bossManager.setRotation('cruiseChaser', coneRotation)

    this.aoeManager.spawn({
      id: coneId,
      shape: 'cone',
      position: ccPosition,
      radius: 5,
      angle: Math.PI / 2, // 90°
      rotation: coneRotation,
      telegraphDuration: 0.5,
    })
  }

  /**
   * Setup the Wormhole Formation timeline matching accurate FFXIV mechanic.
   */
  private setupTestTimeline(): void {
    // Randomly assign player number (1-8)
    this.playerNumber = Math.floor(Math.random() * 8) + 1

    // Enable scripted NPC movement
    this.npcManager.setScriptedMode(true)

    // Randomly choose BJ/CC spawn positions (NE or NW)
    // Position them fully outside the arena (arena radius + boss radius)
    // BJ is a box ~1.25m from center to corner, CC cylinder radius 0.6m
    const bjDist = ARENA_RADIUS + 1.5 // Extra margin for BJ's box shape
    const ccDist = ARENA_RADIUS + 1.0
    const bjCoord = bjDist / Math.sqrt(2) // 45° angle
    const ccCoord = ccDist / Math.sqrt(2)

    const bjNorthEast = Math.random() < 0.5
    const bjSpawnPos = bjNorthEast
      ? new THREE.Vector3(bjCoord, 0, -bjCoord) // NE
      : new THREE.Vector3(-bjCoord, 0, -bjCoord) // NW
    const ccSpawnPos = bjNorthEast
      ? new THREE.Vector3(-ccCoord, 0, -ccCoord) // NW (opposite)
      : new THREE.Vector3(ccCoord, 0, -ccCoord) // NE (opposite)

    // Puddle positions (rotated 22.5° clockwise from E/W - ESE/WNW, tangent to arena edge)
    const puddleRadius = 0.4 * ARENA_RADIUS
    const puddleDistance = ARENA_RADIUS - puddleRadius
    const puddleAngle = (22.5 * Math.PI) / 180
    const puddleCos = Math.cos(puddleAngle)
    const puddleSin = Math.sin(puddleAngle)
    const wnwPuddlePos = new THREE.Vector3(
      -puddleDistance * puddleCos,
      0,
      -puddleDistance * puddleSin
    )
    const esePuddlePos = new THREE.Vector3(
      puddleDistance * puddleCos,
      0,
      puddleDistance * puddleSin
    )

    // ==================== t=0: Spawn bosses ====================
    this.timeline.addEvent({
      id: 'boss-spawn',
      time: 0.1,
      handler: () => {
        // Teleport all NPCs to center with slight randomization
        const startPos = this.randomizePositions(this.getBraindeadPositions('start'))
        this.npcManager.teleportByNumber(startPos, this.playerNumber)
        this.npcManager.setScriptedPositionsByNumber(startPos, this.playerNumber)

        // Alexander Prime south (fully outside arena - radius 1.0m)
        this.bossManager.show('alexanderPrime', new THREE.Vector3(0, 0, ARENA_RADIUS + 1.5))
        this.bossManager.lookAt('alexanderPrime', new THREE.Vector3(0, 0, 0))

        // BJ and CC at NE/NW
        this.bossManager.show('bruteJustice', bjSpawnPos)
        this.bossManager.lookAt('bruteJustice', new THREE.Vector3(0, 0, 0))

        this.bossManager.show('cruiseChaser', ccSpawnPos)
        this.bossManager.lookAt('cruiseChaser', new THREE.Vector3(0, 0, 0))
      },
    })

    // ==================== t=2: Spawn chakrams E/S (stationary) ====================
    this.timeline.addEvent({
      id: 'chakrams-spawn',
      time: 2.0,
      handler: () => {
        const travelTime = 2.0
        const chakramRadius = 1.2
        const hitRadius = 2.5

        // East chakram (will travel west)
        this.chakramManager.spawnStationary({
          id: 'chakram-east',
          startPosition: new THREE.Vector3(ARENA_RADIUS, 0, 0),
          endPosition: new THREE.Vector3(-ARENA_RADIUS, 0, 0),
          travelTime,
          radius: chakramRadius,
          hitRadius,
        })

        // South chakram (will travel north)
        this.chakramManager.spawnStationary({
          id: 'chakram-south',
          startPosition: new THREE.Vector3(0, 0, ARENA_RADIUS),
          endPosition: new THREE.Vector3(0, 0, -ARENA_RADIUS),
          travelTime,
          radius: chakramRadius,
          hitRadius,
        })
      },
    })

    // ==================== t=7: Assign number markers ====================
    this.timeline.addEvent({
      id: 'numbers-assign',
      time: 7.0,
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

    // ==================== t=8: Initial spread positions ====================
    this.timeline.addEvent({
      id: 'npc-move-t8',
      time: 8.0,
      handler: () => {
        this.setPartyMemberTarget(1, -12, -12)
        this.setPartyMemberTarget(2, 12, -12)
        this.setPartyMemberTarget(3, -12, 12)
        this.setPartyMemberTarget(4, 12, 12)
        this.setPartyMemberTarget(5, -16, -5.5)
        this.setPartyMemberTarget(6, 16, -5.5)
        this.setPartyMemberTarget(7, -16, -5.5)
        this.setPartyMemberTarget(8, 16, -5.5)
      },
    })

    // ==================== t=11: Spawn puddles ESE/WNW ====================
    this.timeline.addEvent({
      id: 'puddles-spawn',
      time: 11.0,
      handler: () => {
        // WNW puddle
        this.aoeManager.spawn({
          id: 'puddle-west',
          shape: 'puddle',
          position: wnwPuddlePos,
          soakRadius: puddleRadius,
          soakCount: 1,
          telegraphDuration: 999, // Don't auto-resolve, we check manually
        })

        // ESE puddle
        this.aoeManager.spawn({
          id: 'puddle-east',
          shape: 'puddle',
          position: esePuddlePos,
          soakRadius: puddleRadius,
          soakCount: 1,
          telegraphDuration: 999,
        })
      },
    })

    // ==================== t=15: Chakrams fire across arena ====================
    this.timeline.addEvent({
      id: 'chakrams-fire',
      time: 15.0,
      handler: () => {
        this.chakramManager.startMovement('chakram-east')
        this.chakramManager.startMovement('chakram-south')
      },
    })

    // ==================== t=16: BJ leap + CC teleport behind #1 ====================
    this.timeline.addEvent({
      id: 'bj-leap-cc-first',
      time: 16.0,
      handler: () => {
        // BJ leaps to farthest player
        const bjPos = this.bossManager.getPosition('bruteJustice')!
        const farthestNum = this.getFarthestPlayerFrom(bjPos)
        const targetPos = this.getEntityPosition(farthestNum)!

        this.bossManager.startJumpArc(
          'bruteJustice',
          targetPos,
          1.0, // 1 second jump
          10,
          () => {
            // Face farthest player after landing
            const newFarthest = this.getFarthestPlayerFrom(this.bossManager.getPosition('bruteJustice')!)
            const newTarget = this.getEntityPosition(newFarthest)
            if (newTarget) {
              this.bossManager.lookAt('bruteJustice', newTarget)
            }
          }
        )

        // CC teleports to #1 and fires cone
        this.spawnCruiseChaserCone(1, 'cc-cone-1')
      },
    })

    // ==================== t=17: BJ lands (8y circular AoE) + movement ====================
    this.timeline.addEvent({
      id: 'bj-land-aoe',
      time: 17.0,
      handler: () => {
        const bjPos = this.bossManager.getPosition('bruteJustice')!
        this.aoeManager.spawn({
          id: 'bj-land',
          shape: 'circle',
          position: bjPos,
          radius: 12,
          telegraphDuration: 0.3,
        })

        // Players 7 & 8 move to puddle positions
        this.setPartyMemberTarget(7, -17, 0)
        this.setPartyMemberTarget(8, 17, 0)
      },
    })

    // ==================== t=18: CC dash to #2, AP starts plus charge ====================
    this.timeline.addEvent({
      id: 'cc-dash-2-ap-charge',
      time: 18.0,
      handler: () => {
        // CC dashes to #2 (line AoE + boss movement)
        const ccPos = this.bossManager.getPosition('cruiseChaser')!
        const player2Pos = this.getEntityPosition(2)!
        const dashDir = player2Pos.clone().sub(ccPos).normalize()
        // Extend dash through target and outside arena
        const dashEndPos = ccPos.clone().add(dashDir.multiplyScalar(ARENA_RADIUS * 2.5))
        const dashLength = ccPos.distanceTo(dashEndPos)
        const dashCenter = ccPos.clone().add(dashEndPos).multiplyScalar(0.5)
        const dashRotation = Math.atan2(dashDir.x, dashDir.z)

        this.aoeManager.spawn({
          id: 'cc-dash-2',
          shape: 'line',
          position: dashCenter,
          length: dashLength,
          width: 8,
          rotation: dashRotation,
          telegraphDuration: 0.5,
        })

        // Start boss dash animation (very fast: 0.25s)
        this.bossManager.startDash(
          'cruiseChaser',
          player2Pos,
          dashEndPos,
          0.25,
          () => {
            this.bossManager.hide('cruiseChaser')
          }
        )

        // AP starts plus charge (telegraph shows)
        const apPos = this.bossManager.getPosition('alexanderPrime')!
        this.aoeManager.spawn({
          id: 'ap-plus',
          shape: 'plus',
          position: apPos,
          armLength: ARENA_RADIUS,
          armWidth: 12,
          telegraphDuration: 6.0, // Fires at t=24
        })

        // Player 6 moves
        this.setPartyMemberTarget(6, 14, 0)
      },
    })

    // ==================== t=19-24: BJ 90° cone every 0.5s ====================
    // BJ fires cone at farthest player every 0.5 seconds from t=19 to t=24
    // Direction is locked to farthest player at t=19
    let bjConeRotation: number | null = null
    for (let i = 0; i <= 10; i++) {
      const coneTime = 19.0 + i * 0.5
      this.timeline.addEvent({
        id: `bj-cone-${i}`,
        time: coneTime,
        handler: () => {
          const bjPos = this.bossManager.getPosition('bruteJustice')!

          // First cone: calculate direction to farthest player and lock it
          if (bjConeRotation === null) {
            const farthestNum = this.getFarthestPlayerFrom(bjPos)
            const targetPos = this.getEntityPosition(farthestNum)!
            const coneDir = targetPos.clone().sub(bjPos).normalize()
            bjConeRotation = Math.atan2(coneDir.x, coneDir.z)
            this.bossManager.lookAt('bruteJustice', targetPos)
          }

          this.aoeManager.spawn({
            id: `bj-cone-${i}`,
            shape: 'cone',
            position: bjPos,
            radius: 24,
            angle: Math.PI / 2, // 90°
            rotation: bjConeRotation,
            telegraphDuration: 0.4,
          })
        },
      })
    }

    // ==================== t=20: CC teleport behind #3, cone + movement ====================
    this.timeline.addEvent({
      id: 'cc-cone-3',
      time: 20.0,
      handler: () => {
        // CC teleports to #3 and fires cone
        this.spawnCruiseChaserCone(3, 'cc-cone-3')
      },
    })

    // ==================== t=21: First puddle soak check ====================
    this.timeline.addEvent({
      id: 'puddle-check-1',
      time: 21.0,
      handler: () => {
        const positions = this.getAllPartyPositions()
        this.aoeManager.checkPuddleSoak('puddle-west', positions)
        this.aoeManager.checkPuddleSoak('puddle-east', positions)
        // Failure disabled for now
      },
    })

    // ==================== t=22: Puddles respawn at 65% radius, CC dash to #4, movement ====================
    this.timeline.addEvent({
      id: 'puddle-respawn-1',
      time: 22.0,
      handler: () => {
        // Respawn puddles at 65% radius (shrink by 35%)
        this.aoeManager.respawnPuddle('puddle-west', puddleRadius * 0.65, 999)
        this.aoeManager.respawnPuddle('puddle-east', puddleRadius * 0.65, 999)

        // CC dashes to #4 (line AoE + boss movement)
        const ccPos = this.bossManager.getPosition('cruiseChaser')!
        const player4Pos = this.getEntityPosition(4)!
        const dashDir = player4Pos.clone().sub(ccPos).normalize()
        // Extend dash through target and outside arena
        const dashEndPos = ccPos.clone().add(dashDir.multiplyScalar(ARENA_RADIUS * 2.5))
        const dashLength = ccPos.distanceTo(dashEndPos)
        const dashCenter = ccPos.clone().add(dashEndPos).multiplyScalar(0.5)
        const dashRotation = Math.atan2(dashDir.x, dashDir.z)

        this.aoeManager.spawn({
          id: 'cc-dash-4',
          shape: 'line',
          position: dashCenter,
          length: dashLength,
          width: 8,
          rotation: dashRotation,
          telegraphDuration: 0.5,
        })

        // Start boss dash animation (very fast: 0.25s)
        this.bossManager.startDash(
          'cruiseChaser',
          player4Pos,
          dashEndPos,
          0.25,
          () => {
            this.bossManager.hide('cruiseChaser')
          }
        )

        // Players 1, 2, 5, 6, 7, 8 move
        this.setPartyMemberTarget(1, -17, 0)
        this.setPartyMemberTarget(2, 17, 0)
        this.setPartyMemberTarget(5, -12, -12)
        this.setPartyMemberTarget(6, 12, -12)
        this.setPartyMemberTarget(7, -13, 0)
        this.setPartyMemberTarget(8, 13, 0)
      },
    })

    // ==================== t=24: AP plus fires, CC teleport behind #5 ====================
    this.timeline.addEvent({
      id: 'ap-plus-fire-cc-5',
      time: 24.0,
      handler: () => {
        // AP plus already resolves via telegraphDuration

        // CC teleports to #5 and fires cone
        this.spawnCruiseChaserCone(5, 'cc-cone-5')
      },
    })

    // ==================== t=25: Second puddle soak check + movement ====================
    this.timeline.addEvent({
      id: 'puddle-check-2',
      time: 25.0,
      handler: () => {
        const positions = this.getAllPartyPositions()
        this.aoeManager.checkPuddleSoak('puddle-west', positions)
        this.aoeManager.checkPuddleSoak('puddle-east', positions)
        // Failure disabled for now

        // Players 3 & 4 move to puddle positions
        this.setPartyMemberTarget(3, -17, 0)
        this.setPartyMemberTarget(4, 17, 0)
      },
    })

    // ==================== t=26: Puddles respawn at 42% radius, CC dash to #6, movement ====================
    this.timeline.addEvent({
      id: 'puddle-respawn-2',
      time: 26.0,
      handler: () => {
        // Respawn puddles at ~42% radius (shrink by 35% again)
        this.aoeManager.respawnPuddle('puddle-west', puddleRadius * 0.65 * 0.65, 999)
        this.aoeManager.respawnPuddle('puddle-east', puddleRadius * 0.65 * 0.65, 999)

        // CC dashes to #6 (line AoE + boss movement)
        const ccPos = this.bossManager.getPosition('cruiseChaser')!
        const player6Pos = this.getEntityPosition(6)!
        const dashDir = player6Pos.clone().sub(ccPos).normalize()
        // Extend dash through target and outside arena
        const dashEndPos = ccPos.clone().add(dashDir.multiplyScalar(ARENA_RADIUS * 2.5))
        const dashLength = ccPos.distanceTo(dashEndPos)
        const dashCenter = ccPos.clone().add(dashEndPos).multiplyScalar(0.5)
        const dashRotation = Math.atan2(dashDir.x, dashDir.z)

        this.aoeManager.spawn({
          id: 'cc-dash-6',
          shape: 'line',
          position: dashCenter,
          length: dashLength,
          width: 8,
          rotation: dashRotation,
          telegraphDuration: 0.5,
        })

        // Start boss dash animation (very fast: 0.25s)
        this.bossManager.startDash(
          'cruiseChaser',
          player6Pos,
          dashEndPos,
          0.25,
          () => {
            this.bossManager.hide('cruiseChaser')
          }
        )

        // Players 1, 2, 7, 8 move to final positions
        this.setPartyMemberTarget(1, -10.4, -4.1)
        this.setPartyMemberTarget(2, 10.4, 4.1)
        this.setPartyMemberTarget(7, -12, 12)
        this.setPartyMemberTarget(8, 12, 12)
      },
    })

    // ==================== t=28: CC teleport behind #7 ====================
    this.timeline.addEvent({
      id: 'cc-cone-7',
      time: 28.0,
      handler: () => {
        // CC teleports to #7 and fires cone
        this.spawnCruiseChaserCone(7, 'cc-cone-7')
      },
    })

    // ==================== t=29: Final puddle soak check ====================
    this.timeline.addEvent({
      id: 'puddle-check-3',
      time: 29.0,
      handler: () => {
        const positions = this.getAllPartyPositions()
        this.aoeManager.checkPuddleSoak('puddle-west', positions)
        this.aoeManager.checkPuddleSoak('puddle-east', positions)
        // Failure disabled for now

        // Remove puddles after final check
        this.aoeManager.remove('puddle-west')
        this.aoeManager.remove('puddle-east')
      },
    })

    // ==================== t=30: CC dash to #8, success ====================
    this.timeline.addEvent({
      id: 'cc-dash-8-success',
      time: 30.0,
      handler: () => {
        // CC dashes to #8 (line AoE + boss movement)
        const ccPos = this.bossManager.getPosition('cruiseChaser')!
        const player8Pos = this.getEntityPosition(8)!
        const dashDir = player8Pos.clone().sub(ccPos).normalize()
        // Extend dash through target and outside arena
        const dashEndPos = ccPos.clone().add(dashDir.multiplyScalar(ARENA_RADIUS * 2.5))
        const dashLength = ccPos.distanceTo(dashEndPos)
        const dashCenter = ccPos.clone().add(dashEndPos).multiplyScalar(0.5)
        const dashRotation = Math.atan2(dashDir.x, dashDir.z)

        this.aoeManager.spawn({
          id: 'cc-dash-8',
          shape: 'line',
          position: dashCenter,
          length: dashLength,
          width: 8,
          rotation: dashRotation,
          telegraphDuration: 0.5,
        })

        // Start boss dash animation (very fast: 0.25s)
        this.bossManager.startDash(
          'cruiseChaser',
          player8Pos,
          dashEndPos,
          0.25,
          () => {
            // Hide all bosses
            this.bossManager.hide('cruiseChaser')
            this.bossManager.hide('bruteJustice')
            this.bossManager.hide('alexanderPrime')
          }
        )
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
    // Ability hotkeys (only while playing)
    if (this.gameState === 'playing') {
      if (event.key === '1') {
        this.abilitySystem.use('arms-length')
      }
      if (event.key === '2') {
        this.abilitySystem.use('sprint')
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

    // Reset ability cooldowns and clear player buffs/debuffs
    this.abilitySystem.reset()
    this.buffManager.clearEntity('player')

    // Re-setup timeline (don't start yet - will assign new random number)
    this.setupTestTimeline()

    // Show start prompt
    this.startPrompt.show()
  }

  /**
   * Trigger failure state when player is hit by an AoE.
   * Currently unused - damage doesn't end encounter for now.
   */
  // @ts-ignore: Intentionally unused - will be connected when failure logic is enabled
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
    // Update ability cooldowns and buff durations
    this.abilitySystem.update(deltaTime)
    this.buffManager.update(deltaTime)

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
    this.aoeManager.update(deltaTime, this.playerMesh.position)
    // Damage doesn't end encounter for now

    // Update chakrams and check for hits
    this.chakramManager.update(deltaTime, this.playerMesh.position)
    // Damage doesn't end encounter for now

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

    // Update hotbar and buff display
    this.hotbar.update()
    this.buffDisplay.update()
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
    this.abilitySystem.dispose()
    this.buffManager.dispose()
    this.hotbar.dispose()
    this.buffDisplay.dispose()
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
