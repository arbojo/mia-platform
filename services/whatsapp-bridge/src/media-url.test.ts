import { describe, it, expect, vi } from 'vitest'
import { isSafeMediaUrl, sendReply, type ReplySocket } from './media-url.js'

describe('isSafeMediaUrl', () => {
  it('accepts a public Supabase Storage URL', () => {
    expect(isSafeMediaUrl('https://abc123.supabase.co/storage/v1/object/public/x/a.jpg')).toBe(true)
  })

  it('accepts an allowlisted CDN', () => {
    expect(isSafeMediaUrl('https://cdn.jsdelivr.net/gh/u/r@main/a.jpg')).toBe(true)
  })

  it('rejects relative paths and localhost', () => {
    expect(isSafeMediaUrl('/local/image.jpg')).toBe(false)
    expect(isSafeMediaUrl('http://localhost:3000/img.jpg')).toBe(false)
    expect(isSafeMediaUrl('http://127.0.0.1/img.jpg')).toBe(false)
  })

  it('rejects private IPs and non-public hosts', () => {
    expect(isSafeMediaUrl('https://10.0.0.1/img.jpg')).toBe(false)
    expect(isSafeMediaUrl('https://169.254.169.254/meta/')).toBe(false)
    expect(isSafeMediaUrl('https://example.com/img.jpg')).toBe(false)
  })

  it('rejects non-http(s) and credential-bearing URLs', () => {
    expect(isSafeMediaUrl('ftp://example.com/a.jpg')).toBe(false)
    expect(isSafeMediaUrl('https://user:pw@abc123.supabase.co/a.jpg')).toBe(false)
  })
})

function fakeSocket() {
  const sendMessage = vi.fn().mockResolvedValue({})
  return { sendMessage } as unknown as ReplySocket & { sendMessage: ReturnType<typeof vi.fn> }
}

describe('sendReply', () => {
  it('sends image + caption when the URL is safe', async () => {
    const socket = fakeSocket()
    const result = await sendReply(
      socket,
      'jid@wa', 
      'Aquí tienes el detalle',
      'https://abc123.supabase.co/storage/v1/object/public/knowledge-media/biz-1/a.jpg'
    )

    expect(result.asImage).toBe(true)
    expect(socket.sendMessage).toHaveBeenCalledTimes(1)
    expect(socket.sendMessage).toHaveBeenCalledWith('jid@wa', {
      image: { url: 'https://abc123.supabase.co/storage/v1/object/public/knowledge-media/biz-1/a.jpg' },
      caption: 'Aquí tienes el detalle',
    })
  })

  it('falls back to text when the image send fails (download error)', async () => {
    const socket = fakeSocket()
    socket.sendMessage
      .mockRejectedValueOnce(new Error('image download failed'))
      .mockResolvedValueOnce({})

    const result = await sendReply(
      socket,
      'jid@wa',
      'Aquí tienes el detalle',
      'https://abc123.supabase.co/storage/v1/object/public/knowledge-media/biz-1/a.jpg'
    )

    expect(result.sent).toBe(true)
    expect(result.asImage).toBe(false)
    expect(socket.sendMessage).toHaveBeenCalledTimes(2)
    expect(socket.sendMessage).toHaveBeenLastCalledWith('jid@wa', { text: 'Aquí tienes el detalle' })
  })

  it('sends only text when the URL is not safe', async () => {
    const socket = fakeSocket()
    const result = await sendReply(socket, 'jid@wa', 'Solo texto', 'http://localhost:3000/a.jpg')

    expect(result.asImage).toBe(false)
    expect(socket.sendMessage).toHaveBeenCalledTimes(1)
    expect(socket.sendMessage).toHaveBeenCalledWith('jid@wa', { text: 'Solo texto' })
  })

  it('sends text when no image is provided', async () => {
    const socket = fakeSocket()
    const result = await sendReply(socket, 'jid@wa', 'Respuesta normal')

    expect(result.asImage).toBe(false)
    expect(socket.sendMessage).toHaveBeenCalledWith('jid@wa', { text: 'Respuesta normal' })
  })
})
