import assert from 'assert'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import RealtimeClient from '../src/RealtimeClient'
import { setupRealtimeTest, TestSetup, DEFAULT_API_KEY } from './helpers/setup'

let testSetup: TestSetup

beforeEach(() => {
  testSetup = setupRealtimeTest()
})

afterEach(() => {
  testSetup.cleanup()
})

describe('endpointURL', () => {
  test('returns endpoint for given full url', () => {
    assert.equal(
      testSetup.client.endpointURL(),
      `${testSetup.wssUrl}?apikey=${DEFAULT_API_KEY}&vsn=1.0.0`
    )
  })

  test('returns endpoint with parameters', () => {
    const client = new RealtimeClient(testSetup.realtimeUrl, {
      params: { foo: 'bar', apikey: DEFAULT_API_KEY },
    })
    assert.equal(
      client.endpointURL(),
      `${testSetup.wssUrl}?foo=bar&apikey=${DEFAULT_API_KEY}&vsn=1.0.0`
    )
  })

  test('returns endpoint with apikey', () => {
    const client = new RealtimeClient(testSetup.realtimeUrl, {
      params: { apikey: DEFAULT_API_KEY },
    })
    assert.equal(client.endpointURL(), `${testSetup.wssUrl}?apikey=${DEFAULT_API_KEY}&vsn=1.0.0`)
  })

  test('returns endpoint with valid vsn', () => {
    const client = new RealtimeClient(testSetup.realtimeUrl, {
      params: { apikey: DEFAULT_API_KEY },
      vsn: '2.0.0',
    })
    assert.equal(client.endpointURL(), `${testSetup.wssUrl}?apikey=${DEFAULT_API_KEY}&vsn=2.0.0`)
  })
})
