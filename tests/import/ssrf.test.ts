import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}))

import {
  isPrivateIpv4,
  isPrivateIpv6,
  isPrivateIp,
  assertSafeUrl,
  fetchWithRedirectSafety,
  readBoundedText,
  detectContentType,
  UnsafeHostError,
  InvalidUrlError,
} from '@/lib/import/ssrf'
import { lookup } from 'node:dns/promises'

const mockedLookup = vi.mocked(lookup)

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn())
})

describe('isPrivateIpv4', () => {
  it.each([
    ['127.0.0.1', true],
    ['10.0.0.1', true],
    ['192.168.1.1', true],
    ['172.16.0.1', true],
    ['169.254.169.254', true],
    ['100.64.0.1', true],
    ['224.0.0.1', true],
    ['8.8.8.8', false],
    ['172.32.0.1', false],
    ['1.1.1.1', false],
  ])('clasifica %s', (ip, expected) => {
    expect(isPrivateIpv4(ip)).toBe(expected)
  })
})

describe('isPrivateIpv6', () => {
  it.each([
    ['::1', true],
    ['::', true],
    ['fe80::1', true],
    ['fc00::1', true],
    ['fd12:3456::1', true],
    ['2001:db8::1', true],
    ['::ffff:10.0.0.1', true],
    ['2001:4860:4860::8888', false],
  ])('clasifica %s', (ip, expected) => {
    expect(isPrivateIpv6(ip)).toBe(expected)
  })
})

describe('isPrivateIp', () => {
  it('detecta versiones y no-IPs', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true)
    expect(isPrivateIp('8.8.8.8')).toBe(false)
    expect(isPrivateIp('not-an-ip')).toBe(true)
  })
})

describe('assertSafeUrl', () => {
  it('rechaza protocolos no http(s)', async () => {
    await expect(assertSafeUrl('ftp://example.com')).rejects.toThrow(InvalidUrlError)
    await expect(assertSafeUrl('file:///etc/passwd')).rejects.toThrow(InvalidUrlError)
  })

  it('rechaza IPs privadas literales', async () => {
    await expect(assertSafeUrl('http://192.168.1.1/')).rejects.toThrow(UnsafeHostError)
    await expect(assertSafeUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(UnsafeHostError)
    await expect(assertSafeUrl('http://[::1]/')).rejects.toThrow(UnsafeHostError)
  })

  it('acepta IPs públicas literales', async () => {
    await expect(assertSafeUrl('https://8.8.8.8/')).resolves.toBeUndefined()
  })

  it('rechaza hosts que resuelven a IP privada', async () => {
    mockedLookup.mockResolvedValue([
      { address: '10.0.0.1', family: 4 },
      { address: '192.168.1.5', family: 4 },
    ])
    await expect(assertSafeUrl('https://evil.example.com/')).rejects.toThrow(UnsafeHostError)
  })

  it('acepta hosts que resuelven a IP pública', async () => {
    mockedLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    await expect(assertSafeUrl('https://public.example.com/')).resolves.toBeUndefined()
  })

  it('rechaza URLs inválidas', async () => {
    await expect(assertSafeUrl('not a url')).rejects.toThrow(InvalidUrlError)
  })
})

describe('fetchWithRedirectSafety', () => {
  it('sigue redirects re-validados y devuelve la respuesta final', async () => {
    mockedLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    const fetchMock = vi.fn()
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(new Response(null, { status: 302, headers: { location: 'https://example.com/2' } }))
    )
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }))
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await fetchWithRedirectSafety('https://example.com/1')
    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const firstCall = fetchMock.mock.calls[0][0] as string
    const secondCall = fetchMock.mock.calls[1][0] as string
    expect(firstCall).toContain('example.com/1')
    expect(secondCall).toContain('example.com/2')
  })

  it('rechaza más de 5 redirects', async () => {
    mockedLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 302, headers: { location: 'https://example.com/next' } }))
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchWithRedirectSafety('https://example.com/start')).rejects.toThrow('Too many redirects')
  })

  it('rechaza redirect a host privado', async () => {
    mockedLookup.mockResolvedValue([{ address: '10.0.0.1', family: 4 }])
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 302, headers: { location: 'https://internal.example.com/' } }))
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchWithRedirectSafety('https://example.com/start')).rejects.toThrow(UnsafeHostError)
  })
})

describe('readBoundedText', () => {
  it('lee el cuerpo completo', async () => {
    const response = new Response('contenido de prueba', { headers: { 'content-type': 'text/plain' } })
    await expect(readBoundedText(response)).resolves.toBe('contenido de prueba')
  })

  it('rechaza cuerpos mayores a 5 MB', async () => {
    const big = new Uint8Array(6 * 1024 * 1024)
    const response = new Response(big)
    await expect(readBoundedText(response)).rejects.toThrow('5 MB limit')
  })
})

describe('detectContentType', () => {
  it('detecta por header', () => {
    expect(detectContentType('application/json', '')).toBe('json')
    expect(detectContentType('application/rss+xml', '')).toBe('xml')
    expect(detectContentType('text/html; charset=utf-8', '')).toBe('html')
  })

  it('detecta por contenido', () => {
    expect(detectContentType(null, '{ "a": 1 }')).toBe('json')
    expect(detectContentType(null, '<?xml version="1.0"?><rss></rss>')).toBe('xml')
    expect(detectContentType(null, '<!doctype html><html></html>')).toBe('html')
    expect(detectContentType(null, 'solo texto')).toBe('unknown')
  })
})
