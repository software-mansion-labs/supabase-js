import type {
  Channel,
  Socket,
  Message,
  OnCloseCallback,
  OnErrorCallback,
  OnMessageCallback,
  OnOpenCallback,
  OnSync,
  State,
  SocketOptions,
  BindingCallback,
} from 'phoenix'

export type Push = ReturnType<Channel['push']>

// TODO: Maybe it should be exported in `phoenix`
export type ChanelOnErrorCallback = (reason: any) => void

export type {
  Channel,
  Socket,
  Message,
  OnCloseCallback,
  OnErrorCallback,
  OnMessageCallback,
  OnOpenCallback,
  OnSync,
  State,
  SocketOptions,
  BindingCallback,
}
