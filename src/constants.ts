// Arena dimensions (1 yalm ≈ 0.9144 meters)
export const ARENA_RADIUS = 18.3 // 20 yalms in meters

// Player settings
export const PLAYER_SPEED = 5.0 // meters per second (base walking speed)
export const PLAYER_HEIGHT = 1.8 // meters
export const PLAYER_RADIUS = 0.4 // meters

// Camera settings
export const CAMERA_MIN_ZOOM = 3
export const CAMERA_MAX_ZOOM = 30
export const CAMERA_DEFAULT_ZOOM = 15
export const CAMERA_MIN_PITCH = -45 * (Math.PI / 180) // radians (max 45° upward)
export const CAMERA_MAX_PITCH = 90 * (Math.PI / 180) // radians (perfect top-down view)
export const CAMERA_FLOOR_HEIGHT = 0.1 // meters above ground to prevent clipping

// NPC settings
export const NPC_COUNT = 7
export const NPC_WANDER_RADIUS = 3 // meters from home position
