import { version } from './version'
import * as Phoenix from 'phoenix'

export const DEFAULT_VERSION = `realtime-js/${version}`

export const VSN_1_0_0: string = '1.0.0'
export const VSN_2_0_0: string = '2.0.0'
export const DEFAULT_VSN: string = VSN_1_0_0

export const VERSION = version

export const DEFAULT_TIMEOUT = 10000

export const WS_CLOSE_NORMAL = 1000
export const MAX_PUSH_BUFFER_SIZE = 100

export const SOCKET_STATES = Phoenix.SOCKET_STATES
export type SocketState = Phoenix.SocketState

export const CHANNEL_STATES = Phoenix.CHANNEL_STATES
export type ChannelState = Phoenix.ChannelState

export const CHANNEL_EVENTS = {
  ...Phoenix.CHANNEL_EVENTS,
  access_token: 'access_token',
} as const
export type ChannelEvent = Phoenix.ChannelEvent | 'access_token'

// TODO: Look at this after checking Longpoll transport
export enum TRANSPORTS {
  websocket = 'websocket',
}

export enum CONNECTION_STATE {
  Connecting = 'connecting',
  Open = 'open',
  Closing = 'closing',
  Closed = 'closed',
}
