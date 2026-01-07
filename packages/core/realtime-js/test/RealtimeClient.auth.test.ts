import assert from 'assert'
import { afterEach, beforeEach, describe, expect, Mock, test, vi } from 'vitest'
import { WebSocket as MockWebSocket } from 'mock-socket'
import RealtimeClient from '../src/RealtimeClient'
import { CHANNEL_STATES, DEFAULT_VERSION } from '../src/lib/constants'
import { testBuilders, EnhancedTestSetup, DataSpy, spyOnMessage } from './helpers/setup'
import { utils, authHelpers as testHelpers } from './helpers/auth'

let testSetup: EnhancedTestSetup
let dataSpy: DataSpy

beforeEach(() => {
  dataSpy = vi.fn()
  testSetup = testBuilders.standardClient({
    preparation: (server) => spyOnMessage(server, dataSpy),
  })
})

afterEach(() => {
  dataSpy.mockClear()
  testSetup.cleanup()
  testSetup.socket.removeAllChannels()
})

describe('token setting and updates', () => {
  test("sets access token, updates channels' join payload, and pushes token to channels", async () => {
    const [channel1, channel2, channel3] = await testHelpers.setupAuthTestChannels(testSetup.socket)

    dataSpy.mockClear()

    const token = utils.generateJWT('1h')
    await testSetup.socket.setAuth(token)

    assert.strictEqual(testSetup.socket.accessTokenValue, token)

    testHelpers.assertPushes(token, dataSpy, ['test-topic1', 'test-topic2'])

    // Check joinPush payload
    assert.deepEqual(channel1.joinPush.payload(), {
      access_token: token,
      version: DEFAULT_VERSION,
    })

    assert.deepEqual(channel2.joinPush.payload(), {
      access_token: token,
      version: DEFAULT_VERSION,
    })

    assert.deepEqual(channel3.joinPush.payload(), {
      access_token: token,
      version: DEFAULT_VERSION,
    })
  })

  test("does not send message if token hasn't changed", async () => {
    const channel = await testHelpers.setupAuthTestChannel(testSetup.socket)

    dataSpy.mockClear()

    const token = utils.generateJWT('4h')
    assert.notEqual(token, channel.socket.accessTokenValue)

    await testSetup.socket.setAuth(token)
    await testSetup.socket.setAuth(token)

    await testHelpers.assertPushes(token, dataSpy, ['test-topic'])

    assert.strictEqual(testSetup.socket.accessTokenValue, token)
  })

  test("sets access token, updates channels' join payload, and pushes token to channels if is not a jwt", async () => {
    await testHelpers.setupAuthTestChannels(testSetup.socket)

    dataSpy.mockClear()

    const new_token = 'sb-key'
    await testSetup.socket.setAuth(new_token)

    assert.strictEqual(testSetup.socket.accessTokenValue, new_token)

    await testHelpers.assertPushes(new_token, dataSpy, ['test-topic1', 'test-topic3'])
  })

  test("sets access token using callback, updates channels' join payload, and pushes token to channels", async () => {
    const new_token = utils.generateJWT('1h')
    const newSpy = vi.fn()
    const newClient = testBuilders.standardClient({
      accessToken: () => Promise.resolve(new_token),
      preparation: (server) => spyOnMessage(server, newSpy),
    })

    const channels = await testHelpers.setupAuthTestChannels(newClient.socket)

    await newClient.socket.setAuth()

    assert.strictEqual(newClient.socket.accessTokenValue, new_token)

    const topics = channels.map((chan) => chan.subTopic)
    testHelpers.assertPushes(new_token, newSpy, topics)
  })

  test("overrides access token, updates channels' join payload, and pushes token to channels", async () => {
    await testHelpers.setupAuthTestChannels(testSetup.socket)

    dataSpy.mockClear()

    const new_token = 'override'
    testSetup.socket.setAuth(new_token)

    assert.strictEqual(testSetup.socket.accessTokenValue, new_token)

    await testHelpers.assertPushes(new_token, dataSpy, ['test-topic1', 'test-topic3'])
  })
})

describe('auth during connection states', () => {
  test('handles setAuth errors gracefully during connection', async () => {
    const errorMessage = 'Token fetch failed'
    const accessToken = vi.fn(() => Promise.reject(new Error(errorMessage)))
    const logSpy = vi.fn()

    const socketWithError = new RealtimeClient(testSetup.realtimeUrl, {
      transport: MockWebSocket,
      accessToken,
      logger: logSpy,
      params: { apikey: '123456789' },
    })

    socketWithError.connect()

    // Verify that the error was logged with more specific message
    await vi.waitFor(() =>
      expect(logSpy).toHaveBeenCalledWith(
        'error',
        'Error fetching access token from callback',
        expect.any(Error)
      )
    )

    // Verify that the connection was still established despite the error
    assert.ok(socketWithError.socketAdapter.getSocket().conn, 'connection should still exist')
    socketWithError.disconnect()
  })

  test('updates auth token during heartbeat', async () => {
    const initialToken = utils.generateJWT('1h')
    const newToken = utils.generateJWT('3h')
    const heartbeatSpy: DataSpy = vi.fn()

    // Use a mutable token that we can change between heartbeats
    let currentToken = initialToken
    const heartbeatSetup = testBuilders.standardClient({
      accessToken: () => Promise.resolve(currentToken),
      preparation: (server) => spyOnMessage(server, heartbeatSpy),
    })

    heartbeatSetup.socket.connect()

    // Wait for connection to establish
    await vi.waitFor(() => {
      expect(heartbeatSetup.socket.isConnected()).toBe(true)
    })

    // Verify initial token is set
    assert.equal(heartbeatSetup.socket.accessTokenValue, initialToken)

    // Change the token that the callback will return
    currentToken = newToken

    heartbeatSpy.mockClear()

    await heartbeatSetup.socket.sendHeartbeat()

    await vi.waitFor(() => {
      expect(heartbeatSpy).toHaveBeenCalledWith('phoenix', 'heartbeat', {})
    })

    // Verify the token was updated during heartbeat
    assert.equal(heartbeatSetup.socket.accessTokenValue, newToken)

    heartbeatSetup.cleanup()
  })

  test('uses new token after reconnect', async () => {
    const tokens = ['initial-token', 'refreshed-token']

    let callCount = 0
    const accessToken = vi.fn(() => Promise.resolve(tokens[callCount++]))

    const socket = new RealtimeClient(testSetup.url, {
      transport: MockWebSocket,
      accessToken,
      params: { apikey: '123456789' },
    })
    socket.connect()

    // Wait for the async setAuth call to complete
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(accessToken).toHaveBeenCalledTimes(1)
    expect(socket.accessTokenValue).toBe(tokens[0])

    // Call the callback and wait for async operations to complete
    await socket.reconnectTimer?.callback()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(socket.accessTokenValue).toBe(tokens[1])
    expect(accessToken).toHaveBeenCalledTimes(2)
  })
})
