// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  closeTopBackOverlay,
  isFormRoute,
  miniAppBackTarget,
  overlayCount,
  registerBackOverlay,
  subscribeBackOverlays,
} from './miniapp-back'

describe('miniAppBackTarget (20.4.1)', () => {
  it.each([
    ['/m', null],
    ['/m/', null],
    ['/m/orgs', null],
    ['/m/invite/abc', null],
    ['/', null],
    ['/cabinet/orgs/1', null],
    ['/m/orgs/create', '/m/orgs'],
    ['/m/orgs/7', null],
    ['/m/orgs/7/', null],
    ['/m/orgs/7/subscriptions', null],
    ['/m/orgs/7/profile', null],
    ['/m/orgs/7/members', null],
    ['/m/orgs/7/cashbox', null],
    ['/m/orgs/7/payments', null],
    ['/m/orgs/7/bookings', '/m/orgs/7'],
    ['/m/orgs/7/plans', '/m/orgs/7'],
    ['/m/orgs/7/settings', '/m/orgs/7'],
    ['/m/orgs/7/events', '/m/orgs/7'],
    ['/m/orgs/7/events/new', '/m/orgs/7/events'],
    ['/m/orgs/7/events/42', '/m/orgs/7/events'],
    ['/m/orgs/7/events/42/manage', '/m/orgs/7/events/42'],
    ['/m/orgs/7/events/42/edit', '/m/orgs/7/events/42/manage'],
    ['/m/orgs/7/events/42/manage?tab=roster#x', '/m/orgs/7/events/42'],
    ['/m/orgs/7/some/future/screen', '/m/orgs/7/some/future'],
  ])('%s -> %s', (path, expected) => {
    expect(miniAppBackTarget(path)).toBe(expected)
  })

  it('knows which routes are forms that must not be re-entered by history back', () => {
    expect(isFormRoute('/m/orgs/create')).toBe(true)
    expect(isFormRoute('/m/orgs/7/events/new')).toBe(true)
    expect(isFormRoute('/m/orgs/7/events/42/edit')).toBe(true)
    expect(isFormRoute('/m/orgs/7/events/42')).toBe(false)
  })
})

describe('back overlay stack (sheets, alerts)', () => {
  const cleanups: Array<() => void> = []
  afterEach(() => {
    while (cleanups.length) cleanups.pop()!()
  })

  it('closes the topmost overlay first and reports when nothing was open', () => {
    const closeA = vi.fn()
    const closeB = vi.fn()
    cleanups.push(registerBackOverlay(closeA), registerBackOverlay(closeB))
    expect(overlayCount()).toBe(2)

    expect(closeTopBackOverlay()).toBe(true)
    expect(closeB).toHaveBeenCalledTimes(1)
    expect(closeA).not.toHaveBeenCalled()
    // the closer is responsible for unregistering; simulate it
    cleanups.pop()!()
    expect(closeTopBackOverlay()).toBe(true)
    expect(closeA).toHaveBeenCalledTimes(1)
    cleanups.pop()!()
    expect(closeTopBackOverlay()).toBe(false)
  })

  it('notifies subscribers on every change and supports unsubscribe', () => {
    const listener = vi.fn()
    const off = subscribeBackOverlays(listener)
    const unregister = registerBackOverlay(() => {})
    unregister()
    expect(listener).toHaveBeenCalledTimes(2)
    off()
    registerBackOverlay(() => {})()
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
