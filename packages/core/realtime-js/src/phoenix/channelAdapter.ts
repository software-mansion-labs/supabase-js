import { Channel } from 'phoenix'
import { CHANNEL_STATES, ChannelState } from '../lib/constants'
import type { RealtimeChannelOptions } from '../RealtimeChannel'
import SocketAdapter from './socketAdapter'
import type { Push, BindingCallback } from './types'

export default class ChannelAdapter {
  private channel: Channel
  private socket: SocketAdapter

  constructor(socket: SocketAdapter, topic: string, params: RealtimeChannelOptions) {
    const phoenixParams = phoenixChannelParams(params)
    this.channel = socket.getSocket().channel(topic, phoenixParams)
    this.socket = socket
  }

  get state() {
    return this.channel.state as ChannelState
  }

  set state(state) {
    this.channel.state = state
  }

  get joinedOnce() {
    return this.channel.joinedOnce
  }

  set joinedOnce(joinedOnce) {
    this.channel.joinedOnce = joinedOnce
  }

  get joinPush() {
    return this.channel.joinPush
  }

  get rejoinTimer() {
    return this.channel.rejoinTimer
  }

  on(event: string, callback: BindingCallback) {
    return this.channel.on(event, callback)
  }

  off(event: string, refNumber?: number) {
    this.channel.off(event, refNumber)
  }

  trigger(type: string, payload: object, ref?: number) {
    this.channel.trigger(type, payload, ref, this.joinRef())
  }

  subscribe(timeout?: number) {
    return this.channel.join(timeout)
  }

  unsubscribe(timeout?: number) {
    return this.channel.leave(timeout)
  }

  send(event: string, payload: object, timeout?: number) {
    this.channel.push(event, payload, timeout)
  }

  push(event: string, payload: { [key: string]: any }, timeout?: number) {
    try {
      return this.channel.push(event, payload, timeout)
    } catch (error) {
      throw `tried to push '${event}' to '${this.channel.topic}' before joining. Use channel.subscribe() before pushing events`
    }
  }

  canSend() {
    return this.socket.isConnected() && this.state === CHANNEL_STATES.joined
  }

  joinRef(): number {
    if (!this.channel.joinPush.ref) {
      throw new Error('Join push reference not found')
    }

    return this.channel.joinPush.ref
  }

  updateFilterMessage(
    filterMessage: (
      event: string,
      payload: object,
      ref: number | undefined,
      bind: { event: string; ref: number }
    ) => boolean
  ) {
    this.channel.filterMessage = filterMessage
  }

  updatePayloadTransform(callback: (event: string, payload: unknown, ref: number) => unknown) {
    this.channel.onMessage = callback
  }

  /**
   * @internal
   */
  getChannel(): Channel {
    return this.channel
  }
}

function phoenixChannelParams(options: RealtimeChannelOptions): Record<string, unknown> {
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
