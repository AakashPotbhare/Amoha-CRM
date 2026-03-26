import React, { useState, useRef, useEffect } from 'react';
import {
  MessageCircle, X, Send, Paperclip, ArrowLeft, Search,
  FileIcon, PenSquare, Loader2, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useChat, ChatConversation, ChatMessage } from '@/hooks/useChat';
import { useAuth } from '@/contexts/AuthContext';
import { format, isToday, isYesterday } from 'date-fns';
import { toast } from '@/hooks/use-toast';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Ensure any file URL is absolute — handles old relative URLs in DB
function resolveFileUrl(url: string | null): string {
  if (!url) return '#';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function openFile(url: string | null) {
  const resolved = resolveFileUrl(url);
  window.open(resolved, '_blank', 'noopener,noreferrer');
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

function formatDateSeparator(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, MMM d, yyyy');
}

const MAX_CHARS = 2000;
const CHAR_WARN_THRESHOLD = 1800;

export default function ChatWidget() {
  const { employee } = useAuth();
  const {
    conversations, activeConversation, setActiveConversation,
    messages, employees, totalUnread, loading,
    view, setView,
    sendMessage, startConversation, uploadFile,
  } = useChat();

  const [isOpen, setIsOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (!employee) return null;

  const handleSend = async () => {
    const text = messageText.trim();
    if (!text && !uploading) return;
    setSending(true);
    setMessageText('');
    try {
      await sendMessage(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max file size is 10MB', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const result = await uploadFile(file);
    if (result) {
      await sendMessage(null, result.url, result.name);
    } else {
      toast({ title: 'Upload failed', description: 'Could not upload file', variant: 'destructive' });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openConversation = (convo: ChatConversation) => {
    setActiveConversation(convo.id);
    setView('chat');
    setSearchQuery('');
  };

  const handleNewChat = async (empId: string) => {
    setSearchQuery('');
    await startConversation(empId);
  };

  const goBack = () => {
    setView('list');
    setActiveConversation(null);
    setSearchQuery('');
    setMessageText('');
  };

  const closePanel = () => {
    setIsOpen(false);
    setView('list');
    setActiveConversation(null);
    setSearchQuery('');
    setMessageText('');
  };

  const activeConvo = conversations.find(c => c.id === activeConversation);

  const filteredEmployees = employees.filter(e =>
    e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.designation && e.designation.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (e.department_name && e.department_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Group employees by department
  const groupedEmployees = filteredEmployees.reduce<Record<string, any[]>>((acc, emp) => {
    const dept = emp.department_name || 'Other';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(emp);
    return acc;
  }, {});
  const departmentNames = Object.keys(groupedEmployees).sort();

  const filteredConversations = conversations.filter(c =>
    c.other_employee.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Floating chat button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
        aria-label="Open chat"
      >
        <MessageCircle className="w-6 h-6" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold shadow-md">
            {totalUnread > 99 ? '99+' : totalUnread}
            <span className="absolute inset-0 rounded-full bg-destructive animate-ping opacity-40" />
          </span>
        )}
      </button>

      {/* Chat panel */}
      <div
        className={`fixed bottom-6 right-6 z-50 w-[380px] h-[560px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right ${
          isOpen
            ? 'scale-100 opacity-100 translate-y-0'
            : 'scale-75 opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {/* ===== HEADER ===== */}
        <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {view !== 'list' && (
              <button
                onClick={goBack}
                className="p-1 rounded-md hover:bg-primary-foreground/20 transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            {view === 'list' && (
              <h2 className="font-semibold text-[15px]">Messages</h2>
            )}
            {view === 'new' && (
              <h2 className="font-semibold text-[15px]">New Message</h2>
            )}
            {view === 'chat' && activeConvo && (
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="w-8 h-8 shrink-0 border border-primary-foreground/30">
                  <AvatarImage src={activeConvo.other_employee.avatar_url || ''} />
                  <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-[11px] font-semibold">
                    {getInitials(activeConvo.other_employee.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate leading-tight">
                    {activeConvo.other_employee.full_name}
                  </p>
                  {activeConvo.other_employee.designation && (
                    <p className="text-[11px] text-primary-foreground/70 truncate leading-tight">
                      {activeConvo.other_employee.designation}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {view === 'list' && (
              <button
                onClick={() => { setView('new'); setSearchQuery(''); }}
                className="p-1.5 rounded-md hover:bg-primary-foreground/20 transition-colors"
                title="New message"
                aria-label="New message"
              >
                <PenSquare className="w-[18px] h-[18px]" />
              </button>
            )}
            <button
              onClick={closePanel}
              className="p-1.5 rounded-md hover:bg-primary-foreground/20 transition-colors"
              aria-label="Close chat"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        {/* ===== CONVERSATION LIST VIEW ===== */}
        {view === 'list' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search */}
            <div className="px-3 pt-3 pb-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search conversations..."
                  className="pl-9 h-9 text-sm bg-muted/50 border-none focus-visible:ring-1"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Conversation list */}
            <ScrollArea className="flex-1">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No conversations yet</p>
                  <p className="text-xs text-muted-foreground mb-4">Start chatting with your colleagues!</p>
                  <Button variant="outline" size="sm" onClick={() => { setView('new'); setSearchQuery(''); }}>
                    <PenSquare className="w-3.5 h-3.5 mr-1.5" />
                    Start a new chat
                  </Button>
                </div>
              ) : (
                filteredConversations.map(convo => {
                  const hasUnread = convo.unread_count > 0;
                  const isActive = convo.id === activeConversation;
                  return (
                    <button
                      key={convo.id}
                      onClick={() => openConversation(convo)}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left border-b border-border/40 ${
                        isActive
                          ? 'bg-accent'
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="w-11 h-11">
                          <AvatarImage src={convo.other_employee.avatar_url || ''} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {getInitials(convo.other_employee.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm truncate ${hasUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                            {convo.other_employee.full_name}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                            {formatMsgTime(convo.last_message_at)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className={`text-xs truncate ${hasUnread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                            {convo.last_message || 'No messages yet'}
                          </p>
                          {hasUnread && (
                            <Badge className="bg-destructive text-destructive-foreground text-[10px] h-[18px] min-w-[18px] px-1 justify-center rounded-full shrink-0 font-bold">
                              {convo.unread_count > 99 ? '99+' : convo.unread_count}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </ScrollArea>
          </div>
        )}

        {/* ===== NEW CHAT VIEW ===== */}
        {view === 'new' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search */}
            <div className="px-3 pt-3 pb-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search employees..."
                  className="pl-9 h-9 text-sm bg-muted/50 border-none focus-visible:ring-1"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {/* Employee list grouped by department */}
            <ScrollArea className="flex-1">
              {departmentNames.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                  <Users className="w-8 h-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No employees found</p>
                </div>
              ) : (
                departmentNames.map(dept => (
                  <div key={dept}>
                    <div className="px-4 py-1.5 bg-muted/60 sticky top-0 z-10">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {dept}
                      </span>
                    </div>
                    {groupedEmployees[dept].map((emp: any) => (
                      <button
                        key={emp.id}
                        onClick={() => handleNewChat(emp.id)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors text-left"
                      >
                        <Avatar className="w-9 h-9 shrink-0">
                          <AvatarImage src={emp.avatar_url || ''} />
                          <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-semibold">
                            {getInitials(emp.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate leading-tight">{emp.full_name}</p>
                          <p className="text-[11px] text-muted-foreground truncate leading-tight">
                            {[emp.designation, emp.department_name].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </ScrollArea>
          </div>
        )}

        {/* ===== CHAT VIEW ===== */}
        {view === 'chat' && (
          <>
            {/* Messages area — fixed width, no overflow */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ width: '380px' }}>
              <div className="py-3 flex flex-col" style={{ padding: '12px 16px' }}>
                {loading && messages.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageCircle className="w-10 h-10 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isMine = msg.sender_id === employee.id;
                    const showDate =
                      i === 0 ||
                      format(new Date(messages[i - 1].created_at), 'yyyy-MM-dd') !==
                        format(new Date(msg.created_at), 'yyyy-MM-dd');

                    // Panel is 380px, padding 16px each side = 348px content
                    // Bubble max = 70% of 348 = ~243px
                    const bubbleStyle: React.CSSProperties = {
                      maxWidth: '243px',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                    };

                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="flex justify-center my-4">
                            <span className="text-[11px] text-muted-foreground bg-muted px-3 py-1 rounded-full font-medium">
                              {formatDateSeparator(msg.created_at)}
                            </span>
                          </div>
                        )}
                        <div
                          className="flex mb-2"
                          style={{ justifyContent: isMine ? 'flex-end' : 'flex-start' }}
                        >
                          <div
                            style={bubbleStyle}
                            className={`px-3 py-2 text-sm leading-relaxed ${
                              isMine
                                ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm shadow-sm'
                                : 'bg-muted text-foreground rounded-2xl rounded-bl-sm'
                            }`}
                          >
                            {/* File attachment */}
                            {msg.file_url && (
                              <button
                                onClick={() => openFile(msg.file_url)}
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  marginBottom: msg.content ? '6px' : 0,
                                  textAlign: 'left',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 10px',
                                    borderRadius: '10px',
                                    background: isMine ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.07)',
                                  }}
                                >
                                  {/* File icon */}
                                  <div
                                    style={{
                                      width: '36px',
                                      height: '36px',
                                      borderRadius: '8px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                      background: isMine ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)',
                                    }}
                                  >
                                    <FileIcon style={{ width: '18px', height: '18px' }} />
                                  </div>
                                  {/* File name + hint */}
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <p
                                      style={{
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        margin: 0,
                                        lineHeight: '1.4',
                                      }}
                                    >
                                      {msg.file_name || 'Attachment'}
                                    </p>
                                    <p
                                      style={{
                                        fontSize: '10px',
                                        opacity: 0.65,
                                        margin: 0,
                                        lineHeight: '1.3',
                                      }}
                                    >
                                      Click to open
                                    </p>
                                  </div>
                                </div>
                              </button>
                            )}
                            {/* Text content */}
                            {msg.content && (
                              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                            )}
                            {/* Timestamp */}
                            <p
                              style={{
                                fontSize: '10px',
                                textAlign: 'right',
                                marginTop: '4px',
                                opacity: 0.6,
                                margin: '4px 0 0 0',
                              }}
                            >
                              {format(new Date(msg.created_at), 'h:mm a')}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message input area */}
            <div className="px-3 py-2.5 border-t border-border bg-card shrink-0">
              {/* Character counter */}
              {messageText.length >= CHAR_WARN_THRESHOLD && (
                <div className="flex justify-end mb-1 px-1">
                  <span className={`text-[11px] tabular-nums ${
                    messageText.length >= MAX_CHARS ? 'text-destructive font-semibold' : 'text-muted-foreground'
                  }`}>
                    {messageText.length}/{MAX_CHARS}
                  </span>
                </div>
              )}
              <div className="flex items-end gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt,.csv,.zip"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors shrink-0 disabled:opacity-50"
                  title="Attach file"
                  aria-label="Attach file"
                >
                  {uploading ? (
                    <Loader2 className="w-[18px] h-[18px] animate-spin" />
                  ) : (
                    <Paperclip className="w-[18px] h-[18px]" />
                  )}
                </button>
                <div className="flex-1">
                  <Input
                    placeholder={uploading ? 'Uploading file...' : 'Type a message...'}
                    value={messageText}
                    onChange={e => {
                      if (e.target.value.length <= MAX_CHARS) setMessageText(e.target.value);
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={uploading || sending}
                    className="h-9 text-sm bg-muted/50 border-none focus-visible:ring-1"
                  />
                </div>
                <Button
                  size="icon"
                  className={`h-9 w-9 shrink-0 rounded-lg transition-all ${
                    messageText.trim()
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  onClick={handleSend}
                  disabled={(!messageText.trim() && !uploading) || uploading || sending}
                  aria-label="Send message"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
