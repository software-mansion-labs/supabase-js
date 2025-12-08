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

type Push = ReturnType<Channel['push']>

export type {
  Channel,
  Push,
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
