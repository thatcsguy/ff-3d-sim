import * as THREE from 'three'
import { PLAYER_HEIGHT, ARENA_RADIUS } from './constants'
import { InputManager } from './InputManager'
import { CameraController } from './CameraController'
import { PlayerController } from './PlayerController'
import { Arena } from './Arena'
import { NPCManager } from './NPCManager'
import { HUD } from './HUD'
import { SettingsMenu } from './SettingsMenu'
import { Timeline } from './Timeline'
import { AoEManager, EntityPosition } from './AoEManager'
import { BossManager } from './BossManager'
import { NumberSpriteManager } from './NumberSpriteManager'
import { ResultOverlay } from './ResultOverlay'
import { StartPrompt } from './StartPrompt'
import { ChakramManager } from './ChakramManager'
import { BuffManager, StatusEffectConfig } from './BuffManager'
import { AbilitySystem } from './AbilitySystem'
import { Hotbar } from './Hotbar'
import { BuffDisplay } from './BuffDisplay'
import { HumanoidMesh } from './HumanoidMesh'
import { NumberPicker } from './NumberPicker'

type GameState = 'waiting' | 'playing' | 'failed' | 'clear'

/**
 * Debuff configurations for damage taken
 */
const DEBUFFS = {
  MAGIC_VULN: {
    id: 'magic-vuln',
    name: 'Magic Vulnerability Up',
    type: 'debuff',
    duration: 10,
    iconUrl: 'icons/magic-vuln.png',
  } as StatusEffectConfig,
  PHYSICAL_VULN: {
    id: 'physical-vuln',
    name: 'Physical Vulnerability Up',
    type: 'debuff',
    duration: 17,
    iconUrl: 'icons/physical-vuln.png',
  } as StatusEffectConfig,
  VULN_UP: {
    id: 'vuln-up',
    name: 'Vulnerability Up',
    type: 'debuff',
    duration: 3,
    iconUrl: 'icons/vuln-up.png',
  } as StatusEffectConfig,
}

export class Game {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private playerHumanoid: HumanoidMesh
  private playerGroup: THREE.Group
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
  // Forced player number (null = random, 1-8 = specific number)
  private forcedPlayerNumber: number | null = null
  private numberPicker!: NumberPicker

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

    // Player humanoid (blue)
    this.playerHumanoid = new HumanoidMesh(0x0984e3)
    this.playerGroup = this.playerHumanoid.group
    this.playerGroup.position.set(0, 0, 0)
    this.scene.add(this.playerGroup)

    // Buff and ability system setup
    this.buffManager = new BuffManager()
    this.abilitySystem = new AbilitySystem(this.buffManager, 'player')
    this.hotbar = new Hotbar(this.abilitySystem)
    this.buffDisplay = new BuffDisplay(this.buffManager, 'player')

    // Player controller setup (must be after player humanoid is created)
    this.playerController = new PlayerController(this.playerHumanoid, this.inputManager, this.buffManager)

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

