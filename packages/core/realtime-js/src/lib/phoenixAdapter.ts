import { Channel, Socket, Presence } from 'phoenix'
import type { BindingCallback } from 'phoenix/priv/static/channel'
import type { OnJoin, OnLeave, Events, OnSync, State } from 'phoenix/priv/static/presence'
import Push from 'phoenix/priv/static/push'

import { CONNECTION_STATE, CHANNEL_STATES, ChannelState } from './constants'
import type { RealtimeChannelOptions } from '../RealtimeChannel'
import type { RealtimeClientOptions } from '../RealtimeClient'
import type {
  RealtimePresenceOptions,
  RealtimePresenceState,
  Presence as RealtimePresenceType,
} from '../RealtimePresence'

export class SocketAdapter {
  private socket: Socket

  constructor(endPoint: string, options: RealtimeClientOptions) {
    const phoenixOptions = phoenixSocketOptions(options)
    this.socket = new Socket(endPoint, phoenixOptions)
  }

  get timeout(): number {
    return this.socket.timeout
  }
  set timeout(timeout: number) {
    this.socket.timeout = timeout
  }

  connect(): void {
    //@ts-ignore - params should be Object | undefined
    this.socket.connect()
  }

  disconnect(code: number | undefined, reason: string | undefined): void {
    //@ts-ignore - code and reason should be undefinable
    this.socket.disconnect(() => {}, code, reason)
  }

  push(data: Object): void {
    this.socket.push(data)
  }

  log(kind: string, msg: string, data?: any): void {
    this.socket.log(kind, msg, data)
  }

  makeRef(): string {
    return this.socket.makeRef()
  }

  onOpen(callback: Function): void {
    this.socket.onOpen(callback)
  }

  onClose(callback: Function): void {
    this.socket.onClose(callback)
  }

  onError(callback: Function): void {
    this.socket.onError(callback)
  }

  onMessage(callback: Function): void {
    this.socket.onMessage(callback)
  }

  isConnected(): boolean {
    return this.socket.isConnected()
  }

  connectionState(): CONNECTION_STATE {
    return this.socket.connectionState() as CONNECTION_STATE
  }

  endPointURL(): string {
    return this.socket.endPointURL()
  }

  /**
   * @private
   */
  getSocket(): Socket {
    return this.socket
  }
}

function phoenixSocketOptions(options: RealtimeClientOptions): Object {
  return {
    transport: options.transport,
    encode: options.encode,
    decode: options.decode,
    timeout: options.timeout,
    heartbeatIntervalMs: options.heartbeatIntervalMs,
    reconnectAfterMs: options.reconnectAfterMs,
    logger: options.logger,
    params: options.params,
    vsn: options.vsn,
  }
}

export class ChannelAdapter {
  private channel: Channel
  private socket: SocketAdapter

  constructor(socket: SocketAdapter, topic: string, params: RealtimeChannelOptions) {
    const phoenixParams = phoenixChannelParams(params)
    this.channel = socket.getSocket().channel(topic, phoenixParams)
    this.socket = socket
  }

  get state(): ChannelState {
    return this.channel.state as ChannelState
  }

  set state(state: ChannelState) {
    this.channel.state = state
  }

  on(event: string, callback: BindingCallback): number {
    return this.channel.on(event, callback)
  }

  off(event: string, refNumber?: number): void {
    //@ts-ignore - params should be Object | undefined
    this.channel.off(event, refNumber)
  }

  trigger(type: string, payload: object, ref?: string): void {
    //@ts-ignore - trigger and joinRef will be public
    this.channel.trigger(type, payload, ref, this.channel.joinRef())
  }

  subscribe(timeout?: number | undefined): Push {
    return this.channel.join(timeout)
  }

  unsubscribe(timeout?: number | undefined): Push {
    return this.channel.leave(timeout)
  }

  send(event: string, payload: object, timeout?: number | undefined): void {
    this.channel.push(event, payload, timeout)
  }

  push(event: string, payload: { [key: string]: any }, timeout?: number | undefined): Push {
    try {
      return this.channel.push(event, payload, timeout)
    } catch (error) {
      throw `tried to push '${event}' to '${this.channel.topic}' before joining. Use channel.subscribe() before pushing events`
    }
  }
  canSend(): boolean {
    return this.socket.isConnected() && this.state === CHANNEL_STATES.joined
  }

  joinRef(): string {
    //@ts-ignore - joinRef will be public
    return this.channel.joinRef()
  }

  /**
   * @private
   */
  getChannel(): Channel {
    return this.channel
  }
}

function phoenixChannelParams(options: RealtimeChannelOptions): Object {
  return {
    config: {
      ...{
        broadcast: { ack: false, self: false },
        presence: { key: '', enabled: false },
        private: false,
      },
      ...options.config,
    },
  }
}

export class PresenceAdapter {
  private presence: Presence

  constructor(channel: ChannelAdapter, opts?: RealtimePresenceOptions) {
    const phoenixOptions = phoenixPresenceOptions(opts)
    this.presence = new Presence(channel.getChannel(), phoenixOptions)
  }

  get state(): RealtimePresenceState {
    return transformState(this.presence.state)
  }

  onJoin(callback: OnJoin): void {
    this.presence.onJoin(callback)
  }

  onLeave(callback: OnLeave): void {
    this.presence.onLeave(callback)
  }

  onSync(callback: OnSync): void {
    this.presence.onSync(callback)
  }

  /**
   * @private
   */
  getPresence(): Presence {
    return this.presence
  }
}

/**
 * Remove 'metas' key
 * Change 'phx_ref' to 'presence_ref'
 * Remove 'phx_ref' and 'phx_ref_prev'
 *
 * @example
 * // returns {
 *  abc123: [
 *    { presence_ref: '2', user_id: 1 },
 *    { presence_ref: '3', user_id: 2 }
 *  ]
 * }
 * RealtimePresence.transformState({
 *  abc123: {
 *    metas: [
 *      { phx_ref: '2', phx_ref_prev: '1' user_id: 1 },
 *      { phx_ref: '3', user_id: 2 }
 *    ]
 *  }
 * })
 *
 */
function transformState(state: State): RealtimePresenceState {
  state = cloneDeep(state)

  return Object.getOwnPropertyNames(state).reduce((newState, key) => {
    const presences = state[key]

    if ('metas' in presences) {
      newState[key] = presences.metas.map((presence) => {
        presence['presence_ref'] = presence['phx_ref']

        delete presence['phx_ref']
        delete presence['phx_ref_prev']

        return presence
      }) as RealtimePresenceType[]
    } else {
      newState[key] = presences
    }

    return newState
  }, {} as RealtimePresenceState)
}

function cloneDeep(obj: { [key: string]: any }) {
  return JSON.parse(JSON.stringify(obj))
}

function phoenixPresenceOptions(opts?: RealtimePresenceOptions): { events: Events } | undefined {
  if (!opts?.events) return undefined
  return { events: opts.events }
}
