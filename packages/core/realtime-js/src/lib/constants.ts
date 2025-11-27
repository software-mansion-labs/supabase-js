import { version } from './version'
import * as PhoenixConstants from 'phoenix/priv/static/constants'

export const DEFAULT_VERSION = `realtime-js/${version}`

export const VSN_1_0_0: string = '1.0.0'
export const VSN_2_0_0: string = '2.0.0'
export const DEFAULT_VSN: string = VSN_1_0_0

export const VERSION = version

export const DEFAULT_TIMEOUT = 10000

export const WS_CLOSE_NORMAL = 1000
export const MAX_PUSH_BUFFER_SIZE = 100

export const SOCKET_STATES = PhoenixConstants.SOCKET_STATES
export type SocketState = PhoenixConstants.SocketState

export const CHANNEL_STATES = PhoenixConstants.CHANNEL_STATES
export type ChannelState = PhoenixConstants.ChannelState

export const CHANNEL_EVENTS = {
  ...PhoenixConstants.CHANNEL_EVENTS,
  access_token: 'access_token',
} as const
export type ChannelEvent = PhoenixConstants.ChannelEvent | 'access_token'

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
