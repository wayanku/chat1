/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Peer, DataConnection, MediaConnection } from 'peerjs';
import { 
  MessageSquare, 
  Users, 
  UserCircle, 
  Camera, 
  Search, 
  MoreVertical, 
  ArrowLeft, 
  Phone, 
  Video, 
  Paperclip, 
  Send, 
  Mic, 
  PhoneOff, 
  RefreshCw,
  LogOut,
  Plus,
  CheckCheck,
  Trash2,
  X,
  Edit3,
  User,
  ChevronRight,
  UserPlus,
  FileText,
  Download,
  Star,
  Smile,
  Moon,
  Palette,
  Heart,
  ThumbsUp,
  Laugh,
  Image as ImageIcon,
  Bell,
  Lock,
  HelpCircle,
  Shield,
  MicOff,
  Volume2,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { format } from 'date-fns';
import { Message, Profile, ChatHistory, Page, Status, Group } from './types';

const PREFIX = "STORYBALI_V1_";

export default function App() {
  // --- State ---
  const [myId, setMyId] = useState<string>(localStorage.getItem('my_id') || "");
  const [myProfile, setMyProfile] = useState<Profile>(
    JSON.parse(localStorage.getItem('my_profile') || '{"name": "User Baru", "avatar": "", "id": ""}')
  );
  const [chatHistory, setChatHistory] = useState<ChatHistory>(
    JSON.parse(localStorage.getItem('history') || '{}')
  );
  const [activePage, setActivePage] = useState<Page>('chats');
  const [currentChatPeer, setCurrentChatPeer] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!myId);
  const [typingStatus, setTypingStatus] = useState<boolean>(false);
  const [incomingCall, setIncomingCall] = useState<{ callerId: string; call: MediaConnection } | null>(null);
  const [activeCall, setActiveCall] = useState<MediaConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [friendIdInput, setFriendIdInput] = useState<string>("");
  const [messageInput, setMessageInput] = useState<string>("");
  const [searchChatQuery, setSearchChatQuery] = useState<string>("");
  const [isSearchingChat, setIsSearchingChat] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(localStorage.getItem('theme') as 'light' | 'dark' || 'dark');
  const [wallpaper, setWallpaper] = useState<string>(localStorage.getItem('wallpaper') || "");
  const [groups, setGroups] = useState<Group[]>(JSON.parse(localStorage.getItem('groups') || '[]'));
  const [contacts, setContacts] = useState<string[]>(JSON.parse(localStorage.getItem('contacts') || '[]'));
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);
  const [notifMode, setNotifMode] = useState<'all' | 'sound' | 'none'>(localStorage.getItem('notifMode') as any || 'all');
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statuses, setStatuses] = useState<Status[]>([
    { id: '1', userId: 'StoryBali', content: 'Selamat datang di StoryBali!', type: 'text', time: Date.now() },
    { id: '2', userId: 'Admin', content: 'https://picsum.photos/seed/bali/400/800', type: 'img', time: Date.now() - 100000 },
  ]);
  const [viewingStatus, setViewingStatus] = useState<Status | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMembers, setNewGroupMembers] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleCreateGroup = () => {
    if (!newGroupName) return;
    const members = newGroupMembers.split(",").map(m => m.trim()).filter(m => m !== "");
    createGroup(newGroupName, members);
    setNewGroupName("");
    setNewGroupMembers("");
    setIsCreatingGroup(false);
  };

  // --- Refs ---
  const peerRef = useRef<Peer | null>(null);
  const activeConnRef = useRef<DataConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const ringtoneRef = useRef<HTMLAudioElement>(null);
  const notifRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Persistence ---
  useEffect(() => {
    if (myId) localStorage.setItem('my_id', myId);
    localStorage.setItem('my_profile', JSON.stringify(myProfile));
    localStorage.setItem('history', JSON.stringify(chatHistory));
    localStorage.setItem('theme', theme);
    localStorage.setItem('wallpaper', wallpaper);
    localStorage.setItem('groups', JSON.stringify(groups));
    localStorage.setItem('contacts', JSON.stringify(contacts));
    localStorage.setItem('notifMode', notifMode);
  }, [myId, myProfile, chatHistory, theme, wallpaper, groups, contacts, notifMode]);

  // --- PeerJS Initialization ---
  const initPeer = useCallback((id: string) => {
    const peer = new Peer(PREFIX + id);
    peerRef.current = peer;

    peer.on('open', () => {
      console.log('Peer connected with ID:', id);
    });

    // Handle incoming data connections
    peer.on('connection', (conn) => { // This is for incoming connections from other peers
      const senderId = conn.peer.replace(PREFIX, '');
      conn.on('data', (data: any) => {
        handleIncomingData(senderId, data);
      });
      // Do NOT set activeConnRef.current here. It's for outgoing connections initiated by openChat.
    });

    peer.on('call', (call) => {
      const callerId = call.peer.replace(PREFIX, '');
      setIncomingCall({ callerId, call });
      ringtoneRef.current?.play().catch(() => {});
      
      // Native Notification for Call
      if (Notification.permission === "granted" && document.hidden) {
        new Notification(`Panggilan Masuk`, {
          body: `${callerId.toUpperCase()} sedang memanggil Anda...`,
          icon: `https://ui-avatars.com/api/?name=${callerId}&background=random`
        });
      }
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      if (err.type === 'unavailable-id') {
        setLoginError(`ID "${myId}" sudah digunakan atau tidak tersedia. Silakan coba ID lain.`);
        setIsLoggedIn(false); // Go back to login screen
        setMyId(""); // Clear the ID that caused the error
        peerRef.current?.destroy(); // Destroy the peer instance that failed
        peerRef.current = null;
      } else {
        setLoginError(`Terjadi kesalahan PeerJS: ${err.message}.`);
        setIsLoggedIn(false);
        setMyId("");
        peerRef.current?.destroy();
        peerRef.current = null;
      }
    });

    return () => {
      peer.destroy();
      peerRef.current = null; // Clear the ref when peer is destroyed
    };
  }, [myId, setLoginError, setIsLoggedIn, setMyId, handleIncomingData]); // Added dependencies

  useEffect(() => {
    if (isLoggedIn && myId) {
      initPeer(myId);
      
      // Auto-subscribe to push if permission already granted
      if ("Notification" in window && Notification.permission === "granted") {
        subscribeToPush(myId);
      }
      return cleanupPeer; // Return cleanup function
    }
  }, [isLoggedIn, myId, initPeer, subscribeToPush]); // Added subscribeToPush to dependencies

  // --- Status Logic ---
  const addStatus = (type: 'text' | 'img', content: string) => {
    const newStatus: Status = {
      id: Math.random().toString(36).substr(2, 9),
      userId: myId,
      content,
      type,
      time: Date.now()
    };
    setStatuses(prev => [newStatus, ...prev]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleStatusUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          addStatus('img', ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Auto Delete 24h & Status Expiry ---
  useEffect(() => {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    // Chat History Expiry
    let historyChanged = false;
    const newHistory = { ...chatHistory };
    for (const peerId in newHistory) {
      const originalLength = newHistory[peerId].length;
      newHistory[peerId] = newHistory[peerId].filter(msg => (now - msg.time) < ONE_DAY);
      if (newHistory[peerId].length !== originalLength) historyChanged = true;
      if (newHistory[peerId].length === 0) delete newHistory[peerId];
    }
    if (historyChanged) setChatHistory(newHistory);

    // Status Expiry
    setStatuses(prev => prev.filter(s => (now - s.time) < ONE_DAY));
  }, []);

  // --- Push Notifications ---
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeToPush = async (userId: string) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications are not supported in this browser.');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered');

      // Wait for SW to be ready
      await navigator.serviceWorker.ready;

      const response = await fetch('/api/push/vapid-public-key').catch(() => null);
      
      if (!response || !response.ok) {
        throw new Error("Server API tidak merespons. Pastikan server.ts berjalan.");
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Respon bukan JSON:", text);
        throw new Error("Format respon server salah.");
      }

      const { publicKey } = await response.json();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subscription })
      });

      setIsPushSubscribed(true);
      console.log('Push subscription successful');
    } catch (error) {
      console.error('Push subscription failed:', error);
    }
  };

  const sendPushAlert = async (targetUserId: string, title: string, body: string) => {
    try {
      await fetch('/api/push/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, title, body })
      });
    } catch (error) {
      console.error('Failed to send push alert:', error);
    }
  };

  // --- Handlers ---
  const handleIncomingData = (senderId: string, data: any) => {
    if (data.type === 'call-ended') {
      stopRingtone();
      endCall(false);
      return;
    }
    if (data.type === 'typing') {
      if (currentChatPeer === senderId) {
        setTypingStatus(data.content);
      }
      return;
    }
    if (data.type === 'reaction') {
      setChatHistory(prev => {
        const history = { ...prev };
        if (history[senderId]) {
          history[senderId] = history[senderId].map(m => {
            if (m.id === data.msgId) {
              const reactions = { ...m.reactions };
              if (!reactions[data.emoji]) reactions[data.emoji] = [];
              if (!reactions[data.emoji].includes(senderId)) {
                reactions[data.emoji] = [...reactions[data.emoji], senderId];
              }
              return { ...m, reactions };
            }
            return m;
          });
        }
        return history;
      });
      return;
    }
    if (data.type === 'read') {
      setChatHistory(prev => {
        const history = { ...prev };
        if (history[senderId]) {
          history[senderId] = history[senderId].map(m => {
            if (m.id === data.msgId) return { ...m, read: true };
            return m;
          });
        }
        return history;
      });
      return;
    }

    notifRef.current?.play().catch(() => {});
    
    // Native Notification
    if (Notification.permission === "granted" && document.hidden && notifMode === 'all') {
      let body = "";
      if (data.type === 'text') body = data.content;
      else if (data.type === 'img') body = "Mengirim foto";
      else if (data.type === 'voice') body = "Pesan suara";
      else if (data.type === 'file') {
        try {
          body = `File: ${JSON.parse(data.content).name}`;
        } catch {
          body = "Mengirim file";
        }
      }

      new Notification(`Pesan dari ${senderId.toUpperCase()}`, {
        body,
        icon: `https://ui-avatars.com/api/?name=${senderId}&background=random`
      });
    }
    
    setChatHistory(prev => {
      const history = { ...prev };
      const chatTargetId = data.groupId || senderId;
      if (!history[chatTargetId]) history[chatTargetId] = [];
      history[chatTargetId] = [...history[chatTargetId], {
        id: data.id || Math.random().toString(36).substr(2, 9),
        msg: data.content,
        type: data.type,
        side: 'in',
        time: Date.now(),
        read: true
      }];
      
      // Send read receipt back (only for private chats)
      if (!data.groupId && data.id && activeConnRef.current && activeConnRef.current.open) {
        activeConnRef.current.send({ type: 'read', msgId: data.id });
      }
      
      return history;
    });
  };

  // --- Audio Unlocking for iOS ---
  const unlockAudio = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.play().then(() => {
        ringtoneRef.current!.pause();
        ringtoneRef.current!.currentTime = 0;
      }).catch(() => {});
    }
    if (notifRef.current) {
      notifRef.current.play().then(() => {
        notifRef.current!.pause();
        notifRef.current!.currentTime = 0;
      }).catch(() => {});
    }
  };

  const login = (id: string) => {
    setLoginError(null); // Clear any previous login errors
    const cleanId = id.trim().toLowerCase();
    if (cleanId.length < 3) {
      setLoginError("ID harus memiliki minimal 3 karakter.");
      return;
    }
    unlockAudio(); // Unlock audio on first interaction
    setMyId(cleanId);
    setMyProfile({ name: cleanId, id: cleanId, avatar: myProfile.avatar || "" });
    setIsLoggedIn(true);
    
    // Request notification permission if supported
    if ("Notification" in window) {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          subscribeToPush(cleanId);
        }
      });
    }
  };

  const logout = () => {
    localStorage.clear();
    window.location.reload();
  };

  const [isPeerConnected, setIsPeerConnected] = useState<boolean>(false);

  const openChat = (pid: string) => {
    setCurrentChatPeer(pid);
    setIsPeerConnected(false);

    if (!pid.startsWith("GROUP_")) {
      const conn = peerRef.current?.connect(PREFIX + pid);
      if (conn) {
        activeConnRef.current = conn;
        conn.on('open', () => {
          console.log("Connected to " + pid);
          setIsPeerConnected(true);
        });
        conn.on('data', (data) => handleIncomingData(pid, data));
        conn.on('close', () => setIsPeerConnected(false));
      }
    } else {
      setIsPeerConnected(true);
    }
  };

  const deleteChat = (pid: string) => {
    setChatHistory(prev => {
      const history = { ...prev };
      delete history[pid];
      return history;
    });
    closeChat();
  };

  const clearMessages = (pid: string) => {
    setChatHistory(prev => ({ ...prev, [pid]: [] }));
  };

  const addContact = () => {
    const id = "UserBaru"; // Default ID for now
    if (id && id !== myId && !contacts.includes(id)) {
      setContacts(prev => [...prev, id]);
    }
  };

  const removeContact = (id: string) => {
    setContacts(prev => prev.filter(c => c !== id));
  };

  const addStatusPrompt = () => {
    addStatus('text', "Status baru!");
  };

  const closeChat = () => {
    setCurrentChatPeer(null);
    activeConnRef.current = null;
  };

  const createGroup = (name: string, members: string[]) => {
    const groupId = "GROUP_" + Math.random().toString(36).substr(2, 9);
    const newGroup: Group = {
      id: groupId,
      name,
      members: [...members, myId],
      admin: myId
    };
    setGroups(prev => [...prev, newGroup]);
    // Notify members? In a real app, yes. Here, we'll just add it locally.
    return groupId;
  };

  const sendMsg = (text: string, type: 'text' | 'img' | 'voice' | 'file' = 'text') => {
    if (!text.trim() || !currentChatPeer) return;
    
    const msgId = Math.random().toString(36).substr(2, 9);
    const isGroup = currentChatPeer.startsWith("GROUP_");
    
    if (isGroup) {
      const group = groups.find(g => g.id === currentChatPeer);
      if (group) {
        group.members.forEach(memberId => {
          if (memberId === myId) return;
          const conn = peerRef.current?.connect(PREFIX + memberId);
          conn?.on('open', () => {
            conn.send({ id: msgId, type, content: text, groupId: currentChatPeer });
          });
        });
      }
    } else {
      if (activeConnRef.current && activeConnRef.current.open) {
        activeConnRef.current.send({ id: msgId, type, content: text });
      } else {
        const pushMsg = type === 'text' ? text : (type === 'img' ? "Mengirim foto" : "Mengirim file");
        sendPushAlert(currentChatPeer, `Pesan dari ${myId.toUpperCase()}`, pushMsg);
      }
    }
    
    setChatHistory(prev => {
      const history = { ...prev };
      if (!history[currentChatPeer]) history[currentChatPeer] = [];
      history[currentChatPeer] = [...history[currentChatPeer], { 
        id: msgId, 
        msg: text, 
        type, 
        side: 'out', 
        time: Date.now(),
        read: isGroup ? true : false
      }];
      return history;
    });
  };

  const sendTypingStatus = (isTyping: boolean) => {
    if (activeConnRef.current) {
      activeConnRef.current.send({ type: 'typing', content: isTyping });
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setIsRecording(true);
      
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          if (currentChatPeer) {
            sendMsg(base64Audio, 'voice');
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
    } catch (err) { console.error("Izin Mic ditolak", err); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleStar = (peerId: string, msgId: string) => {
    setChatHistory(prev => {
      const history = { ...prev };
      if (history[peerId]) {
        history[peerId] = history[peerId].map(m => 
          m.id === msgId ? { ...m, starred: !m.starred } : m
        );
      }
      return history;
    });
  };

  const addReaction = (peerId: string, msgId: string, emoji: string) => {
    if (activeConnRef.current && activeConnRef.current.open) {
      activeConnRef.current.send({ type: 'reaction', msgId, emoji });
    }
    setChatHistory(prev => {
      const history = { ...prev };
      if (history[peerId]) {
        history[peerId] = history[peerId].map(m => {
          if (m.id === msgId) {
            const reactions = { ...m.reactions };
            if (!reactions[emoji]) reactions[emoji] = [];
            if (!reactions[emoji].includes(myId)) {
              reactions[emoji] = [...reactions[emoji], myId];
            }
            return { ...m, reactions };
          }
          return m;
        });
      }
      return history;
    });
  };

  // --- Call Handlers ---
  const startCall = async (type: 'voice' | 'video') => {
    if (!currentChatPeer) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true
      });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      
      const call = peerRef.current?.call(PREFIX + currentChatPeer, stream);
      if (call) {
        setActiveCall(call);
        handleCallEvents(call);
      }
    } catch (e) { console.error("Izin kamera/mic ditolak", e); }
  };

  const answerCall = async () => {
    if (!incomingCall) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stopRingtone();
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      
      incomingCall.call.answer(stream);
      setActiveCall(incomingCall.call);
      handleCallEvents(incomingCall.call);
      setIncomingCall(null);
    } catch (e) { console.error("Izin kamera/mic ditolak", e); }
  };

  const handleCallEvents = (call: MediaConnection) => {
    call.on('stream', (remote) => {
      setRemoteStream(remote);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
    });
    call.on('close', () => endCall(false));
  };

  const endCall = (notifyPeer = true) => {
    stopRingtone();
    if (notifyPeer && activeConnRef.current) {
      activeConnRef.current.send({ type: 'call-ended' });
    }
    
    activeCall?.close();
    localStream?.getTracks().forEach(t => t.stop());
    
    setActiveCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    setIncomingCall(null);
  };

  const stopRingtone = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
  };

  // --- Scroll to bottom ---
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, currentChatPeer]);

  // Lock overscroll behavior for PWA feel
  useEffect(() => {
    // Mencegah scroll pada body untuk menghindari efek bouncing di iOS
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.overflow = '';
      document.documentElement.style.overscrollBehavior = 'auto';
      document.body.style.overscrollBehavior = 'auto';
    };
  }, []);

  if (!isLoggedIn) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-8 z-[300] bg-wa-bg text-wa-text font-sans overflow-hidden select-none touch-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,#00a88433,transparent_70%)] pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-12 relative z-10"
        >
          <div className="w-24 h-24 bg-wa-primary rounded-[2rem] flex items-center justify-center mb-8 shadow-[0_20px_50px_rgba(0,168,132,0.3)] rotate-12">
            <MessageSquare className="text-white w-12 h-12 -rotate-12" />
          </div>
          <h1 className="text-4xl font-black mb-2 tracking-tight text-center leading-tight">
            StoryBali <span className="text-wa-primary">Cht</span>
          </h1>
          <p className="text-gray-500 text-sm text-center px-4 max-w-[280px]">
            Pesan pribadi Anda terenkripsi secara P2P. Aman, cepat, dan tanpa server.
          </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-xs flex flex-col gap-4 relative z-10"
        >
          <div className="relative">
            <input 
              id="my-id-input" 
              type="text" 
              placeholder="ID Unik Anda" 
              className="w-full bg-wa-surface p-5 rounded-2xl border border-white/5 outline-none focus:border-wa-primary transition-all text-center font-bold text-xl text-white placeholder:text-gray-600"
              onKeyDown={(e) => e.key === 'Enter' && login((e.target as HTMLInputElement).value)}
              onChange={(e) => {
                // Clear error when user starts typing again
                if (loginError) setLoginError(null);
                // No need to update myId state here, it's handled by login function
              }}
            />
            {loginError && (
              <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-rose-400 text-xs text-center mt-2 font-medium">
                {loginError}
              </motion.p>
            )}
          </div>
          <button 
            onClick={() => login((document.getElementById('my-id-input') as HTMLInputElement).value)}
            className="w-full bg-wa-primary p-5 rounded-2xl font-bold shadow-lg active:scale-95 transition text-white text-lg"
          >
            Mulai Percakapan
          </button>
          
          <div className="mt-4 p-4 bg-wa-surface/50 rounded-2xl border border-wa-primary/10 text-[11px] text-gray-400 text-center backdrop-blur-sm">
            <p className="font-bold text-wa-primary mb-1 uppercase tracking-wider">Tips iPhone:</p>
            Tambahkan ke <span className="text-white font-semibold">"Home Screen"</span> untuk pengalaman aplikasi yang lebih lancar dan notifikasi latar belakang.
          </div>
        </motion.div>
        
        <div className="absolute bottom-10 text-[10px] text-gray-600 uppercase tracking-[0.3em] font-bold">
          Powered by StoryBali
        </div>
      </div>
    );
  }

  const switchCamera = async () => {
    if (!localStream || !activeCall) return;
    const currentTrack = localStream.getVideoTracks()[0];
    const currentFacingMode = currentTrack.getSettings().facingMode;
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: true
      });

      const videoTrack = newStream.getVideoTracks()[0];
      const sender = activeCall.peerConnection.getSenders().find(s => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(videoTrack);
      
      localStream.getVideoTracks()[0].stop();
      setLocalStream(newStream);
      if (localVideoRef.current) localVideoRef.current.srcObject = newStream;
    } catch (e) {
      console.error("Failed to switch camera", e);
    }
  };

  return (
    <div className={cn("fixed inset-0 h-[100dvh] w-screen flex flex-col bg-wa-bg text-wa-text font-sans overflow-hidden select-none touch-none transition-colors duration-500", theme)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#00a88411,transparent_50%)] pointer-events-none" />
      <audio id="ringtone" ref={ringtoneRef} loop src="https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3" />
      <audio id="notif-chat" ref={notifRef} src="https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3" />

      {/* Header */}
      <header className="h-20 flex items-center justify-between px-6 bg-wa-bg/80 backdrop-blur-xl border-b border-white/5 shrink-0 z-[100] safe-top touch-none">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-wa-primary tracking-tighter leading-none">STORYBALI</h2>
          <span className="text-[10px] font-bold text-gray-500 tracking-[0.2em] mt-1">SECURE P2P CHAT</span>
        </div>
        <div className="flex gap-5 text-gray-400">
          <div className="p-2.5 bg-white/5 rounded-2xl hover:text-white transition-all cursor-pointer"><Search className="w-5 h-5" /></div>
          <div className="p-2.5 bg-white/5 rounded-2xl hover:text-white transition-all cursor-pointer"><MoreVertical className="w-5 h-5" /></div>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-grow overflow-y-auto pb-32 relative overscroll-contain touch-pan-y scroll-smooth">
        <AnimatePresence mode="wait">
          {activePage === 'chats' && (
            <motion.div 
              key="chats"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex flex-col pb-32"
            >
              {/* Status Section */}
              <div className="p-4 flex gap-4 overflow-x-auto no-scrollbar border-b border-white/5 mb-2 bg-wa-surface/20">
                <div className="flex flex-col items-center gap-2 shrink-0 group">
                  <div 
                    className="w-16 h-16 rounded-[1.5rem] border-2 border-dashed border-wa-primary p-1 relative cursor-pointer group-hover:rotate-6 transition-all"
                    onClick={addStatusPrompt}
                  >
                    <img src={myProfile.avatar || `https://ui-avatars.com/api/?name=${myId}&background=00a884&color=fff`} className="w-full h-full rounded-[1.2rem] object-cover" alt="My Status" />
                    <div className="absolute -bottom-1 -right-1 bg-wa-primary rounded-xl p-1.5 border-2 border-wa-bg shadow-lg">
                      <Plus className="w-3 h-3 text-white" />
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Status Saya</span>
                </div>
                {statuses.map(s => (
                  <div 
                    key={s.id} 
                    className="flex flex-col items-center gap-2 shrink-0 cursor-pointer group"
                    onClick={() => setViewingStatus(s)}
                  >
                    <div className="w-16 h-16 rounded-[1.5rem] border-2 border-wa-primary p-1 group-hover:scale-105 transition-transform shadow-lg shadow-wa-primary/10">
                      <img src={`https://ui-avatars.com/api/?name=${s.userId}&background=random`} className="w-full h-full rounded-[1.2rem] object-cover" alt={s.userId} />
                    </div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter truncate w-16 text-center">{s.userId}</span>
                  </div>
                ))}
              </div>

              {/* Search Bar & Create Group */}
              <div className="px-4 py-3 flex gap-3">
                <div className="bg-wa-surface/50 backdrop-blur-md rounded-[2rem] flex items-center px-6 py-4 gap-3 border border-white/5 flex-grow focus-within:border-wa-primary/30 transition-all shadow-sm">
                  <Search className="w-5 h-5 text-gray-500" />
                  <input 
                    type="text" 
                    placeholder="Cari chat atau pesan..." 
                    className="bg-transparent flex-grow outline-none text-base text-white placeholder:text-gray-600 font-medium"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button 
                  onClick={() => setIsCreatingGroup(true)}
                  className="p-4 bg-wa-primary text-white rounded-[1.5rem] shadow-xl shadow-wa-primary/30 hover:scale-105 active:scale-95 transition-all"
                >
                  <Users className="w-6 h-6" />
                </button>
              </div>

              <div className="divide-y divide-white/5">
                {/* Groups Section */}
                {groups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase())).map(group => {
                  const lastChat = chatHistory[group.id]?.[chatHistory[group.id].length - 1];
                  return (
                    <motion.div 
                      key={group.id}
                      layout
                      className="group flex items-center gap-4 p-4 mx-2 my-1 rounded-3xl hover:bg-wa-surface/60 cursor-pointer transition active:bg-wa-surface relative"
                    >
                      <div className="relative shrink-0" onClick={() => openChat(group.id)}>
                        <img src={`https://ui-avatars.com/api/?name=${group.name}&background=00a884&color=fff`} className="w-14 h-14 rounded-2xl shadow-md" alt={group.name} />
                      </div>
                      <div className="flex-grow min-w-0" onClick={() => openChat(group.id)}>
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="font-bold text-base truncate text-white">{group.name}</h4>
                          {lastChat && (
                            <span className="text-[11px] text-gray-500 font-bold">{format(lastChat.time, 'HH:mm')}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm text-gray-500 truncate font-medium">
                            {lastChat ? (
                              lastChat.type === 'img' ? '📷 Foto' : (lastChat.type === 'voice' ? '🎤 Pesan Suara' : lastChat.msg)
                            ) : `${group.members.length} Anggota`}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteChat(group.id); }}
                        className="opacity-0 group-hover:opacity-100 p-2.5 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  );
                })}

                {/* Personal Chats Section */}
                {Object.keys(chatHistory)
                  .filter(pid => !pid.startsWith("GROUP_") && pid.toLowerCase().includes(searchQuery.toLowerCase()))
                  .sort((a, b) => {
                    const lastA = chatHistory[a][chatHistory[a].length - 1].time;
                    const lastB = chatHistory[b][chatHistory[b].length - 1].time;
                    return lastB - lastA;
                  }).map(pid => {
                    const lastChat = chatHistory[pid][chatHistory[pid].length - 1];
                    return (
                      <motion.div 
                        key={pid}
                        layout
                        className="group flex items-center gap-4 p-4 mx-2 my-1 rounded-3xl hover:bg-wa-surface/60 cursor-pointer transition active:bg-wa-surface relative"
                      >
                        <div className="relative shrink-0" onClick={() => openChat(pid)}>
                          <img src={`https://ui-avatars.com/api/?name=${pid}&background=random`} className="w-14 h-14 rounded-2xl shadow-md" alt={pid} />
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-wa-bg rounded-full shadow-sm" />
                        </div>
                        <div className="flex-grow min-w-0" onClick={() => openChat(pid)}>
                          <div className="flex justify-between items-center mb-1">
                            <h4 className="font-bold text-base truncate text-white">{pid.toUpperCase()}</h4>
                            <span className="text-[11px] text-gray-500 font-bold">{format(lastChat.time, 'HH:mm')}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {lastChat.side === 'out' && (
                              <CheckCheck className="w-3.5 h-3.5 text-wa-primary" />
                            )}
                            <p className="text-sm text-gray-500 truncate font-medium">
                              {lastChat.type === 'img' ? '📷 Foto' : (lastChat.type === 'voice' ? '🎤 Pesan Suara' : lastChat.msg)}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteChat(pid); }}
                          className="opacity-0 group-hover:opacity-100 p-2.5 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    );
                  })
                }
                
                {Object.keys(chatHistory).length === 0 && groups.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                    <div className="w-20 h-20 bg-wa-surface rounded-full flex items-center justify-center mb-6 opacity-20">
                      <MessageSquare className="w-10 h-10" />
                    </div>
                    <p className="text-sm font-bold uppercase tracking-widest opacity-40">Belum ada percakapan</p>
                  </div>
                )}
              </div>

              {/* Group Creation Modal */}
              <AnimatePresence>
                {isCreatingGroup && (
                  <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="w-full max-w-sm glass rounded-3xl p-6 border border-white/10 shadow-2xl"
                    >
                      <h3 className="text-xl font-black mb-6">Buat Grup Baru</h3>
                      <div className="space-y-5">
                        <div>
                          <label className="text-[10px] font-black text-wa-primary uppercase tracking-widest mb-2 block">Nama Grup</label>
                          <input 
                            type="text" 
                            className="w-full bg-wa-surface rounded-xl p-4 outline-none border border-white/5 text-sm font-medium focus:border-wa-primary/30 transition-colors"
                            placeholder="Contoh: Keluarga"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-wa-primary uppercase tracking-widest mb-2 block">Anggota (ID, pisahkan koma)</label>
                          <input 
                            type="text" 
                            className="w-full bg-wa-surface rounded-xl p-4 outline-none border border-white/5 text-sm font-medium focus:border-wa-primary/30 transition-colors"
                            placeholder="user1, user2, user3"
                            value={newGroupMembers}
                            onChange={(e) => setNewGroupMembers(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-3 pt-4">
                          <button 
                            onClick={() => setIsCreatingGroup(false)}
                            className="flex-grow p-4 rounded-2xl bg-white/5 hover:bg-white/10 font-bold text-sm transition-all active:scale-95"
                          >
                            Batal
                          </button>
                          <button 
                            onClick={handleCreateGroup}
                            className="flex-grow p-4 rounded-2xl bg-wa-primary hover:bg-wa-primary/80 text-white font-bold text-sm transition-all active:scale-95 shadow-lg shadow-wa-primary/20"
                          >
                            Buat Grup
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activePage === 'status' && (
            <motion.div 
              key="status"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="p-6 flex flex-col gap-8 pb-32"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black tracking-tight">STATUS</h2>
                <div className="flex gap-2">
                  <label className="p-3 bg-wa-primary/10 text-wa-primary rounded-2xl cursor-pointer hover:bg-wa-primary/20 transition-all active:scale-95">
                    <Camera className="w-6 h-6" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleStatusUpload} />
                  </label>
                  <button 
                    onClick={() => {
                      addStatus('text', "Status baru dari saya!");
                    }}
                    className="p-3 bg-wa-primary/10 text-wa-primary rounded-2xl hover:bg-wa-primary/20 transition-all active:scale-95"
                  >
                    <Edit3 className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-3xl transition-colors cursor-pointer group" onClick={() => {
                  const myStatus = statuses.find(s => s.userId === myId);
                  if (myStatus) setViewingStatus(myStatus);
                }}>
                  <div className="relative">
                    <div className={cn(
                      "w-16 h-16 rounded-full p-1",
                      statuses.some(s => s.userId === myId) ? "border-2 border-wa-primary" : "border-2 border-dashed border-gray-600"
                    )}>
                      <img src={myProfile.avatar || `https://ui-avatars.com/api/?name=${myId}&background=00a884&color=fff`} className="w-full h-full rounded-full object-cover shadow-md" alt="My Status" />
                    </div>
                    <div className="absolute bottom-0 right-0 bg-wa-primary rounded-full p-1 border-2 border-wa-bg shadow-lg">
                      <Plus className="w-3 h-3 text-white" />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-white">Status Saya</h4>
                    <p className="text-xs text-gray-500 font-medium">Ketuk untuk menambahkan status</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest px-2">Pembaruan Terbaru</p>
                  <div className="flex flex-col gap-2">
                    {statuses.filter(s => s.userId !== myId).map(s => (
                      <div 
                        key={s.id} 
                        className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-3xl transition-colors cursor-pointer group"
                        onClick={() => setViewingStatus(s)}
                      >
                        <div className="w-16 h-16 rounded-full border-2 border-wa-primary p-1 group-hover:scale-105 transition-transform">
                          <img src={`https://ui-avatars.com/api/?name=${s.userId}&background=random`} className="w-full h-full rounded-full object-cover shadow-md" alt={s.userId} />
                        </div>
                        <div className="flex-grow">
                          <h4 className="font-bold text-base text-white">{s.userId}</h4>
                          <p className="text-xs text-gray-500 font-medium">{format(s.time, 'HH:mm')}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-gray-400 transition-colors" />
                      </div>
                    ))}
                    {statuses.filter(s => s.userId !== myId).length === 0 && (
                      <div className="p-8 text-center opacity-20">
                        <p className="text-sm font-bold uppercase tracking-widest">Tidak ada status baru</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activePage === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-6 flex flex-col gap-8 pb-32"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <img 
                    src={myProfile.avatar || `https://ui-avatars.com/api/?name=${myId}&background=00a884&color=fff`} 
                    className="w-32 h-32 rounded-3xl object-cover border-4 border-wa-surface shadow-2xl" 
                    alt="Profile"
                  />
                  <label className="absolute -bottom-2 -right-2 bg-wa-primary p-3 rounded-2xl cursor-pointer shadow-lg border-4 border-wa-bg hover:scale-110 transition-all active:scale-95">
                    <Camera className="text-white w-5 h-5" />
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => setMyProfile(p => ({ ...p, avatar: ev.target?.result as string }));
                          reader.readAsDataURL(file);
                        }
                      }} 
                    />
                  </label>
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-black">{myProfile.name}</h3>
                  <div className="flex items-center gap-2 justify-center text-gray-500 font-medium text-sm">
                    <span>@{myId}</span>
                    <button onClick={() => copyToClipboard(myId)} className="p-1 hover:bg-white/5 rounded-lg transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="bg-wa-surface p-5 rounded-3xl border border-white/5 space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-wa-primary" />
                      <p className="text-sm font-bold text-white">Nama Tampilan</p>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        className="bg-wa-bg/50 flex-grow rounded-xl p-3 outline-none border border-white/5 text-sm font-medium"
                        value={myProfile.name}
                        onChange={(e) => setMyProfile(p => ({ ...p, name: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-wa-primary" />
                      <p className="text-sm font-bold text-white">Notifikasi Push</p>
                    </div>
                    <button 
                      onClick={() => {
                        if (!isPushSubscribed) {
                          Notification.requestPermission().then(permission => {
                            if (permission === "granted") subscribeToPush(myId);
                          });
                        }
                      }}
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative",
                        isPushSubscribed ? "bg-wa-primary" : "bg-gray-600"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                        isPushSubscribed ? "right-1" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Volume2 className="w-5 h-5 text-wa-primary" />
                      <p className="text-sm font-bold text-white">Mode Notifikasi</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'all', label: 'Semua' },
                        { id: 'sound', label: 'Suara' },
                        { id: 'none', label: 'Mati' }
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          onClick={() => setNotifMode(mode.id as any)}
                          className={cn(
                            "py-2 px-1 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border",
                            notifMode === mode.id 
                              ? "bg-wa-primary/20 border-wa-primary text-wa-primary" 
                              : "bg-wa-bg/50 border-white/5 text-gray-500"
                          )}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-500 italic">
                      *Mode "Suara" hanya akan membunyikan notifikasi tanpa memunculkan banner di layar.
                    </p>
                    <button 
                      onClick={() => {
                        notifRef.current?.play();
                        if (notifMode === 'all') {
                          new Notification("Tes Notifikasi", { body: "Ini adalah tes suara dan visual" });
                        }
                      }}
                      className="w-full py-2 bg-wa-primary/10 text-wa-primary rounded-xl text-[10px] font-bold uppercase hover:bg-wa-primary/20 transition-all"
                    >
                      Tes Notifikasi
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Moon className="w-5 h-5 text-wa-primary" />
                      <p className="text-sm font-bold text-white">Mode Gelap</p>
                    </div>
                    <button 
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative",
                        theme === 'dark' ? "bg-wa-primary" : "bg-gray-600"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                        theme === 'dark' ? "right-1" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Palette className="w-5 h-5 text-wa-primary" />
                      <p className="text-sm font-bold text-white">Wallpaper Chat</p>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {["", "https://picsum.photos/seed/1/800/1200", "https://picsum.photos/seed/2/800/1200", "https://picsum.photos/seed/3/800/1200", "https://picsum.photos/seed/4/800/1200"].map((url, idx) => (
                        <div 
                          key={idx}
                          onClick={() => setWallpaper(url)}
                          className={cn(
                            "w-16 h-24 rounded-xl border-2 shrink-0 cursor-pointer overflow-hidden bg-wa-surface",
                            wallpaper === url ? "border-wa-primary" : "border-transparent"
                          )}
                        >
                          {url ? <img src={url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded51.png')] bg-cover" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-wa-surface p-2 rounded-3xl border border-white/5 overflow-hidden">
                  {[
                    { icon: Bell, label: "Notifikasi", color: "text-blue-500" },
                    { icon: Lock, label: "Privasi & Keamanan", color: "text-emerald-500" },
                    { icon: Shield, label: "Akun", color: "text-amber-500" },
                    { icon: HelpCircle, label: "Bantuan", color: "text-purple-500" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors cursor-pointer group">
                      <div className={cn("p-2.5 rounded-xl bg-wa-bg/50", item.color)}>
                        <item.icon className="w-5 h-5" />
                      </div>
                      <span className="flex-grow font-bold text-sm">{item.label}</span>
                      <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-gray-400 transition-colors" />
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => {
                    localStorage.clear();
                    window.location.reload();
                  }}
                  className="w-full p-5 bg-rose-500/10 text-rose-500 rounded-3xl font-black text-sm flex items-center justify-center gap-3 hover:bg-rose-500/20 transition-all active:scale-95 border border-rose-500/20"
                >
                  <LogOut className="w-5 h-5" /> KELUAR DARI AKUN
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full glass border-t border-white/5 flex justify-around items-center px-2 shrink-0 z-[100] safe-bottom h-16">
        <div 
          onClick={() => setActivePage('chats')} 
          className={cn(
            "flex flex-col items-center cursor-pointer transition-all px-3 py-1.5 rounded-xl",
            activePage === 'chats' ? "text-wa-primary bg-wa-primary/10" : "text-gray-500 hover:text-gray-300"
          )}
        >
          <MessageSquare className="w-5 h-5 mb-0.5" />
          <span className="text-[9px] font-bold uppercase tracking-tighter">Chat</span>
        </div>
        <div 
          onClick={() => setActivePage('status')} 
          className={cn(
            "flex flex-col items-center cursor-pointer transition-all px-3 py-1.5 rounded-xl",
            activePage === 'status' ? "text-wa-primary bg-wa-primary/10" : "text-gray-500 hover:text-gray-300"
          )}
        >
          <Camera className="w-5 h-5 mb-0.5" />
          <span className="text-[9px] font-bold uppercase tracking-tighter">Status</span>
        </div>
        <div 
          onClick={() => setActivePage('contacts')} 
          className={cn(
            "flex flex-col items-center cursor-pointer transition-all px-3 py-1.5 rounded-xl",
            activePage === 'contacts' ? "text-wa-primary bg-wa-primary/10" : "text-gray-500 hover:text-gray-300"
          )}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span className="text-[9px] font-bold uppercase tracking-tighter">Kontak</span>
        </div>
        <div 
          onClick={() => setActivePage('profile')} 
          className={cn(
            "flex flex-col items-center cursor-pointer transition-all px-3 py-1.5 rounded-xl",
            activePage === 'profile' ? "text-wa-primary bg-wa-primary/10" : "text-gray-500 hover:text-gray-300"
          )}
        >
          <UserCircle className="w-5 h-5 mb-0.5" />
          <span className="text-[9px] font-bold uppercase tracking-tighter">Profil</span>
        </div>
      </nav>

      {/* Chat Room Window */}
      <AnimatePresence>
        {currentChatPeer && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-[#0b141a] z-[150] flex flex-col"
          >
            <header className="h-20 bg-wa-bg/90 backdrop-blur-2xl flex items-center px-4 gap-3 border-b border-white/5 shrink-0 z-[100] safe-top select-none touch-none">
              <div className="p-2 hover:bg-white/5 rounded-2xl transition-all cursor-pointer active:scale-90" onClick={() => closeChat()}>
                <ArrowLeft className="w-5 h-5 text-gray-400 hover:text-white" />
              </div>
              {!isSearchingChat ? (
                <>
                  <div className="relative shrink-0">
                    <img 
                      src={currentChatPeer.startsWith("GROUP_") 
                        ? `https://ui-avatars.com/api/?name=${groups.find(g => g.id === currentChatPeer)?.name}&background=00a884&color=fff`
                        : `https://ui-avatars.com/api/?name=${currentChatPeer}&background=random`
                      } 
                      className="w-11 h-11 rounded-[1.2rem] shadow-lg border border-white/5" 
                      alt={currentChatPeer} 
                    />
                    {isPeerConnected && !currentChatPeer.startsWith("GROUP_") && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-wa-bg rounded-full shadow-sm" />
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <h3 className="font-black text-base truncate leading-tight text-white">
                      {currentChatPeer.startsWith("GROUP_") 
                        ? groups.find(g => g.id === currentChatPeer)?.name 
                        : currentChatPeer.toUpperCase()
                      }
                    </h3>
                    <p className={cn("text-[9px] font-black uppercase tracking-widest mt-0.5", isPeerConnected ? "text-wa-primary" : "text-gray-500")}>
                      {currentChatPeer.startsWith("GROUP_") 
                        ? `${groups.find(g => g.id === currentChatPeer)?.members.length} Anggota`
                        : (typingStatus ? "Sedang mengetik..." : (isPeerConnected ? "Online" : "Menghubungkan..."))
                      }
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex-grow flex items-center bg-white/5 rounded-[1.2rem] px-4 py-2 border border-white/5 focus-within:border-wa-primary/30 transition-all">
                  <Search className="w-4 h-4 text-gray-500 mr-2" />
                  <input 
                    autoFocus
                    placeholder="Cari pesan..." 
                    className="bg-transparent outline-none text-sm text-white w-full font-medium"
                    value={searchChatQuery}
                    onChange={(e) => setSearchChatQuery(e.target.value)}
                  />
                  <X className="w-3.5 h-3.5 text-gray-500 cursor-pointer hover:text-white transition-colors" onClick={() => { setIsSearchingChat(false); setSearchChatQuery(""); }} />
                </div>
              )}
              <div className="flex gap-1 text-gray-400 items-center">
                {!isSearchingChat && (
                  <>
                    <div className="p-2.5 hover:bg-white/5 rounded-2xl transition-all cursor-pointer active:scale-90" onClick={() => setIsSearchingChat(true)}>
                      <Search className="w-5 h-5" />
                    </div>
                    <div className="p-2.5 hover:bg-white/5 rounded-2xl transition-all cursor-pointer active:scale-90" onClick={() => startCall('voice')}>
                      <Phone className="w-5 h-5" />
                    </div>
                    <div className="p-2.5 hover:bg-white/5 rounded-2xl transition-all cursor-pointer active:scale-90" onClick={() => startCall('video')}>
                      <Video className="w-5 h-5" />
                    </div>
                  </>
                )}
                <div className="relative group">
                  <div className="p-2 hover:bg-white/5 rounded-lg transition-all cursor-pointer active:scale-90">
                    <MoreVertical className="w-4.5 h-4.5" />
                  </div>
                  <div className="absolute right-0 top-full mt-2 w-56 glass rounded-3xl shadow-2xl border border-white/10 hidden group-hover:block z-[200] overflow-hidden backdrop-blur-2xl">
                    <button 
                      onClick={() => clearMessages(currentChatPeer)}
                      className="w-full text-left p-4 hover:bg-white/10 text-white flex items-center gap-3 text-sm font-black transition-colors border-b border-white/5"
                    >
                      <RefreshCw className="w-4 h-4 text-wa-primary" /> BERSIHKAN PESAN
                    </button>
                    <button 
                      onClick={() => deleteChat(currentChatPeer)}
                      className="w-full text-left p-4 hover:bg-white/10 text-rose-500 flex items-center gap-3 text-sm font-black transition-colors"
                    >
                      <Trash2 className="w-4 h-4" /> HAPUS CHAT
                    </button>
                  </div>
                </div>
              </div>
            </header>
            
            <div 
              className="flex-grow overflow-y-auto p-6 flex flex-col gap-4 bg-fixed overscroll-contain touch-pan-y scroll-smooth"
              style={{ 
                backgroundImage: wallpaper ? `url(${wallpaper})` : "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded51.png')",
                backgroundSize: 'cover',
                backgroundBlendMode: 'overlay'
              }}
              onClick={() => { setShowAttachMenu(false); setShowEmojiPicker(false); }}
            >
              {chatHistory[currentChatPeer]?.filter(m => 
                m.type === 'text' ? m.msg.toLowerCase().includes(searchChatQuery.toLowerCase()) : true
              ).map((m, i) => (
                <motion.div 
                  key={m.id || i} 
                  initial={{ opacity: 0, scale: 0.95, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className={cn(
                    "p-4 max-w-[85%] shadow-xl relative group/msg transition-all",
                    m.side === 'in' 
                      ? "bg-wa-surface/90 backdrop-blur-md rounded-[1.8rem] rounded-tl-none self-start" 
                      : "bg-wa-primary rounded-[1.8rem] rounded-tr-none self-end text-white shadow-wa-primary/20"
                  )}
                >
                  <div className="absolute -top-10 left-0 right-0 hidden group-hover/msg:flex justify-center gap-2 z-10 select-none">
                    <div className="bg-wa-surface border border-white/10 rounded-full px-3 py-1.5 flex gap-3 shadow-2xl backdrop-blur-xl">
                      <ThumbsUp className="w-4 h-4 text-yellow-500 cursor-pointer hover:scale-125 transition" onClick={() => addReaction(currentChatPeer, m.id, '👍')} />
                      <Heart className="w-4 h-4 text-rose-500 cursor-pointer hover:scale-125 transition" onClick={() => addReaction(currentChatPeer, m.id, '❤️')} />
                      <Laugh className="w-4 h-4 text-orange-500 cursor-pointer hover:scale-125 transition" onClick={() => addReaction(currentChatPeer, m.id, '😂')} />
                      <Star 
                        className={cn("w-4 h-4 cursor-pointer hover:scale-125 transition", m.starred ? "text-yellow-400 fill-yellow-400" : "text-gray-400")} 
                        onClick={() => toggleStar(currentChatPeer, m.id)} 
                      />
                    </div>
                  </div>

                  {m.starred && (
                    <Star className="absolute -top-1 -right-1 w-3 h-3 text-yellow-400 fill-yellow-400" />
                  )}

                  {m.type === 'text' && <p className="text-[15px] leading-relaxed font-medium">{m.msg}</p>}
                  {m.type === 'img' && (
                    <div className="rounded-xl overflow-hidden mb-1">
                      <img src={m.msg} className="w-full h-auto max-h-80 object-cover" alt="Sent" />
                    </div>
                  )}
                  {m.type === 'file' && (
                    <div className="flex items-center gap-3 py-1 min-w-[150px]">
                      <div className="bg-white/10 p-2.5 rounded-2xl">
                        <FileText className="w-6 h-6 text-wa-primary" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="text-xs font-bold truncate text-white">
                          {(() => {
                            try {
                              return JSON.parse(m.msg).name;
                            } catch {
                              return "File";
                            }
                          })()}
                        </p>
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Dokumen</p>
                      </div>
                      <button 
                        onClick={() => {
                          try {
                            const { name, data } = JSON.parse(m.msg);
                            const link = document.createElement('a');
                            link.href = data;
                            link.download = name;
                            link.click();
                          } catch (e) {
                            console.error("Failed to download file", e);
                          }
                        }}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors"
                      >
                        <Download className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  )}
                  {m.type === 'voice' && (
                    <div className="flex items-center gap-3 py-1 min-w-[150px]">
                      <button 
                        onClick={() => {
                          const audio = new Audio(m.msg);
                          audio.play();
                        }}
                        className="bg-white/10 p-2.5 rounded-full hover:bg-white/20 transition-colors"
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                      <div className="h-1 flex-grow bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-wa-primary w-1/3" />
                      </div>
                      <span className="text-[10px] text-gray-400 font-bold">0:05</span>
                    </div>
                  )}

                  {m.reactions && Object.keys(m.reactions).length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {Object.entries(m.reactions).map(([emoji, users]) => (
                        <div key={emoji} className="bg-white/10 rounded-full px-2 py-0.5 text-[10px] flex items-center gap-1">
                          <span>{emoji === '👍' ? '👍' : emoji === '❤️' ? '❤️' : '😂'}</span>
                          <span className="text-gray-400 font-bold">{(users as string[]).length}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-1 mt-1.5">
                    <span className="text-[9px] text-gray-400 font-bold">{format(m.time, 'HH:mm')}</span>
                    {m.side === 'out' && (
                      <CheckCheck className={cn("w-3 h-3", m.read ? "text-wa-primary" : "text-gray-500")} />
                    )}
                  </div>
                </motion.div>
              ))}
              <div ref={chatEndRef} />
            </div>
            
            <footer className="p-2 pb-8 md:pb-4 bg-wa-bg/95 backdrop-blur-3xl border-t border-white/5 shrink-0 z-[100] select-none">
              <div className="flex items-end gap-1.5 max-w-4xl mx-auto">
                <div className="flex gap-1 mb-0.5">
                  <div className="relative">
                    <button 
                      onClick={() => setShowAttachMenu(!showAttachMenu)}
                      className={cn(
                        "p-2.5 rounded-2xl transition-all active:scale-90 shadow-lg",
                        showAttachMenu ? "bg-wa-primary text-white" : "bg-wa-surface text-gray-400"
                      )}
                    >
                      <Paperclip className="w-4.5 h-4.5" />
                    </button>
                    
                    <AnimatePresence>
                      {showAttachMenu && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.9 }}
                          className="absolute bottom-full left-0 mb-4 flex flex-col gap-3 z-[200]"
                        >
                          <label className="p-3 bg-emerald-500 text-white rounded-full cursor-pointer shadow-xl hover:scale-110 active:scale-95 transition-all">
                            <ImageIcon className="w-5 h-5" />
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => { sendMsg(ev.target?.result as string, 'img'); setShowAttachMenu(false); };
                                reader.readAsDataURL(file);
                              }
                            }} />
                          </label>
                          <label className="p-4 bg-blue-500 text-white rounded-2xl cursor-pointer shadow-xl hover:scale-110 active:scale-95 transition-all">
                            <FileText className="w-5 h-5" />
                            <input type="file" className="hidden" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => { sendMsg(JSON.stringify({ name: file.name, data: ev.target?.result }), 'file'); setShowAttachMenu(false); };
                                reader.readAsDataURL(file);
                              }
                            }} />
                          </label>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button 
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-2.5 bg-wa-surface rounded-2xl text-gray-400 hover:text-yellow-500 transition-all active:scale-90 shadow-lg"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-grow min-w-0 bg-wa-surface/50 backdrop-blur-xl rounded-[1.8rem] border border-white/5 flex items-end px-3 py-2.5 focus-within:border-wa-primary/30 transition-all shadow-inner">
                  <textarea 
                    rows={1}
                    placeholder="Ketik pesan..." 
                    className="bg-transparent flex-grow outline-none text-[15px] text-white py-0.5 resize-none max-h-32 font-medium placeholder:text-gray-600"
                    value={messageInput}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (messageInput.trim()) {
                          sendMsg(messageInput);
                          setMessageInput("");
                          sendTypingStatus(false);
                        }
                      }
                    }}
                    onChange={(e) => {
                      setMessageInput(e.target.value);
                      sendTypingStatus(e.target.value.length > 0);
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                  />
                </div>

                <div className="flex gap-2 mb-0.5">
                  <button 
                    onMouseDown={startRecording} 
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    className={cn(
                      "p-3.5 rounded-[1.2rem] transition-all shadow-xl active:scale-90",
                      isRecording ? "bg-rose-500 shadow-rose-500/30" : "bg-wa-surface/50 text-gray-400 hover:text-wa-primary"
                    )}
                  >
                    <Mic className={cn("w-5 h-5", isRecording ? "text-white animate-pulse" : "")} />
                  </button>

                  <button 
                    onClick={() => {
                      if (messageInput.trim()) {
                        sendMsg(messageInput);
                        setMessageInput("");
                        sendTypingStatus(false);
                      }
                    }}
                    className={cn(
                      "p-3.5 rounded-[1.2rem] transition-all shadow-xl active:scale-90",
                      messageInput.trim() ? "bg-wa-primary text-white shadow-wa-primary/40" : "bg-wa-surface/50 text-gray-600 opacity-50"
                    )}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Viewer Overlay */}
      <AnimatePresence>
        {viewingStatus && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 bg-black z-[300] flex flex-col"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 z-[310] safe-top">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 5, ease: 'linear' }}
                onAnimationComplete={() => setViewingStatus(null)}
                className="h-full bg-white"
              />
            </div>
            
            <header className="absolute top-4 left-0 right-0 p-4 flex items-center gap-3 z-[310] safe-top">
              <ArrowLeft className="w-6 h-6 text-white cursor-pointer" onClick={() => setViewingStatus(null)} />
              <img src={`https://ui-avatars.com/api/?name=${viewingStatus.userId}&background=random`} className="w-10 h-10 rounded-full" alt={viewingStatus.userId} />
              <div className="flex-grow">
                <h4 className="text-white font-bold text-sm">{viewingStatus.userId}</h4>
                <p className="text-white/60 text-[10px]">{format(viewingStatus.time, 'HH:mm')}</p>
              </div>
              <X className="w-6 h-6 text-white cursor-pointer" onClick={() => setViewingStatus(null)} />
            </header>

            <div className="flex-grow flex items-center justify-center p-4">
              {viewingStatus.type === 'text' ? (
                <div className="text-center p-8">
                  <h2 className="text-3xl font-bold text-white leading-tight">{viewingStatus.content}</h2>
                </div>
              ) : (
                <img src={viewingStatus.content} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" alt="Status Content" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call Screen Overlay */}
      <AnimatePresence>
        {(activeCall || incomingCall) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[200] flex flex-col items-center justify-center text-white"
          >
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              className={cn("w-full h-full object-cover", !remoteStream && "hidden")} 
            />
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-[100px] h-[150px] absolute top-20 right-6 border-2 border-wa-primary rounded-2xl object-cover z-10 shadow-2xl" 
            />
            
            <div className="flex-grow flex flex-col items-center justify-center p-8 text-center">
              <div className="relative mb-12">
                <motion.div 
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-32 h-32 rounded-full border-4 border-wa-primary p-1 shadow-2xl shadow-wa-primary/20"
                >
                  <img 
                    src={`https://ui-avatars.com/api/?name=${activeCall?.peer.replace(PREFIX, '') || incomingCall?.callerId}&background=random`} 
                    className="w-full h-full rounded-full object-cover" 
                    alt="Caller"
                  />
                </motion.div>
                {activeCall?.type === 'video' && (
                  <div className="absolute -bottom-2 -right-2 bg-wa-primary p-2 rounded-xl shadow-lg">
                    <Video className="w-5 h-5" />
                  </div>
                )}
              </div>

              <h2 className="text-3xl font-black mb-2 uppercase tracking-tight">
                {activeCall?.peer.replace(PREFIX, '') || incomingCall?.callerId}
              </h2>
              <p className={cn("text-wa-primary font-black tracking-[0.4em] text-xs uppercase", !activeCall && "animate-pulse")}>
                {incomingCall ? "Panggilan Masuk..." : (remoteStream ? "Terhubung" : "Memanggil...")}
              </p>

              <div className="mt-20 flex gap-8 items-center">
                {incomingCall ? (
                  <>
                    <button 
                      onClick={() => endCall()}
                      className="w-20 h-20 bg-rose-500 rounded-full flex items-center justify-center shadow-2xl shadow-rose-500/30 hover:scale-110 active:scale-90 transition-all"
                    >
                      <X className="w-8 h-8" />
                    </button>
                    <button 
                      onClick={() => answerCall()}
                      className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/30 hover:scale-110 active:scale-90 transition-all"
                    >
                      <Phone className="w-8 h-8" />
                    </button>
                  </>
                ) : (
                  <>
                    <button className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all active:scale-90">
                      <MicOff className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={() => endCall()}
                      className="w-20 h-20 bg-rose-500 rounded-full flex items-center justify-center shadow-2xl shadow-rose-500/30 hover:scale-110 active:scale-90 transition-all"
                    >
                      <PhoneOff className="w-8 h-8" />
                    </button>
                    <button className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all active:scale-90">
                      <Volume2 className="w-6 h-6" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
