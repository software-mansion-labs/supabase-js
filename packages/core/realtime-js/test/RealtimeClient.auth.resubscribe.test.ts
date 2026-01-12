import assert from 'assert'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { setupRealtimeTest, TestSetup } from './helpers/setup'
import { utils } from './helpers/auth'
import { CHANNEL_STATES } from '../src/lib/constants'

describe('Custom JWT token preservation', () => {
  test('preserves access token when resubscribing after removeChannel', async () => {
    // Test scenario:
    // 1. Set custom JWT via setAuth (not using accessToken callback)
    // 2. Subscribe to private channel
    // 3. removeChannel
    // 4. Create new channel with same topic and subscribe

    const topic = 'conversation:dc3fb8c1-ceef-4c00-9f92-e496acd03593'
    const customToken = utils.generateJWT('1h')

    const testSetup = setupRealtimeTest()

    // Step 1: Set auth with custom token (mimics user's setup)
    await testSetup.client.setAuth(customToken)

    // Verify token was set
    assert.strictEqual(testSetup.client.accessTokenValue, customToken)

    // Step 2: Create and subscribe to private channel (first time)
    const channel1 = testSetup.client.channel(topic, {
      config: { private: true },
    })

    channel1.subscribe()

    await vi.waitFor(() =>
      expect(testSetup.emitters.message).toBeCalledWith(`realtime:${topic}`, 'phx_join', {
        access_token: customToken,
        config: {
          broadcast: {
            ack: false,
            self: false,
          },
          postgres_changes: [],
          presence: {
            enabled: false,
            key: '',
          },
          private: true,
        },
      })
    )

    // Step 3: Remove channel (mimics user cleanup)
    await testSetup.client.removeChannel(channel1)

    await vi.waitFor(() => {
      expect(testSetup.emitters.message).toBeCalledWith(`realtime:${topic}`, 'phx_leave', {})
    })

    // Verify channel was removed
    expect(testSetup.client.getChannels()).not.toContain(channel1)

    // Step 4: Create NEW channel with SAME topic and subscribe
    const channel2 = testSetup.client.channel(topic, {
      config: { private: true },
    })

    // This should be a different channel instance
    expect(channel2).not.toBe(channel1)

    channel2.subscribe()

    await vi.waitFor(() =>
      expect(testSetup.emitters.message).toBeCalledWith(`realtime:${topic}`, 'phx_join', {
        access_token: customToken,
        config: {
          broadcast: {
            ack: false,
            self: false,
          },
          postgres_changes: [],
          presence: {
            enabled: false,
            key: '',
          },
          private: true,
        },
      })
    )

    await vi.waitFor(() => expect(channel2.state).toBe('joined'))

    testSetup.cleanup()
    testSetup.client.removeAllChannels()
  })

  test('supports accessToken callback for token rotation', async () => {
    // Verify that callback-based token fetching works correctly
    const customToken = utils.generateJWT('1h')
    let callCount = 0

    const clientWithCallback = setupRealtimeTest({
      accessToken: async () => {
        callCount++
        return customToken
      },
    })

    // Set initial auth
    await clientWithCallback.client.setAuth()

    // Create and subscribe to first channel
    const channel1 = clientWithCallback.client.channel('conversation:test', {
      config: { private: true },
    })

    const pushSpy = vi.spyOn(clientWithCallback.socket, 'push')
    channel1.state = CHANNEL_STATES.closed
    await channel1.subscribe()

    const firstJoin = pushSpy.mock.calls.find((call) => call[0]?.event === 'phx_join')
    expect(firstJoin![0].payload).toHaveProperty('access_token', customToken)

    // Remove and recreate
    await clientWithCallback.socket.removeChannel(channel1)
    pushSpy.mockClear()

    const channel2 = clientWithCallback.socket.channel('conversation:test', {
      config: { private: true },
    })

    channel2.state = CHANNEL_STATES.closed
    await channel2.subscribe()

    const secondJoin = pushSpy.mock.calls.find((call) => call[0]?.event === 'phx_join')

    // Callback should provide token for both subscriptions
    expect(secondJoin![0].payload).toHaveProperty('access_token', customToken)

    clientWithCallback.cleanup()
  })

  test('preserves token when subscribing to different topics', async () => {
    const customToken = utils.generateJWT('1h')
    await testSetup.socket.setAuth(customToken)

    // Subscribe to first topic
    const channel1 = testSetup.socket.channel('topic1', { config: { private: true } })
    channel1.state = CHANNEL_STATES.closed
    await channel1.subscribe()

    await testSetup.socket.removeChannel(channel1)

    // Subscribe to DIFFERENT topic
    const pushSpy = vi.spyOn(testSetup.socket, 'push')
    const channel2 = testSetup.socket.channel('topic2', { config: { private: true } })
    channel2.state = CHANNEL_STATES.closed
    await channel2.subscribe()

    const joinCall = pushSpy.mock.calls.find((call) => call[0]?.event === 'phx_join')
    expect(joinCall![0].payload).toHaveProperty('access_token', customToken)
  })

  test('handles accessToken callback errors gracefully during subscribe', async () => {
    const errorMessage = 'Token fetch failed during subscribe'
    let callCount = 0
    const tokens = ['initial-token', null] // Second call will throw

    const accessToken = vi.fn(() => {
      if (callCount++ === 0) {
        return Promise.resolve(tokens[0])
      }
      return Promise.reject(new Error(errorMessage))
    })

    const logSpy = vi.fn()

    const client = testBuilders.standardClient({
      accessToken,
      logger: logSpy,
    })

    // First subscribe should work
    await client.socket.setAuth()
    const channel1 = client.socket.channel('test', { config: { private: true } })
    channel1.state = CHANNEL_STATES.closed
    await channel1.subscribe()

    expect(client.socket.accessTokenValue).toBe(tokens[0])

    // Remove and resubscribe - callback will fail but should fall back
    await client.socket.removeChannel(channel1)

    const channel2 = client.socket.channel('test', { config: { private: true } })
    channel2.state = CHANNEL_STATES.closed
    await channel2.subscribe()

    // Verify error was logged
    expect(logSpy).toHaveBeenCalledWith(
      'error',
      'Error fetching access token from callback',
      expect.any(Error)
    )

    // Verify subscription still succeeded with cached token
    expect(client.socket.accessTokenValue).toBe(tokens[0])

    client.cleanup()
  })
})
