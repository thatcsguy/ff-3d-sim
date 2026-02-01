/**
 * Timeline system for scheduling and executing mechanic events.
 * Events are defined with timestamps and handlers that fire when the timeline reaches that time.
 */

export interface TimelineEvent {
  time: number // seconds from timeline start
  id: string // unique identifier for this event
  handler: () => void // callback to execute
}

export class Timeline {
  private events: TimelineEvent[] = []
  private currentTime: number = 0
  private isRunning: boolean = false
  private executedEvents: Set<string> = new Set()

  /**
   * Add an event to the timeline.
   * Events are automatically sorted by time when the timeline starts.
   */
  addEvent(event: TimelineEvent): void {
    this.events.push(event)
  }

  /**
   * Add multiple events at once.
   */
  addEvents(events: TimelineEvent[]): void {
    this.events.push(...events)
  }

  /**
   * Start the timeline from the beginning.
   */
  start(): void {
    this.currentTime = 0
    this.isRunning = true
    this.executedEvents.clear()
    // Sort events by time
    this.events.sort((a, b) => a.time - b.time)
  }

  /**
   * Stop the timeline.
   */
  stop(): void {
    this.isRunning = false
  }

  /**
   * Reset the timeline to initial state.
   */
  reset(): void {
    this.currentTime = 0
    this.isRunning = false
    this.executedEvents.clear()
  }

  /**
   * Update the timeline, executing any events that have been reached.
   * @param deltaTime Time elapsed since last update in seconds
   */
  update(deltaTime: number): void {
    if (!this.isRunning) return

    this.currentTime += deltaTime

    // Execute all events whose time has been reached
    for (const event of this.events) {
      if (event.time <= this.currentTime && !this.executedEvents.has(event.id)) {
        this.executedEvents.add(event.id)
        event.handler()
      }
    }
  }

  /**
   * Check if the timeline is currently running.
   */
  getIsRunning(): boolean {
    return this.isRunning
  }

  /**
   * Get the current timeline time in seconds.
   */
  getCurrentTime(): number {
    return this.currentTime
  }

  /**
   * Clear all events from the timeline.
   */
  clearEvents(): void {
    this.events = []
    this.executedEvents.clear()
  }
}
