import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api.client';
import { useAuth } from '@/contexts/AuthContext';

export interface ChatConversation {
  id: string;
  participant_one: string;
  participant_two: string;
  last_message_at: string;
  other_employee: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    designation: string | null;
    employee_code?: string;
    department_name?: string;
  };
  last_message?: string;
  unread_count: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  is_read: boolean;
  created_at: string;
}

export function useChat() {
  const { employee } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'list' | 'chat' | 'new'>('list');
  const convoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevUnreadRef = useRef<number>(0);

  const playNotificationSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      // Audio not available
    }
  }, []);

  // Fetch all employees for starting new chats
  const fetchEmployees = useCallback(async () => {
    if (!employee) return;
    try {
      const res = await api.get<any[]>('/api/employees?is_active=true');
      if (res.success && res.data) {
        setEmployees(res.data.filter((e: any) => e.id !== employee.id));
      }
    } catch {
      // ignore
    }
  }, [employee]);

  // Fetch conversations
  // Backend returns: { success:true, data: ChatConversation[], total_unread: number }
  const fetchConversations = useCallback(async () => {
    if (!employee) return;
    try {
      const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const token = localStorage.getItem('recruithub_token');
      const raw = await fetch(`${BASE_URL}/api/chat`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await raw.json();
      if (!raw.ok || !json.success) return;

      const convos: ChatConversation[] = Array.isArray(json.data) ? json.data : [];
      setConversations(convos);

      const newUnread = json.total_unread ?? 0;
      setTotalUnread(newUnread);

      // Play sound if unread count increased
      if (newUnread > prevUnreadRef.current && prevUnreadRef.current >= 0) {
        playNotificationSound();
      }
      prevUnreadRef.current = newUnread;
    } catch {
      // ignore — backend may not be ready
    }
  }, [employee, playNotificationSound]);

  // Fetch messages for active conversation
  const fetchMessages = useCallback(async () => {
    if (!activeConversation || !employee) return;
    setLoading(true);
    try {
      const res = await api.get<ChatMessage[]>(`/api/chat/${activeConversation}/messages`);
      if (res.success && res.data) {
        setMessages(res.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [activeConversation, employee]);

  // Send message
  const sendMessage = useCallback(async (content: string | null, fileUrl?: string, fileName?: string) => {
    if (!activeConversation || !employee) return;
    try {
      const body: Record<string, any> = {};
      if (content) body.content = content;
      if (fileUrl) body.file_url = fileUrl;
      if (fileName) body.file_name = fileName;

      const res = await api.post<ChatMessage>(`/api/chat/${activeConversation}/messages`, body);
      if (res.success && res.data) {
        setMessages(prev => [...prev, res.data]);
        // Refresh conversation list to update last_message / unread
        fetchConversations();
      }
    } catch {
      // ignore
    }
  }, [activeConversation, employee, fetchConversations]);

  // Start or find conversation
  const startConversation = useCallback(async (employeeId: string): Promise<string | null> => {
    if (!employee) return null;
    try {
      const res = await api.post<ChatConversation>('/api/chat/start', { employee_id: employeeId });
      if (res.success && res.data) {
        setActiveConversation(res.data.id);
        setView('chat');
        // Refresh conversations list
        fetchConversations();
        return res.data.id;
      }
    } catch {
      // ignore
    }
    return null;
  }, [employee, fetchConversations]);

  // Upload file — uses raw fetch (no Content-Type header so browser sets multipart boundary)
  const uploadFile = useCallback(async (file: File): Promise<{ url: string; name: string } | null> => {
    try {
      const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const token = localStorage.getItem('recruithub_token');
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${BASE_URL}/api/chat/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const json = await res.json();
      if (res.ok && json.success) {
        return { url: json.data.url, name: json.data.name };
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  // Conversation polling — every 10 seconds
  useEffect(() => {
    if (!employee) return;
    fetchEmployees();
    fetchConversations();

    convoPollRef.current = setInterval(() => {
      fetchConversations();
    }, 10000);

    return () => {
      if (convoPollRef.current) clearInterval(convoPollRef.current);
    };
  }, [employee, fetchEmployees, fetchConversations]);

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (activeConversation) {
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [activeConversation, fetchMessages]);

  // Message polling — every 5 seconds when a conversation is open
  useEffect(() => {
    if (!activeConversation) {
      if (msgPollRef.current) clearInterval(msgPollRef.current);
      return;
    }

    msgPollRef.current = setInterval(() => {
      fetchMessages();
    }, 5000);

    return () => {
      if (msgPollRef.current) clearInterval(msgPollRef.current);
    };
  }, [activeConversation, fetchMessages]);

  return {
    conversations,
    activeConversation,
    setActiveConversation,
    messages,
    employees,
    totalUnread,
    loading,
    view,
    setView,
    sendMessage,
    startConversation,
    uploadFile,
    fetchConversations,
  };
}
