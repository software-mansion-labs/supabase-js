export type {
  Socket,
  Channel,
  Message,
  Params,
  PresenceState,
  SocketOptions,
  ChannelBindingCallback,
  SocketOnOpen,
  SocketOnError,
  SocketOnMessage,
  SocketOnClose,
  SocketState,
  ChannelState,
  ChannelEvent,
  Transport,
} from 'phoenix'

import type { Channel, PresenceState } from 'phoenix'

export type Push = ReturnType<Channel['push']>
export type PresenceStates = Record<string, PresenceState>

// TODO: Maybe it should be exported in `phoenix`
export type ChanelOnErrorCallback = (reason: any) => void
