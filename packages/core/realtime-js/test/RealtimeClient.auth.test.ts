import assert from 'assert'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { WebSocket as MockWebSocket } from 'mock-socket'
import RealtimeClient from '../src/RealtimeClient'
import { CHANNEL_STATES, DEFAULT_VERSION } from '../src/lib/constants'
import { testBuilders, EnhancedTestSetup, testSuites } from './helpers/setup'
import { utils, authHelpers as testHelpers, authBuilders } from './helpers/auth'

let testSetup: EnhancedTestSetup

beforeEach(() => {
  testSetup = testBuilders.standardClient()
})

afterEach(() => {
  testSetup.cleanup()
  testSetup.socket.removeAllChannels()
})

describe('token setting and updates', () => {
  test("sets access token, updates channels' join payload, and pushes token to channels", async () => {
    testSetup.cleanup()
    let accessTokenMessages: Array<{ topic: string; access_token: string }> = []
    testSetup = testBuilders.standardClient({
      preparation: (server) => {
        server.on('connection', (socket) => {
          socket.on('message', (message) => {
            const data = JSON.parse(message as string)
            if (data.event == 'access_token') {
              accessTokenMessages.push({
                topic: data.topic,
                access_token: data.payload.access_token,
              })
            } else {
              const response = {
                event: 'phx_reply',
                payload: { status: 'ok', response: { postgres_changes: [] } },
                ref: data.ref,
                topic: data.topic,
              }

              socket.send(JSON.stringify(response))
            }
          })
        })
      },
    })

    const channel1 = testSetup.socket.channel('test-topic1')
    const channel2 = testSetup.socket.channel('test-topic2')
    const channel3 = testSetup.socket.channel('test-topic3')

    // Subscribe to channels
    let subscribedChan1 = false
    let subscribedChan3 = false

    channel1.subscribe((status) => {
      if (status == 'SUBSCRIBED') subscribedChan1 = true
    })
    channel3.subscribe((status) => {
      if (status == 'SUBSCRIBED') subscribedChan3 = true
    })

    await vi.waitFor(() => expect(subscribedChan1).toBe(true))
    await vi.waitFor(() => expect(subscribedChan3).toBe(true))

    const token = utils.generateJWT('1h')
    await testSetup.socket.setAuth(token)

    assert.strictEqual(testSetup.socket.accessTokenValue, token)

    // Ensure that only 2 access token messages were sent
    await vi.waitFor(() => {
      const accessTokenMessage1 = accessTokenMessages.find(
        ({ topic, access_token }) => topic === 'realtime:test-topic1' && access_token === token
      )
      const accessTokenMessage3 = accessTokenMessages.find(
        ({ topic, access_token }) => topic === 'realtime:test-topic3' && access_token === token
      )

      if (!(accessTokenMessage1 && accessTokenMessage3))
        throw new Error(`not found: ${accessTokenMessage1} ${accessTokenMessage3}`)
    })

    assert.equal(accessTokenMessages.length, 2)

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
    const channel = testSetup.socket.channel('test-topic')
    let joined = false
    channel.subscribe((_status) => {
      joined = true
    })

    await vi.waitFor(() => expect(joined).toBe(true))

    const token = utils.generateJWT('4h')
    assert.notEqual(token, channel.socket.accessTokenValue)

    await testSetup.socket.setAuth(token)
    await testSetup.socket.setAuth(token)

    await vi.waitFor(() => {
      expect(dataSpy).toBeCalledWith('realtime:test-topic', 'access_token', { access_token: token })
      expect(dataSpy).toBeCalledTimes(2) // phx_join and access_token
    })

    assert.strictEqual(testSetup.socket.accessTokenValue, token)
  })

  test("sets access token, updates channels' join payload, and pushes token to channels if is not a jwt", async () => {
    const channels = testHelpers.setupAuthTestChannels(testSetup.socket)
    const spies = testHelpers.setupAuthTestSpies(channels)

    const new_token = 'sb-key'
    await testSetup.socket.setAuth(new_token)

    assert.strictEqual(testSetup.socket.accessTokenValue, new_token)
    testHelpers.assertAuthTestResults(new_token, spies, true)
  })

  test("sets access token using callback, updates channels' join payload, and pushes token to channels", async () => {
    const new_token = utils.generateJWT('1h')
    const new_socket = new RealtimeClient(testSetup.url, {
      transport: MockWebSocket,
      accessToken: () => Promise.resolve(new_token),
      params: { apikey: '123456789' },
    })

    const channels = testHelpers.setupAuthTestChannels(new_socket)
    const spies = testHelpers.setupAuthTestSpies(channels)

    await new_socket.setAuth()

    assert.strictEqual(new_socket.accessTokenValue, new_token)
    testHelpers.assertAuthTestResults(new_token, spies, true)
  })

  test("overrides access token, updates channels' join payload, and pushes token to channels", () => {
    const channels = testHelpers.setupAuthTestChannels(testSetup.socket)
    const spies = testHelpers.setupAuthTestSpies(channels)

    const new_token = 'override'
    testSetup.socket.setAuth(new_token)

    assert.strictEqual(testSetup.socket.accessTokenValue, new_token)
    testHelpers.assertAuthTestResults(new_token, spies, true)
  })
})

describe('auth during connection states', () => {
  test('handles setAuth errors gracefully during connection', async () => {
    const errorMessage = 'Token fetch failed'
    const accessToken = vi.fn(() => Promise.reject(new Error(errorMessage)))
    const logSpy = vi.fn()

    const socketWithError = new RealtimeClient(testSetup.url, {
      transport: MockWebSocket,
      accessToken,
      logger: logSpy,
      params: { apikey: '123456789' },
    })

    socketWithError.connect()

    await new Promise((resolve) => setTimeout(() => resolve(undefined), 100))

    // Verify that the error was logged with more specific message
    expect(logSpy).toHaveBeenCalledWith(
      'error',
      'Error fetching access token from callback',
      expect.any(Error)
    )

    // Verify that the connection was still established despite the error
    assert.ok(socketWithError.conn, 'connection should still exist')
    assert.equal(socketWithError.conn!.url, socketWithError.endpointURL())
  })

  test('updates auth token during heartbeat', async () => {
    const {
      beforeEach: setupConnected,
      afterEach: teardownConnected,
      getSetup,
    } = testSuites.clientWithConnection({ connect: true })

    setupConnected()
    const connectedSetup = getSetup()
    const token = utils.generateJWT('1h')
    const setAuthSpy = vi.spyOn(connectedSetup.socket, 'setAuth')
    const sendSpy = vi.spyOn(connectedSetup.socket.conn as WebSocket, 'send')

    const readyStateSpy = vi
      .spyOn(connectedSetup.socket.conn!, 'readyState', 'get')
      .mockReturnValue(1)
    const tokenSpy = vi
      .spyOn(connectedSetup.socket, 'accessTokenValue', 'get')
      .mockReturnValue(token)

    const heartbeatData = '{"topic":"phoenix","event":"heartbeat","payload":{},"ref":"1"}'

    await connectedSetup.socket.sendHeartbeat()

    expect(sendSpy).toHaveBeenCalledWith(heartbeatData)
    expect(setAuthSpy).toHaveBeenCalled()
    expect(setAuthSpy).toHaveBeenCalledTimes(1)
    readyStateSpy.mockRestore()
    tokenSpy.mockRestore()
    teardownConnected()
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
