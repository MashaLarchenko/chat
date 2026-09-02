'use client'

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import io, { type Socket } from 'socket.io-client'
import { roomsApi } from '../../lib/api'
import type { RoomClientEvents, RoomMember, RoomMessage, RoomSocketEvents, ThematicRoom, User } from '../../lib/types'
import './rooms.css'

const getUser = (): User | null => {
  const stored = localStorage.getItem('user')
  if (!stored) return null
  try { return JSON.parse(stored) as User } catch { return null }
}
const errorMessage = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.message ?? 'Something went wrong.' : 'Something went wrong.'

export default function RoomsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [rooms, setRooms] = useState<ThematicRoom[]>([])
  const [selected, setSelected] = useState<ThematicRoom | null>(null)
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [members, setMembers] = useState<RoomMember[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const selectedRoomIdRef = useRef<string | null>(null)
  const socketRef = useRef<Socket<RoomSocketEvents, RoomClientEvents> | null>(null)

  useEffect(() => {
    const current = getUser()
    if (!localStorage.getItem('token') || !current) { router.replace('/login'); return }
    setUser(current)
    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000', { transports: ['websocket', 'polling'] })
    socket.emit('user-join', current.id)
    socket.on('room-message', (message) => {
      if (message.roomId === selectedRoomIdRef.current) setMessages((currentMessages) => [...currentMessages, message])
    })
    socketRef.current = socket

    roomsApi.list().then((loadedRooms) => {
      setRooms(loadedRooms)
      const lastRoomId = localStorage.getItem('last-room-id')
      const restoredRoom = loadedRooms.find((room) => room.id === lastRoomId) ?? loadedRooms[0] ?? null
      setSelected(restoredRoom)
      setMembers(restoredRoom?.members ?? [])
    }).catch((e) => setError(errorMessage(e)))

    return () => { socket.close(); socketRef.current = null }
  }, [router])

  useEffect(() => {
    if (!selected) return
    selectedRoomIdRef.current = selected.id
    localStorage.setItem('last-room-id', selected.id)
    setMembers(selected.members ?? [])
    if (selected.isMember || selected.createdBy === getUser()?.id) {
      roomsApi.messages(selected.id).then(setMessages).catch((e) => setError(errorMessage(e)))
    } else {
      setMessages([])
    }
    const currentUser = getUser()
    if (currentUser) socketRef.current?.emit('room-join', { roomId: selected.id, userId: currentUser.id })
  }, [selected])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const createRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setIsCreating(true); setError('')
    try {
      const room = await roomsApi.create(name, description)
      const loadedRooms = await roomsApi.list()
      const createdRoom = loadedRooms.find((item) => item.id === room.id) ?? room
      setRooms(loadedRooms)
      setSelected(createdRoom)
      setMembers(createdRoom.members ?? [])
      setName('')
      setDescription('')
    }
    catch (e) { setError(errorMessage(e)) } finally { setIsCreating(false) }
  }

  const joinRoom = async (room: ThematicRoom) => {
    setJoiningRoomId(room.id)
    setError('')
    try {
      await roomsApi.join(room.id)
      const loadedRooms = await roomsApi.list()
      const joinedRoom = loadedRooms.find((item) => item.id === room.id) ?? room
      setRooms(loadedRooms)
      setMembers(joinedRoom.members ?? [])
      setSelected(joinedRoom)
    } catch (e) { setError(errorMessage(e)) }
    finally { setJoiningRoomId(null) }
  }

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selected || !text.trim()) return
    if (!user || !socketRef.current) return
    try { socketRef.current.emit('room-message', { roomId: selected.id, userId: user.id, content: text }); setText('') }
    catch (e) { setError(errorMessage(e)) }
  }

  const banMember = async (memberId: string) => {
    if (!selected) return
    try { await roomsApi.ban(selected.id, memberId); setMembers((current) => current.map((member) => member.userId === memberId ? { ...member, bannedAt: new Date().toISOString() } : member)) }
    catch (e) { setError(errorMessage(e)) }
  }

  const isMember = selected?.isMember ?? false
  const isCreator = selected?.createdBy === user?.id
  return (
    <main className="rooms-page">
      <header className="rooms-header"><div><Link href="/chat" className="rooms-brand">← Convo</Link><p className="rooms-kicker">Community rooms</p><h1>Find your people.</h1></div><Link href="/chat" className="rooms-back">Back to chat</Link></header>
      <div className="rooms-layout">
        <aside className="rooms-sidebar">
          <form className="create-room-form" onSubmit={createRoom}><div className="section-label">Create a room</div><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Room name" required /><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is it about?" /><button type="submit" disabled={isCreating}>{isCreating ? 'Creating...' : 'Create room'} <span>＋</span></button></form>
          <div className="room-directory"><div className="section-label">All rooms <span>{rooms.length}</span></div>{rooms.map((room) => <button type="button" key={room.id} className={`directory-room ${selected?.id === room.id ? 'active' : ''}`} onClick={() => { setSelected(room); setMembers([]) }}><span className="room-dot">#</span><span><b>{room.name}</b><small>{room.description || 'Open community room'}</small></span><em>{room._count.members}</em></button>)}</div>
        </aside>
        <section className="room-view">{selected ? <><header className="room-view-header"><div><p className="room-hash"># {selected.name}</p><h2>{selected.description || 'Open community room'}</h2></div>{!isMember && !isCreator && <button className="join-button" type="button" onClick={() => joinRoom(selected)} disabled={joiningRoomId === selected.id}>{joiningRoomId === selected.id ? 'Joining...' : 'Join room'}</button>}{isCreator && <span className="moderator-badge">Moderator</span>}</header>{isMember || isCreator ? <><div className="room-messages">{messages.length === 0 && <div className="room-empty"><span>✦</span><h3>Room is ready</h3><p>Start a conversation around {selected.name}.</p></div>}{messages.map((message) => <article className="room-message" key={message.id}><span className="room-message-avatar">{(message.user.name || message.user.email)[0].toUpperCase()}</span><div><div className="room-message-meta"><b>{message.user.name || message.user.email}</b><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>{isCreator && message.userId !== user?.id && <button type="button" onClick={() => banMember(message.userId)}>Ban</button>}</div><p>{message.content}</p></div></article>)}<div ref={endRef} /></div><form className="room-composer" onSubmit={sendMessage}><input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message #${selected.name}`} /><button type="submit" disabled={!text.trim()}>Send</button></form></> : <div className="join-empty"><span className="join-icon">#</span><h3>Join this room</h3><p>Everyone is welcome. Join to read and write messages.</p></div>}</> : <div className="join-empty"><span className="join-icon">✦</span><h3>Choose a room</h3><p>Explore a topic and join the conversation.</p></div>}</section>
        <aside className="members-panel">
          {selected && <>
            <div className="section-label">Members <span>{selected._count.members}</span></div>
            {members.length === 0 && <p className="members-hint">Join the room to see its members.</p>}
            {members.map((member) => <div className={`member-row ${member.bannedAt ? 'banned' : ''}`} key={member.id}>
              <span className="member-avatar">{(member.user.name || member.user.email)[0].toUpperCase()}</span>
              <span><b>{member.user.name || member.user.email}</b><small>{member.userId === selected.createdBy ? 'Room creator' : member.bannedAt ? 'Banned' : 'Member'}</small></span>
              {isCreator && member.userId !== user?.id && !member.bannedAt && <button type="button" onClick={() => banMember(member.userId)}>Ban</button>}
            </div>)}
          </>}
        </aside>
      </div>
      {error && <button className="rooms-toast" type="button" onClick={() => setError('')}>{error} ×</button>}
    </main>
  )
}
