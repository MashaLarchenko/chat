'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import io, { type Socket } from 'socket.io-client'
import { privateApi } from '../../lib/api'
import type { PrivateClientEvents, PrivateMessage, PrivateRequest, PrivateRoom, PrivateSocketEvents, User } from '../../lib/types'
import './private.css'

const getUser = (): User | null => {
  const stored = localStorage.getItem('user')
  if (!stored) return null
  try { return JSON.parse(stored) as User } catch { return null }
}

const messageForError = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? (error.response?.data?.message ?? fallback) : fallback

export default function PrivatePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [requests, setRequests] = useState<PrivateRequest[]>([])
  const [rooms, setRooms] = useState<PrivateRoom[]>([])
  const [selectedRoom, setSelectedRoom] = useState<PrivateRoom | null>(null)
  const [messages, setMessages] = useState<PrivateMessage[]>([])
  const [recipientEmail, setRecipientEmail] = useState('')
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const socketRef = useRef<Socket<PrivateSocketEvents, PrivateClientEvents> | null>(null)
  const selectedRoomIdRef = useRef<string | null>(null)

  const otherUser = useMemo(() => {
    if (!selectedRoom || !user) return null
    return selectedRoom.userOne.id === user.id ? selectedRoom.userTwo : selectedRoom.userOne
  }, [selectedRoom, user])

  useEffect(() => {
    const token = localStorage.getItem('token')
    const storedUser = getUser()
    if (!token || !storedUser) { router.replace('/login'); return }
    setUser(storedUser)

    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000', { transports: ['websocket', 'polling'] })
    socket.on('connect', () => socket.emit('user-join', storedUser.id))
    socket.on('private-room-message', (incomingMessage) => {
      if (incomingMessage.roomId === selectedRoomIdRef.current) {
        setMessages((current) => current.some((item) => item.id === incomingMessage.id) ? current : [...current, incomingMessage])
      }
    })
    socketRef.current = socket

    Promise.all([privateApi.listRequests(), privateApi.listRooms()])
      .then(([loadedRequests, loadedRooms]) => {
        setRequests(loadedRequests)
        setRooms(loadedRooms)
        const lastRoomId = localStorage.getItem('last-private-room-id')
        setSelectedRoom(loadedRooms.find((room) => room.id === lastRoomId) ?? loadedRooms[0] ?? null)
      })
      .catch((requestError) => setError(messageForError(requestError, 'Could not load private messages.')))
      .finally(() => setIsLoading(false))

      return () => { socket.close(); socketRef.current = null }
      }, [router])

  useEffect(() => {
    if (!selectedRoom) { selectedRoomIdRef.current = null; setMessages([]); return }
    selectedRoomIdRef.current = selectedRoom.id
    localStorage.setItem('last-private-room-id', selectedRoom.id)
    privateApi.listMessages(selectedRoom.id)
      .then((loadedMessages) => setMessages((current) => [...loadedMessages, ...current.filter((message) => !loadedMessages.some((loaded) => loaded.id === message.id))]))
      .catch((requestError) => setError(messageForError(requestError, 'Could not load this room.')))
  }, [selectedRoom])

  const createRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice('')
    setError('')
    try {
      const request = await privateApi.createRequest(recipientEmail.trim())
      setRequests((current) => [request, ...current])
      setRecipientEmail('')
      setNotice('Private room request sent.')
    } catch (requestError) { setError(messageForError(requestError, 'Could not send request.')) }
  }

  const respond = async (request: PrivateRequest, status: 'ACCEPTED' | 'DECLINED') => {
    setError('')
    try {
      const updated = await privateApi.respondToRequest(request.id, status)
      setRequests((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item))
      if (updated.room) {
        setRooms((current) => [updated.room!, ...current.filter((room) => room.id !== updated.room!.id)])
        setSelectedRoom(updated.room)
      }
    } catch (requestError) { setError(messageForError(requestError, 'Could not update request.')) }
  }

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedRoom || !message.trim()) return
    try {
      if (!user || !socketRef.current) return
      socketRef.current.emit('private-room-message', { roomId: selectedRoom.id, userId: user.id, content: message.trim() })
      setMessage('')
    } catch (requestError) { setError(messageForError(requestError, 'Could not send message.')) }
  }

  if (isLoading) return <main className="private-loading">Loading private rooms...</main>

  const incoming = requests.filter((request) => request.recipientId === user?.id && request.status === 'PENDING')
  const outgoing = requests.filter((request) => request.requesterId === user?.id && request.status === 'PENDING')

  return (
    <main className="private-page">
      <header className="private-header">
        <div><p className="private-kicker">Private rooms</p><h1>Quiet conversations</h1></div>
        <Link className="back-link" href="/chat">Back to chat</Link>
      </header>
      <div className="private-layout">
        <aside className="private-sidebar">
          <form className="request-form" onSubmit={createRequest}>
            <label htmlFor="recipient-email">Invite someone</label>
            <p>Send an invitation using their account email.</p>
            <input id="recipient-email" type="email" placeholder="friend@example.com" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} required />
            <button type="submit">Send request</button>
          </form>
          {incoming.length > 0 && <section className="request-section"><h2>Requests for you</h2>{incoming.map((request) => <div className="request-item" key={request.id}><strong>{request.requester.name ?? request.requester.email}</strong><span>{request.requester.email}</span><div><button onClick={() => respond(request, 'ACCEPTED')}>Accept</button><button className="quiet-button" onClick={() => respond(request, 'DECLINED')}>Decline</button></div></div>)}</section>}
          {outgoing.length > 0 && <section className="request-section"><h2>Waiting for reply</h2>{outgoing.map((request) => <div className="request-item muted" key={request.id}><strong>{request.recipient.name ?? request.recipient.email}</strong><span>{request.recipient.email}</span></div>)}</section>}
          <section className="room-section"><h2>Your rooms</h2>{rooms.length === 0 && <p className="empty-copy">Accepted private rooms will appear here.</p>}{rooms.map((room) => <button className={`room-item ${selectedRoom?.id === room.id ? 'selected' : ''}`} key={room.id} onClick={() => setSelectedRoom(room)}>{room.userOne.id === user?.id ? room.userTwo.name ?? room.userTwo.email : room.userOne.name ?? room.userOne.email}<span>{room.userOne.id === user?.id ? room.userTwo.email : room.userOne.email}</span></button>)}</section>
        </aside>
        <section className="private-chat" aria-live="polite">
          {selectedRoom && otherUser ? <><div className="room-heading"><span className="room-avatar">{(otherUser.name ?? otherUser.email)[0].toUpperCase()}</span><div><h2>{otherUser.name ?? otherUser.email}</h2><p>{otherUser.email}</p></div></div><div className="private-messages">{messages.length === 0 && <p className="empty-chat">No messages yet. Say hello.</p>}{messages.map((item) => <div className={`private-message ${item.senderId === user?.id ? 'mine' : ''}`} key={item.id}><p>{item.content}</p><time>{new Date(item.createdAt).toLocaleTimeString()}</time></div>)}</div><form className="message-form" onSubmit={sendMessage}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a private message..." /><button type="submit" disabled={!message.trim()}>Send</button></form></> : <div className="empty-chat"><span className="empty-icon">✦</span><h2>Your private space</h2><p>Accept a request or choose a room to start talking one-to-one.</p></div>}
        </section>
      </div>
      {(notice || error) && <p className={error ? 'toast error-toast' : 'toast'} role="status">{error || notice}</p>}
    </main>
  )
}