    // Number picker setup (stored for lifecycle management)
    this.numberPicker = new NumberPicker((num) => this.onNumberSelect(num))
    void this.numberPicker

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
    const y = 0 // Position at feet level

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
   * @param partyNum Party number (1-8)
   * @param x X coordinate
   * @param z Z coordinate
   * @param jitter Whether to add +/- 0.5 randomization (default: true, but false for corner positions)
   */
  private setPartyMemberTarget(partyNum: number, x: number, z: number, jitter: boolean = true): void {
    if (partyNum === this.playerNumber) {
      // Player must move themselves, we don't control them
      return
    }

    // Apply randomization if jitter is enabled and not a corner position
    let finalX = x
    let finalZ = z
    if (jitter && !this.isCornerPosition(x, z)) {
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
          new THREE.Vector3(finalX, 0, finalZ)
        )
        return
      }
      npcIndex++
    }
  }

  /**
   * Get the group for a party member by their assigned number (1-8).
   * Returns player group if partyNum matches playerNumber, otherwise returns NPC group.
   */
  private getEntityByNumber(partyNum: number): THREE.Object3D | null {
    if (partyNum === this.playerNumber) {
      return this.playerGroup
    }
    // NPCs fill slots not taken by player
    let npcIndex = 0
    for (let num = 1; num <= 8; num++) {
      if (num === this.playerNumber) continue
      if (num === partyNum) {
        const groups = this.npcManager.getGroups()
        return npcIndex < groups.length ? groups[npcIndex] : null
      }
      npcIndex++
    }
    return null
  }

  /**
   * Get the position of a party member by their assigned number (1-8).
   */
  private getEntityPosition(partyNum: number): THREE.Vector3 | null {
    const entity = this.getEntityByNumber(partyNum)
    return entity ? entity.position.clone() : null
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
   * Get entity ID string for a party number.
   */
  private getEntityId(partyNum: number): string {
    return `party-${partyNum}`
  }

  /**
   * Get all party members as EntityPosition array for collision detection.
   * Player is always first in the array.
   */
  private getAllPartyEntities(): EntityPosition[] {
    const entities: EntityPosition[] = []
    // Add player first (for visual feedback in puddles etc)
    entities.push({
      id: this.getEntityId(this.playerNumber),
      position: this.playerGroup.position.clone(),
    })
    // Add NPCs
    for (let partyNum = 1; partyNum <= 8; partyNum++) {
      if (partyNum === this.playerNumber) continue
      const pos = this.getEntityPosition(partyNum)
      if (pos) {
        entities.push({
          id: this.getEntityId(partyNum),
          position: pos,
        })
      }
    }
    return entities
  }

  /**
   * Spawn Cruise Chaser cone attack on an odd-numbered player.
   * - If target is NPC: CC spawns between NPC and arena center, cone fires outward
   * - If target is player: CC spawns behind player (opposite mesh facing), cone fires in facing direction
   */
  private spawnCruiseChaserCone(targetPlayerNum: number, coneId: string): void {
    const targetPos = this.getEntityPosition(targetPlayerNum)!
    const CC_OFFSET = 1 // How far CC spawns from the target

    let ccPosition: THREE.Vector3
    let coneRotation: number

    if (targetPlayerNum === this.playerNumber) {
      // Target is the human player - use mesh facing direction
      const playerRotation = this.playerHumanoid.getRotation()
      const forwardDir = new THREE.Vector3(
        Math.sin(playerRotation),
        0,
        Math.cos(playerRotation)
      )
      // CC spawns behind player (opposite of facing)
      ccPosition = targetPos.clone().sub(forwardDir.clone().multiplyScalar(CC_OFFSET))
      // Cone fires in the direction the player is facing
      coneRotation = playerRotation
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
      radius: ARENA_RADIUS * 2, // Diameter of arena
      angle: Math.PI / 2, // 90°
      rotation: coneRotation,
      telegraphDuration: 0.5,
    })
  }

  /**
   * Setup the Wormhole Formation timeline matching accurate FFXIV mechanic.
   */
  private setupTestTimeline(): void {
    // Assign player number (forced or random)
    if (this.forcedPlayerNumber !== null) {
      this.playerNumber = this.forcedPlayerNumber
    } else {
      this.playerNumber = Math.floor(Math.random() * 8) + 1
    }

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
        // Match CC dash speed: ~45.75 units in 0.25s = 183 units/sec
        // Chakrams travel 2 * ARENA_RADIUS = 36.6 units, so 0.2s
        const travelTime = 0.2
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
          this.playerGroup,
          this.playerNumber
        )
        // Assign NPCs the remaining numbers
        const npcs = this.npcManager.getGroups()
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

        // Line AoEs for chakram paths (like CC dashes)
        // East chakram travels along X axis (rotation = π/2 from +Z)
        this.aoeManager.spawn({
          id: 'chakram-east-line',
          shape: 'line',
          position: new THREE.Vector3(0, 0, 0),
          length: ARENA_RADIUS * 2,
          width: 5,
          rotation: Math.PI / 2,
          telegraphDuration: 0.2,
        })

        // South chakram travels along Z axis (rotation = 0)
        this.aoeManager.spawn({
          id: 'chakram-south-line',
          shape: 'line',
          position: new THREE.Vector3(0, 0, 0),
          length: ARENA_RADIUS * 2,
          width: 5,
          rotation: 0,
          telegraphDuration: 0.2,
        })
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

        // Players 3 & 4 nudge slightly to dodge BJ cone (no jitter - precise positioning)
        this.setPartyMemberTarget(3, -12.1, 12.1, false)
        this.setPartyMemberTarget(4, 12.1, 12.1, false)
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
            radius: 23.5,
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
        if (!this.checkPuddlesSoaked(positions)) return
        this.checkPuddleDebuffs()
      },
    })

    // ==================== t=22: Puddles respawn at 65% radius, CC dash to #4, movement ====================
    this.timeline.addEvent({
      id: 'puddle-respawn-1',
      time: 22.0,
      handler: () => {
        // Respawn puddles at 65% radius (shrink by 35%)
        this.aoeManager.respawnPuddle('puddle-west', 6, 999)
        this.aoeManager.respawnPuddle('puddle-east', 6, 999)

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
        if (!this.checkPuddlesSoaked(positions)) return
        this.checkPuddleDebuffs()

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
        this.aoeManager.respawnPuddle('puddle-west', 3, 999)
        this.aoeManager.respawnPuddle('puddle-east', 3, 999)

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
        if (!this.checkPuddlesSoaked(positions)) return
        this.checkPuddleDebuffs()

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
    // R key: start when waiting, restart when failed/clear
    if (event.key === 'r' || event.key === 'R') {
      if (this.gameState === 'waiting') {
        this.startMechanic()
      } else if (this.gameState === 'failed' || this.gameState === 'clear') {
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
   * Handle gamepad button inputs for abilities and start/restart.
   * Button 0 (A/X): Start/Restart
   * Button 1 (B/Circle): Sprint
   * Button 2 (X/Square): Arms Length
   */
  private handleGamepadInput(): void {
    // Button 0 (A/X): Start or Restart
    if (this.inputManager.isButtonJustPressed(0)) {
      if (this.gameState === 'waiting') {
        this.startMechanic()
      } else if (this.gameState === 'failed' || this.gameState === 'clear') {
        this.restart()
      }
    }

    // Ability buttons only while playing
    if (this.gameState === 'playing') {
      // Button 2 (X/Square): Arms Length
      if (this.inputManager.isButtonJustPressed(2)) {
        this.abilitySystem.use('arms-length')
      }
      // Button 1 (B/Circle): Sprint
      if (this.inputManager.isButtonJustPressed(1)) {
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
   * Handle number picker selection.
   * Sets the forced player number and restarts the encounter.
   */
  private onNumberSelect(num: number | null): void {
    this.forcedPlayerNumber = num
    this.restart()
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
    this.playerGroup.position.set(0, 0, 0)

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
   * Apply debuffs when an entity is hit by AoEs.
   * Checks for lethal failure conditions before applying debuffs.
   * @param entityId The entity ID (e.g., "party-1")
   * @param partyNum The party number (1-8)
   * @param hitIds Array of AoE IDs that hit this entity
   */
  private applyAoEDebuffsToEntity(entityId: string, partyNum: number, hitIds: string[]): void {
    const isPlayer = partyNum === this.playerNumber

    for (const id of hitIds) {
      // Brute Justice cone is always lethal
      if (id.startsWith('bj-cone')) {
        const who = isPlayer ? 'You were' : `Party member ${partyNum} was`
        this.triggerFailure(`${who} hit by Brute Justice's Double Rocket Punch. This attack cannot be survived.`)
        return
      }

      // Alexander Prime plus is always lethal
      if (id === 'ap-plus') {
        const who = isPlayer ? 'You were' : `Party member ${partyNum} was`
        this.triggerFailure(`${who} hit by Alexander Prime's Sacrament. This attack cannot be survived.`)
        return
      }

      // Cruise Chaser attacks have conditional lethality
      if (id.startsWith('cc-')) {
        // Player uses 'player' entity ID for buffs, NPCs use party-N
        const buffEntityId = isPlayer ? 'player' : entityId
        const hasPhysVuln = this.buffManager.has(buffEntityId, 'physical-vuln')

        if (hasPhysVuln) {
          const who = isPlayer ? 'You were' : `Party member ${partyNum} was`
          this.triggerFailure(`${who} hit by Cruise Chaser while Physical Vulnerability was active. The second hit is lethal.`)
          return
        }

        // NPCs don't need Arm's Length (assume always active)
        // Player needs Arm's Length to survive knockback
        if (isPlayer) {
          const hasArmsLength = this.buffManager.has('player', 'arms-length')
          if (!hasArmsLength) {
            this.triggerFailure("Hit by Cruise Chaser without Arm's Length active. Use Arm's Length to survive the knockback.")
            return
          }
        }

        // Survived - apply debuffs
        this.buffManager.apply(buffEntityId, DEBUFFS.MAGIC_VULN)
        this.buffManager.apply(buffEntityId, DEBUFFS.PHYSICAL_VULN)
      }
    }
  }

  /**
   * Process AoE hits for all entities.
   */
  private processAoEHits(allHits: Map<string, string[]>): void {
    // Build reverse map: AoE ID -> list of entities hit
    const aoeToEntities = new Map<string, string[]>()
    for (const [entityId, hitIds] of allHits) {
      for (const aoeId of hitIds) {
        if (!aoeToEntities.has(aoeId)) {
          aoeToEntities.set(aoeId, [])
        }
        aoeToEntities.get(aoeId)!.push(entityId)
      }
    }

    // Check if any CC ability hit multiple entities
    for (const [aoeId, entities] of aoeToEntities) {
      if (aoeId.startsWith('cc-') && entities.length > 1) {
        const partyNums = entities.map(e => parseInt(e.split('-')[1]))
        const isPlayerHit = partyNums.includes(this.playerNumber)
        const who = isPlayerHit
          ? `You and ${entities.length - 1} other party member(s) were`
          : `${entities.length} party members were`
        this.triggerFailure(`${who} hit by the same Cruise Chaser attack. Only one person should be hit.`)
        return
      }
    }

    // Process individual hits
    for (const [entityId, hitIds] of allHits) {
      const partyNum = parseInt(entityId.split('-')[1])
      this.applyAoEDebuffsToEntity(entityId, partyNum, hitIds)
    }
  }

  /**
   * Process chakram hits for all entities - being hit by a chakram is lethal.
   */
  private processChakramHits(allHits: Map<string, string[]>): void {
    for (const [entityId, hitIds] of allHits) {
      if (hitIds.length > 0) {
        const partyNum = parseInt(entityId.split('-')[1])
        const isPlayer = partyNum === this.playerNumber
        const who = isPlayer ? 'You were' : `Party member ${partyNum} was`
        this.triggerFailure(`${who} hit by Super Chakram. This attack cannot be survived.`)
        return
      }
    }
  }

  /**
   * Check that both puddles are soaked. Triggers failure if either puddle has no one inside.
   * @returns true if both puddles were soaked, false if failure was triggered
   */
  private checkPuddlesSoaked(positions: THREE.Vector3[]): boolean {
    const westSoaked = this.aoeManager.checkPuddleSoak('puddle-west', positions)
    const eastSoaked = this.aoeManager.checkPuddleSoak('puddle-east', positions)

    if (!westSoaked) {
      this.triggerFailure('West puddle was not soaked. Each puddle requires one person inside when it triggers.')
      return false
    }
    if (!eastSoaked) {
      this.triggerFailure('East puddle was not soaked. Each puddle requires one person inside when it triggers.')
      return false
    }
    return true
  }

  /**
   * Check all party members inside puddles at soak time and apply debuffs.
   * Applies Magic Vuln (10s) + Vulnerability Up (3s) if in puddle.
   * If entity already has Magic Vulnerability, being in a puddle is lethal.
   */
  private checkPuddleDebuffs(): void {
    for (let partyNum = 1; partyNum <= 8; partyNum++) {
      const pos = this.getEntityPosition(partyNum)
      if (!pos) continue

      const isPlayer = partyNum === this.playerNumber
      // Player uses 'player' entity ID for buffs, NPCs use party-N
      const buffEntityId = isPlayer ? 'player' : this.getEntityId(partyNum)
      const posArray = [pos]
      const inWest = this.aoeManager.checkPuddleSoak('puddle-west', posArray)
      const inEast = this.aoeManager.checkPuddleSoak('puddle-east', posArray)

      if (inWest || inEast) {
        const hasMagicVuln = this.buffManager.has(buffEntityId, 'magic-vuln')
        if (hasMagicVuln) {
          const who = isPlayer ? 'You were' : `Party member ${partyNum} was`
          this.triggerFailure(`${who} caught in puddle explosion while Magic Vulnerability was active. Only soak one puddle per set.`)
          return
        }
        this.buffManager.apply(buffEntityId, DEBUFFS.MAGIC_VULN)
        this.buffManager.apply(buffEntityId, DEBUFFS.VULN_UP)
      }
    }
  }

  /**
   * Trigger failure state when player is hit by a lethal mechanic.
   * @param reason Explanation of why the player failed
   */
  private triggerFailure(reason: string): void {
    if (this.gameState !== 'playing') return
    this.gameState = 'failed'
    this.timeline.stop()
    this.resultOverlay.show('failed', reason)
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
    // Check gamepad inputs first, then update state for next frame
    this.handleGamepadInput()
    this.inputManager.updateGamepadState()

    // Update ability cooldowns and buff durations
    this.abilitySystem.update(deltaTime)
    this.buffManager.update(deltaTime)

    // Update player movement
    this.playerController.update(deltaTime, this.cameraController)

    // Clamp player to arena boundary
    this.arena.clampToArena(this.playerGroup.position)

    // Update NPCs
    this.npcManager.update(deltaTime)

    // Update timeline
    this.timeline.update(deltaTime)

    // Update bosses
    this.bossManager.update(deltaTime)

    // Update number sprites (follow their entities)
    this.numberSpriteManager.update()

    // Update AoEs and check for hits on all party members
    const entities = this.getAllPartyEntities()
    const aoeHits = this.aoeManager.update(deltaTime, entities)
    this.processAoEHits(aoeHits)

    // Update chakrams and check for hits on all party members
    const chakramHits = this.chakramManager.update(deltaTime, entities)
    this.processChakramHits(chakramHits)

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
    // playerGroup.position.y is at feet level
    const playerPosition = this.playerGroup.position.clone()
    playerPosition.y = this.playerGroup.position.y + PLAYER_HEIGHT * 0.75
    this.cameraController.update(deltaTime, playerPosition)

    // Update HUD
    this.hud.update(this.playerGroup.position)

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

    // Dispose player humanoid resources
    this.playerHumanoid.dispose()

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
