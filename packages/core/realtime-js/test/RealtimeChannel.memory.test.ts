import assert from 'assert'
import { describe, beforeEach, afterEach, test, expect } from 'vitest'
import RealtimeChannel from '../src/RealtimeChannel'
import {
  setupRealtimeTest,
  TestSetup,
} from './helpers/setup'

const defaultTimeout = 1000

let channel: RealtimeChannel
let testSetup: TestSetup

beforeEach(() => {
  testSetup = setupRealtimeTest({
    useFakeTimers: true,
    timeout: defaultTimeout,
  })
})

afterEach(() => {
  testSetup.cleanup()
})

describe('Event Filtering', () => {
  beforeEach(() => {
    channel = testSetup.client.channel('test-event-filtering')
  })

  afterEach(() => {
    channel.unsubscribe()
  })

  describe('Broadcast event filtering', () => {
    test('should filter broadcast events by exact event name', () => {
      let testEventCount = 0
      let otherEventCount = 0

      channel.on('broadcast', { event: 'test-event' }, () => {
        testEventCount++
      })

      channel.on('broadcast', { event: 'other-event' }, () => {
        otherEventCount++
      })

      // Trigger exact match
      channel.channelAdapter.getChannel().trigger('broadcast', {
        type: 'broadcast',
        event: 'test-event',
        payload: { data: 'test' },
      })

      // Trigger non-match
      channel.channelAdapter.getChannel().trigger('broadcast', {
        type: 'broadcast',
        event: 'other-event',
        payload: { data: 'test' },
      })

      assert.equal(testEventCount, 1)
      assert.equal(otherEventCount, 1)
    })

    test('should handle wildcard broadcast events', () => {
      let wildcardEventCount = 0

      channel.on('broadcast', { event: '*' }, () => {
        wildcardEventCount++
      })

      // Trigger various broadcast events
      channel.channelAdapter.getChannel().trigger('broadcast', {
        type: 'broadcast',
        event: 'event-1',
        payload: { data: 'test' },
      })

      channel.channelAdapter.getChannel().trigger('broadcast', {
        type: 'broadcast',
        event: 'event-2',
        payload: { data: 'test' },
      })

      assert.equal(wildcardEventCount, 2)
    })

    test('should handle multiple listeners for same event', () => {
      let listener1Count = 0
      let listener2Count = 0

      channel.on('broadcast', { event: 'shared-event' }, () => {
        listener1Count++
      })

      channel.on('broadcast', { event: 'shared-event' }, () => {
        listener2Count++
      })

      channel.channelAdapter.getChannel().trigger('broadcast', {
        type: 'broadcast',
        event: 'shared-event',
        payload: { data: 'test' },
      })

      assert.equal(listener1Count, 1)
      assert.equal(listener2Count, 1)
    })
  })

  describe('System event filtering', () => {
    test('should handle system events', () => {
      let systemEventCount = 0

      channel.on('system', {}, (payload) => {
        systemEventCount++
        expect(payload)
      })

      channel.channelAdapter.getChannel().trigger('system', {
        type: 'system',
        event: 'status',
        payload: { status: 'connected' },
      })

      assert.equal(systemEventCount, 1)
    })
  })
})
