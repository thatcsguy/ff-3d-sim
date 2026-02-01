// Arena dimensions (1 yalm ≈ 0.9144 meters)
export const ARENA_RADIUS = 18.3 // 20 yalms in meters

// Player settings
export const PLAYER_SPEED = 6.5 // meters per second (FFXIV sprint speed)
export const PLAYER_HEIGHT = 1.8 // meters
export const PLAYER_RADIUS = 0.4 // meters

// Camera settings
export const CAMERA_MIN_ZOOM = 3
export const CAMERA_MAX_ZOOM = 30
export const CAMERA_DEFAULT_ZOOM = 15
export const CAMERA_MIN_PITCH = -80 * (Math.PI / 180) // radians
export const CAMERA_MAX_PITCH = 90 * (Math.PI / 180) // radians (perfect top-down view)

// NPC settings
export const NPC_COUNT = 7
export const NPC_WANDER_RADIUS = 3 // meters from home position
