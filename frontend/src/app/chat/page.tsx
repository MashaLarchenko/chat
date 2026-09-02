'use client'

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import io, { type Socket } from 'socket.io-client'
import axios from 'axios'
import api, { messagesApi, privateApi, roomsApi } from '../../lib/api'
import type { Message, PrivateMessage, PrivateRequest, PrivateRoom, ThematicRoom, User, UserSummary } from '../../lib/types'
import './chat.css'

const reactionOptions = ['👍', '❤️', '😂', '🔥', '🎉']

const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem('user')
  if (!stored) return null
  try { return JSON.parse(stored) as User } catch { return null }
}

const getErrorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? (error.response?.data?.message ?? fallback) : fallback

export default function ChatPage() {
  const router = useRouter()
  const [user] = useState<User | null>(getStoredUser)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [selectedContact, setSelectedContact] = useState<UserSummary | null>(null)
  const [privateNotice, setPrivateNotice] = useState('')
  const [privateRequests, setPrivateRequests] = useState<PrivateRequest[]>([])
  const [privateRooms, setPrivateRooms] = useState<PrivateRoom[]>([])
  const [communityRooms, setCommunityRooms] = useState<ThematicRoom[]>([])
  const [unreadPrivateMessages, setUnreadPrivateMessages] = useState<Record<string, number>>({})
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageIdRef = useRef(0)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const parsedUser = getStoredUser()
    if (!token || !parsedUser) { router.replace('/login'); return }

    const loadMessages = async () => {
      try { setMessages(await messagesApi.list()) }
      catch (error) { setPrivateNotice(getErrorMessage(error, 'Could not load messages.')) }
      finally { setIsLoading(false) }
    }
    loadMessages()

    const loadPrivateRequests = async () => {
      try {
        const loaded = await privateApi.listRequests()
        const incoming = loaded.filter((request) => request.recipientId === parsedUser.id && request.status === 'PENDING')
        const known = JSON.parse(localStorage.getItem('known-private-requests') ?? '[]') as string[]
        const newRequest = incoming.find((request) => !known.includes(request.id))
        if (newRequest) setPrivateNotice(`${newRequest.requester.name ?? newRequest.requester.email} sent you a private room request.`)
        localStorage.setItem('known-private-requests', JSON.stringify(incoming.map((request) => request.id)))
        setPrivateRequests(loaded)
      } catch (error) { console.error('Load private requests error:', error) }
    }
    loadPrivateRequests()
    const requestsTimer = window.setInterval(loadPrivateRequests, 10000)

    privateApi.listRooms().then(setPrivateRooms).catch(() => undefined)
    roomsApi.list().then(setCommunityRooms).catch(() => undefined)

    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000', { transports: ['websocket', 'polling'] })
    socket.on('connect', () => { setIsConnected(true); socket.emit('user-join', parsedUser.id) })
    socket.on('message', (message: Message) => setMessages((current) => [...current, message]))
    socket.on('private-room-message', (message: PrivateMessage) => {
      if (message.senderId !== parsedUser.id) {
        setUnreadPrivateMessages((current) => ({ ...current, [message.roomId]: (current[message.roomId] ?? 0) + 1 }))
        setPrivateNotice(`New private message from ${message.sender.name ?? message.sender.email}.`)
      }
    })
    socket.on('disconnect', () => setIsConnected(false))
    socketRef.current = socket

    return () => { socket.close(); socketRef.current = null; window.clearInterval(requestsTimer) }
  }, [router])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = () => {
    if (!input.trim() || !socketRef.current || !user || !isConnected) return
    const content = input.trim()
    socketRef.current.emit('message', { id: `message-${++messageIdRef.current}`, content, userId: user.id, userName: user.name || user.email, isAI: false, createdAt: new Date().toISOString() })
    setInput('')
    if (content.includes('?') || content.toLowerCase().includes('help')) window.setTimeout(() => getAIResponse(content), 500)
  }

  const getAIResponse = async (question: string) => {
    const loadingMessage: Message = { id: `ai-${Date.now()}`, content: 'Thinking...', userId: 'ai', userName: 'AI Assistant', isAI: true, createdAt: new Date().toISOString() }
    setMessages((current) => [...current, loadingMessage])
    try {
      const response = await api.post<{ response: string }>('/ai', { message: question })
      setMessages((current) => current.map((message) => message.id === loadingMessage.id ? { ...message, content: response.data.response } : message))
    } catch { setMessages((current) => current.map((message) => message.id === loadingMessage.id ? { ...message, content: 'The assistant is unavailable right now.' } : message)) }
  }

  const toggleReaction = async (messageId: string, emoji: string) => {
    try {
      const reactions = await messagesApi.toggleReaction(messageId, emoji)
      setMessages((current) => current.map((message) => message.id === messageId ? { ...message, reactions } : message))
    } catch (error) { setPrivateNotice(getErrorMessage(error, 'Could not update reaction.')) }
  }

  const inviteToPrivateRoom = async () => {
    if (!selectedContact) return
    try {
      await privateApi.createRequest(selectedContact.email)
      setPrivateNotice(`Request sent to ${selectedContact.name ?? selectedContact.email}.`)
      setSelectedContact(null)
    } catch (error) { setPrivateNotice(getErrorMessage(error, 'Could not send request.')) }
  }

  const logout = () => { localStorage.clear(); socketRef.current?.close(); router.replace('/login') }
  const pendingRequests = privateRequests.filter((request) => request.recipientId === user?.id && request.status === 'PENDING')
  const unreadPrivateCount = Object.values(unreadPrivateMessages).reduce((total, count) => total + count, 0)

  if (isLoading) return <main className="chat-loading"><span className="loading-orb" />Loading your conversations...</main>

  return (
    <main className="chat-page">
      <header className="chat-header">
        <Link href="/chat" className="chat-brand"><span className="brand-symbol">C</span><span>Convo</span></Link>
        <nav className="chat-header-center" aria-label="Chat spaces"><span className="channel-mark">#</span><span className="current-space">Lobby</span><Link href="/rooms" className="space-link">Community rooms</Link><Link href="/private" className="space-link">Private messages</Link><span className={`connection-status ${isConnected ? 'online' : ''}`}><i />{isConnected ? 'Online' : 'Connecting'}</span></nav>
        <div className="chat-actions">
          <button className="icon-button" type="button" aria-label="Notifications" onClick={() => { setIsNotificationsOpen((open) => !open); setIsUserMenuOpen(false) }}>🔔{pendingRequests.length + unreadPrivateCount > 0 && <b className="notification-count">{pendingRequests.length + unreadPrivateCount}</b>}</button>
          <button className="profile-button" type="button" onClick={() => { setIsUserMenuOpen((open) => !open); setIsNotificationsOpen(false) }}><span className="profile-avatar">{(user?.name || user?.email || 'U')[0].toUpperCase()}</span><span className="profile-name">{user?.name || user?.email}</span><span className="chevron">⌄</span></button>
          {isNotificationsOpen && <div className="chat-popover notification-popover"><h3>Notifications</h3>{pendingRequests.map((request) => <Link href="/private" key={request.id} onClick={() => setIsNotificationsOpen(false)}><strong>{request.requester.name || request.requester.email}</strong><span>Private room request</span></Link>)}{Object.entries(unreadPrivateMessages).map(([roomId, count]) => { const room = privateRooms.find((item) => item.id === roomId); const other = room && (room.userOne.id === user?.id ? room.userTwo : room.userOne); return <Link href="/private" key={roomId} onClick={() => { setIsNotificationsOpen(false); setUnreadPrivateMessages((current) => { const next = { ...current }; delete next[roomId]; return next }) }}><strong>{other?.name || other?.email || 'Private room'}</strong><span>{count} new private message{count === 1 ? '' : 's'}</span></Link>})}{pendingRequests.length === 0 && unreadPrivateCount === 0 && <p>No new notifications.</p>}</div>}
          {isUserMenuOpen && <div className="chat-popover user-popover"><Link href="/private">Private rooms</Link><button type="button" onClick={logout}>Log out</button></div>}
        </div>
      </header>

      <section className="chat-body">
        <div className="conversation-intro"><span className="intro-line" /><p>THE LOBBY</p><h1>Welcome to the conversation.</h1><span className="intro-line" /></div>
        <div className="chat-main-column">
          <div className="message-list">
          {messages.length === 0 && <div className="empty-chat"><span>✦</span><h2>No messages yet</h2><p>Start the conversation and make this space yours.</p></div>}
          {messages.map((message) => {
            const counts = reactionOptions.map((emoji) => ({ emoji, count: message.reactions?.filter((reaction) => reaction.emoji === emoji).length ?? 0, reacted: message.reactions?.some((reaction) => reaction.emoji === emoji && reaction.userId === user?.id) ?? false })).filter((reaction) => reaction.count > 0)
            return <article className={`message ${message.userId === user?.id ? 'own-message' : ''}`} key={message.id}><div className="message-avatar">{message.isAI ? '✦' : (message.userName || message.user?.name || message.user?.email || 'U')[0].toUpperCase()}</div><div className="message-content"><div className="message-meta">{message.isAI ? <strong>AI Assistant</strong> : message.user ? <button type="button" className="author-button" onClick={() => message.user && setSelectedContact(message.user)}>{message.user.name || message.user.email}</button> : <strong>{message.userName || 'User'}</strong>}<time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div><p className="message-text">{message.content}</p><div className="reaction-row">{counts.map((reaction) => <button type="button" className={`reaction-chip ${reaction.reacted ? 'reacted' : ''}`} key={reaction.emoji} onClick={() => toggleReaction(message.id, reaction.emoji)}>{reaction.emoji}<small>{reaction.count}</small></button>)}{!message.isAI && reactionOptions.filter((emoji) => !counts.some((reaction) => reaction.emoji === emoji)).slice(0, 2).map((emoji) => <button type="button" className="reaction-add" key={emoji} title={`React with ${emoji}`} onClick={() => toggleReaction(message.id, emoji)}>＋{emoji}</button>)}</div></div></article>
          })}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <aside className="spaces-sidebar" aria-label="Your spaces">
          <div className="spaces-heading"><div><p>Your spaces</p><span>Jump back into a room</span></div><strong>⋯</strong></div>
          <Link href="/chat" className="space-card active"><span className="space-card-icon">#</span><span><b>Lobby</b><small>Public conversation</small></span><i>Now</i></Link>
          <div className="spaces-section-label">Community rooms <span>{communityRooms.length}</span></div>
          {communityRooms.slice(0, 4).map((room) => <Link href="/rooms" className="space-card" key={room.id}><span className="space-card-icon">#</span><span><b>{room.name}</b><small>{room._count.members} member{room._count.members === 1 ? '' : 's'}</small></span></Link>)}
          {communityRooms.length === 0 && <p className="spaces-empty">No community rooms yet.</p>}
          <div className="spaces-section-label">Private messages <span>{privateRooms.length}</span></div>
          {privateRooms.slice(0, 5).map((room) => { const other = room.userOne.id === user?.id ? room.userTwo : room.userOne; return <Link href="/private" className="space-card" key={room.id}><span className="space-card-avatar">{(other.name || other.email)[0].toUpperCase()}</span><span><b>{other.name || other.email}</b><small>Private room</small></span>{unreadPrivateMessages[room.id] && <i className="space-unread">{unreadPrivateMessages[room.id]}</i>}</Link> })}
          {privateRooms.length === 0 && <p className="spaces-empty">Accepted private rooms appear here.</p>}
          <Link href="/rooms" className="spaces-explore">Explore all community rooms <span>→</span></Link>
        </aside>
      </section>

      <footer className="chat-composer"><div className="composer-shell"><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') sendMessage() }} placeholder={isConnected ? 'Message #lobby' : 'Connecting to lobby...'} disabled={!isConnected} /><button type="button" className="composer-send" onClick={sendMessage} disabled={!isConnected || !input.trim()} aria-label="Send message">→</button></div><p>Ask a question with <span>?</span> to invite the AI assistant.</p></footer>

      {selectedContact && <div className="contact-dialog" role="dialog" aria-label="User actions"><button className="dialog-close" type="button" onClick={() => setSelectedContact(null)} aria-label="Close">×</button><p className="dialog-label">USER PROFILE</p><div className="dialog-person"><span className="profile-avatar large">{(selectedContact.name || selectedContact.email)[0].toUpperCase()}</span><div><h2>{selectedContact.name || selectedContact.email}</h2><p>{selectedContact.email}</p></div></div><button className="dialog-action" type="button" onClick={inviteToPrivateRoom}>Invite to private room <span>→</span></button></div>}
      {privateNotice && <button className="chat-toast" type="button" onClick={() => { setPrivateNotice(''); setIsNotificationsOpen(true) }}>{privateNotice}<span>×</span></button>}
    </main>
  )
}
