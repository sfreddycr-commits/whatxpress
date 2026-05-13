import React, { useState, useEffect, useRef } from "react";
import { Menu, ArrowLeft, MessageCircle, User, Bot, Send, Sparkles, ToggleLeft, ToggleRight, Loader2, Search, MoreVertical } from "lucide-react";

interface Conversation {
  customer_phone: string;
  last_message_at: string;
  message_count: number;
  last_message: string;
  push_name: string | null;
  profile_pic_url: string | null;
}

interface Message {
  id: number;
  role: string;
  message: string;
  created_at: string;
}

interface Props {
  tenantId: string;
  token: string;
  setIsSidebarOpen: (v: boolean) => void;
}

export const ConversationsView: React.FC<Props> = ({ tenantId, token, setIsSidebarOpen }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isBotActive, setIsBotActive] = useState(true);
  const [loadingControl, setLoadingControl] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAiMenu, setShowAiMenu] = useState(false);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, [tenantId, token]);

  useEffect(() => {
    const interval = setInterval(loadConversations, 10000);
    return () => clearInterval(interval);
  }, [tenantId, token]);

  useEffect(() => {
    if (!selectedPhone) return;
    
    loadChatDetails();
    loadBotStatus();

    const interval = setInterval(loadChatDetails, 3500);
    return () => clearInterval(interval);
  }, [selectedPhone, tenantId, token]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const loadConversations = async () => {
    try {
      const res = await fetch(`/api/tenant/conversations/${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data || []);
      }
    } catch (e) {}
    setLoading(false);
  };

  const loadChatDetails = async () => {
    if (!selectedPhone) return;
    try {
      const res = await fetch(`/api/tenant/conversations/${tenantId}/${encodeURIComponent(selectedPhone)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => prev.length !== data.length ? data : prev);
      }
    } catch (e) {}
  };

  const loadBotStatus = async () => {
    if (!selectedPhone) return;
    try {
      const res = await fetch(`/api/tenant/conversations/${tenantId}/control/${encodeURIComponent(selectedPhone)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIsBotActive(data.is_bot_active);
      }
    } catch (e) {}
  };

  const toggleBot = async () => {
    if (!selectedPhone) return;
    setLoadingControl(true);
    try {
      const nextStatus = !isBotActive;
      const res = await fetch(`/api/tenant/conversations/toggle-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId, phone: selectedPhone, isActive: nextStatus })
      });
      if (res.ok) {
        setIsBotActive(nextStatus);
      }
    } catch (e) {}
    setLoadingControl(false);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedPhone || isSending) return;
    
    setIsSending(true);
    const textToSend = inputText;
    setInputText(""); 
    
    try {
      const res = await fetch(`/api/tenant/conversations/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId, phone: selectedPhone, message: textToSend })
      });
      if (res.ok) {
        loadChatDetails();
      } else {
        setInputText(textToSend); 
        alert("No se pudo enviar.");
      }
    } catch (e) {
      setInputText(textToSend);
    }
    setIsSending(false);
  };

  const refineTextWithAI = async (action: string = 'refine') => {
    if (!inputText.trim() || isRefining) return;
    setIsRefining(true);
    setShowAiMenu(false); // close menu immediately
    try {
      const res = await fetch(`/api/tenant/ai-assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: inputText, action: action })
      });
      if (res.ok) {
        const data = await res.json();
        setInputText(data.refined || inputText);
      }
    } catch (e) {}
    setIsRefining(false);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "ahora";
    if (diff < 86400000 && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit", hour12: true });
    }
    return d.toLocaleDateString("es-CR", { day: "numeric", month: "short" });
  };

  const formatMsgTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const filteredConversations = conversations.filter(c => 
    c.customer_phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.last_message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.push_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDisplayName = (conv: Conversation) => {
    if (conv.push_name) return conv.push_name;
    const phone = conv.customer_phone.split('@')[0];
    return phone.length > 6 ? `+${phone}` : phone;
  };

  const getInitials = (conv: Conversation) => {
    if (conv.push_name) {
      const parts = conv.push_name.trim().split(' ');
      return parts.length >= 2 
        ? (parts[0][0] + parts[1][0]).toUpperCase() 
        : parts[0].substring(0, 2).toUpperCase();
    }
    return conv.customer_phone.split('@')[0].slice(-2);
  };

  // WhatsApp Pattern Style
  const whatsappBgStyle = {
    backgroundColor: "#efeae2",
    backgroundImage: `url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")`,
    backgroundRepeat: "repeat",
    backgroundBlendMode: "overlay",
    opacity: 0.9,
  };

  return (
    <div className="flex-1 flex h-full bg-[#f0f2f5] overflow-hidden font-sans relative">
      
      {/* LEFT SIDEBAR - Chat List */}
      <div className={`w-full md:w-[350px] lg:w-[400px] flex flex-col bg-white border-r border-[#dadde1] h-full transition-all duration-300 ${selectedPhone ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Sidebar Header */}
        <div className="h-[60px] bg-[#f0f2f5] flex items-center justify-between px-4 shrink-0 border-b border-[#e9edef]">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-1 text-[#54656f]">
              <Menu className="w-6 h-6" />
            </button>
            <div className="w-10 h-10 rounded-full bg-[#109e38] flex items-center justify-center text-white font-bold shadow-sm">
              <MessageCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-4 text-[#54656f]">
            <div className="px-2 py-0.5 rounded-full bg-[#e7fce3] text-[#06a759] text-[10px] font-bold uppercase flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#06a759] animate-pulse" /> En Vivo
            </div>
            <MoreVertical className="w-5 h-5 cursor-pointer" />
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-2 bg-white border-b border-[#e9edef] shrink-0">
          <div className="relative bg-[#f0f2f5] rounded-lg flex items-center px-3 h-[35px]">
            <Search className="w-4 h-4 text-[#54656f] absolute left-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar o empezar un chat"
              className="w-full bg-transparent pl-8 pr-2 py-1 text-sm text-[#3b4a54] outline-none placeholder-[#667781]"
            />
          </div>
        </div>

        {/* Conversations Scroll Area */}
        <div className="flex-1 overflow-y-auto bg-white">
          {loading ? (
            <div className="flex justify-center pt-10"><Loader2 className="w-6 h-6 animate-spin text-[#00a884]" /></div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-[#667781] text-sm">No se encontraron chats.</div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = selectedPhone === conv.customer_phone;
              return (
                <div
                  key={conv.customer_phone}
                  onClick={() => { setSelectedPhone(conv.customer_phone); setMessages([]); }}
                  className={`flex items-center px-3 py-3 cursor-pointer border-b border-[#f0f2f5] hover:bg-[#f5f6f6] transition-colors relative ${isActive ? 'bg-[#ebebeb] hover:bg-[#ebebeb]' : ''}`}
                >
                  <div className="w-12 h-12 rounded-full bg-[#dfe5e7] flex items-center justify-center shrink-0 mr-3 relative overflow-hidden">
                    {conv.profile_pic_url ? (
                      <img src={conv.profile_pic_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
                    ) : null}
                    <span className={`text-sm font-bold text-[#aebac1] ${conv.profile_pic_url ? 'hidden' : ''}`}>{getInitials(conv)}</span>
                  </div>
                  <div className="flex-1 min-w-0 py-1">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className="text-[16px] font-medium text-[#111b21] truncate">
                        {getDisplayName(conv)}
                      </h3>
                      <span className={`text-xs shrink-0 ${isActive ? 'text-[#00a884]' : 'text-[#667781]'}`}>
                        {formatTime(conv.last_message_at)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-[#667781] truncate font-normal w-[85%]">
                        {conv.last_message || "Sin mensajes"}
                      </p>
                      {conv.message_count > 0 && (
                        <span className="bg-[#25d366] text-white text-[11px] font-bold rounded-full px-1.5 min-w-[20px] h-5 flex items-center justify-center">
                          {conv.message_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT SIDE - Chat View (Main) */}
      <div className={`flex-1 flex flex-col h-full transition-all duration-300 ${selectedPhone ? 'flex' : 'hidden md:flex md:bg-[#f0f2f5] justify-center items-center'}`}>
        
        {!selectedPhone ? (
          // Empty State (Intro Screen like Web WhatsApp)
          <div className="flex flex-col items-center text-center p-10 max-w-lg">
            <div className="w-64 h-64 mb-6 opacity-80 bg-contain bg-no-repeat" 
                 style={{backgroundImage: 'url("https://static.whatsapp.net/rsrc.php/v3/y6/r/wa669aeJeom.png")'}} />
            <h1 className="text-[32px] font-light text-[#41525d] mb-3">WhatXpress Web</h1>
            <p className="text-sm text-[#667781] leading-relaxed mb-8">
              Envía y recibe mensajes sin mantener tu teléfono conectado.<br />
              Usa WhatXpress en hasta 4 dispositivos vinculados a la vez.
            </p>
            <div className="flex items-center text-xs text-[#8696a0] mt-auto absolute bottom-10">
              🔒 Cifrado de extremo a extremo
            </div>
          </div>
        ) : (
          // Active Chat State
          <div className="w-full h-full flex flex-col relative">
            
            {/* Chat Header */}
            <div className="h-[60px] bg-[#f0f2f5] flex items-center justify-between px-4 shrink-0 z-20 border-b border-[#dadde1]">
              <div className="flex items-center gap-3 overflow-hidden">
                <button onClick={() => { setSelectedPhone(null); setMessages([]); }} className="md:hidden mr-1 text-[#54656f]">
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="w-10 h-10 rounded-full bg-[#dfe5e7] flex items-center justify-center shrink-0 overflow-hidden">
                  {(() => {
                    const activeConv = conversations.find(c => c.customer_phone === selectedPhone);
                    if (activeConv?.profile_pic_url) {
                      return <img src={activeConv.profile_pic_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
                    }
                    return <User className="w-5 h-5 text-[#aebac1]" />;
                  })()}
                </div>
                <div className="flex flex-col min-w-0">
                  <h2 className="text-base font-medium text-[#111b21] leading-tight truncate">
                    {(() => {
                      const activeConv = conversations.find(c => c.customer_phone === selectedPhone);
                      return activeConv?.push_name || `+${selectedPhone.split('@')[0]}`;
                    })()}
                  </h2>
                  <span className="text-xs text-[#667781] truncate">
                    {isBotActive ? "🤖 IA activa" : "En línea (Modo Manual)"}
                  </span>
                </div>
              </div>

              {/* AI Toggle - Premium WhatsApp Look */}
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 ${isBotActive ? 'bg-[#e7fce3] border-[#b9f5b0] text-[#06a759]' : 'bg-[#fff6e6] border-[#ffebb3] text-[#e69900]'}`}>
                  <div className="flex flex-col items-end leading-none">
                    <span className="text-[10px] font-bold uppercase tracking-wider">{isBotActive ? "Autopilot" : "Manual"}</span>
                  </div>
                  <button 
                    onClick={toggleBot} 
                    disabled={loadingControl}
                    className="cursor-pointer outline-none active:scale-95 disabled:opacity-50"
                  >
                    {isBotActive ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                  </button>
                </div>
                <MoreVertical className="w-5 h-5 text-[#54656f] cursor-pointer" />
              </div>
            </div>

            {/* Chat Pattern Background & Messages Area */}
            <div 
              ref={chatContainerRef} 
              className="flex-1 overflow-y-auto relative px-4 sm:px-8 lg:px-16 py-6 flex flex-col gap-1 z-0 scroll-smooth"
              style={whatsappBgStyle}
            >
              {/* Date Pillar Wrapper */}
              <div className="flex justify-center my-2 sticky top-2 z-10">
                <div className="bg-[#ffffff] text-[#54656f] text-xs font-medium px-3 py-1 rounded-lg shadow-sm uppercase tracking-wide">
                  Hoy
                </div>
              </div>

              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="bg-white px-4 py-2 rounded-lg shadow text-sm text-[#54656f]">Recuperando historial...</div>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isOutgoing = msg.role !== "user"; 
                  
                  return (
                    <div 
                      key={`${msg.id}-${idx}`} 
                      className={`flex w-full mb-1 ${isOutgoing ? "justify-end" : "justify-start"}`}
                    >
                      <div 
                        className={`relative max-w-[85%] lg:max-w-[65%] py-1.5 px-2 shadow-sm text-[14.2px] text-[#111b21] ${
                          isOutgoing 
                            ? "bg-[#d9fdd3] rounded-l-lg rounded-br-lg rounded-tr-[3px]" 
                            : "bg-white rounded-r-lg rounded-bl-lg rounded-tl-[3px]"
                        }`}
                      >
                        {/* Tail SVGs - WhatsApp signature visual trick */}
                        <div className={`absolute top-0 ${isOutgoing ? "-right-[8px] text-[#d9fdd3]" : "-left-[8px] text-white"}`}>
                           <svg width="8" height="13" viewBox="0 0 8 13" fill="currentColor">
                              {isOutgoing ? (
                                <path d="M0.5 1.16161C-0.166667 0.833333 0.5 0 0.5 0H7.5V12.5L0.5 1.16161Z"></path>
                              ) : (
                                <path d="M7.5 1.16161C8.16667 0.833333 7.5 0 7.5 0H0.5V12.5L7.5 1.16161Z"></path>
                              )}
                           </svg>
                        </div>

                        <div className="px-1.5">
                          <span className="whitespace-pre-wrap break-words leading-[19px] inline-block mr-16">{msg.message}</span>
                          
                          {/* Absolute bottom right meta (Time + ticks) */}
                          <div className="absolute bottom-0.5 right-1.5 flex items-center gap-1 leading-none h-4">
                            <span className="text-[11px] text-[#667781]">
                              {formatMsgTime(msg.created_at).toLowerCase()}
                            </span>
                            {isOutgoing && (
                              <svg viewBox="0 0 16 15" width="16" height="15" className="text-[#53bdeb] fill-current">
                                <path d="M15.01 3.316l-.478-.372a.365.365 0 00-.51.063L8.666 9.879 5.593 7.456a.366.366 0 00-.46.04l-.467.416a.365.365 0 00-.026.516l3.593 4.168 1.202 1.394a.365.365 0 00.554 0l6.673-8.672a.365.365 0 00-.052-.502zm-4.24 0l-.478-.372a.365.365 0 00-.51.063L5.328 9.879 4.629 9.325l-.053-.042a.365.365 0 00-.46.04L3.65 9.739a.365.365 0 00-.026.516l.799.927 1.202 1.394a.365.365 0 00.554 0l4.673-6.073a.365.365 0 00-.052-.502zm-4.24 0l-.478-.372a.365.365 0 00-.51.063L1.128 9.879.911 9.707a.365.365 0 00-.46.04l-.467.416a.365.365 0 00-.026.516l1.493 1.732 1.202 1.394a.365.365 0 00.554 0l2.673-3.473a.365.365 0 00-.052-.502z"></path>
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Message Input Bar (Composer) */}
            <div className="bg-[#f0f2f5] px-4 py-2 flex items-end shrink-0 gap-3 z-10 border-t border-[#dadde1]">
              
              {/* Left Side Action Icons */}
              <div className="flex items-center gap-1 mb-1.5 text-[#54656f]">
                <button 
                  type="button" 
                  className="p-2 rounded-full hover:bg-[#d1d7db] transition-colors"
                  title="Attach">
                  <svg viewBox="0 0 24 24" width="24" height="24" className="fill-current"><path d="M1.816 15.556v.002c.459 1.632 1.37 2.953 2.715 3.939a7.922 7.922 0 002.136 1.129 8.37 8.37 0 002.41.468h.005c2.295 0 4.35-.917 5.804-2.388l6.553-6.58c1.57-1.579 2.436-3.676 2.436-5.906 0-2.229-.866-4.327-2.436-5.906C19.865.734 17.767-.13 15.539-.13c-2.228 0-4.325.864-5.904 2.44l-6.898 6.923c-1.059 1.063-1.643 2.473-1.643 3.972a5.6 5.6 0 001.643 3.972c.927.931 2.16 1.444 3.471 1.444s2.544-.513 3.471-1.443l6.051-6.077a.961.961 0 10-1.361-1.365l-6.05 6.076c-.563.566-1.313.878-2.111.878s-1.547-.312-2.111-.878a3.68 3.68 0 01-1.078-2.609c0-.983.382-1.907 1.077-2.605L11.002 3.68a6.356 6.356 0 014.537-1.883c1.711 0 3.32.667 4.536 1.884 1.218 1.221 1.889 2.845 1.889 4.571 0 1.725-.671 3.348-1.889 4.571l-6.554 6.579c-1.086 1.09-2.598 1.773-4.265 1.773h-.004a6.375 6.375 0 01-1.85-.271 6.01 6.01 0 01-1.584-.845c-.916-.67-1.534-1.569-1.847-2.678a.958.958 0 10-1.85.52z"></path></svg>
                </button>
              </div>

              {/* Input Field with integrated AI Refiner */}
              <div className="flex-1 flex items-end bg-white rounded-lg px-3 py-2 shadow-sm min-h-[42px] relative">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={isBotActive ? "🔒 Desactiva el piloto automático para escribir" : "Escribe un mensaje aquí"}
                  disabled={isSending || isBotActive}
                  className="flex-1 bg-transparent outline-none text-[15px] text-[#111b21] placeholder-[#8696a0] resize-none min-h-[20px] max-h-[100px] leading-snug scrollbar-none disabled:cursor-not-allowed disabled:opacity-60"
                  rows={1}
                  style={{height: 'auto'}}
                  onInput={(e) => {
                    e.currentTarget.style.height = 'auto';
                    e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                
                {/* AI Assist Action Menu Inside Input */}
                {inputText.trim() && !isBotActive && (
                  <div className="relative flex items-center">
                    {showAiMenu && !isRefining && (
                      <div className="absolute bottom-10 right-0 w-44 bg-white rounded-xl shadow-lg border border-[#e2e8f0] py-1.5 z-50 overflow-hidden">
                        <div className="px-3 py-1 text-[10px] font-black uppercase text-purple-400 tracking-wider border-b border-slate-50">Asistente Gemini</div>
                        <button 
                          type="button"
                          onClick={() => refineTextWithAI('refine')} 
                          className="w-full text-left px-3 py-2 text-[12px] font-semibold text-[#334155] hover:bg-purple-50 hover:text-[#7c3aed] flex items-center gap-2 transition-colors"
                        >
                          🪄 Refinar y Pulir
                        </button>
                        <button 
                          type="button"
                          onClick={() => refineTextWithAI('translate')} 
                          className="w-full text-left px-3 py-2 text-[12px] font-semibold text-[#334155] hover:bg-purple-50 hover:text-[#7c3aed] flex items-center gap-2 transition-colors border-t border-slate-50"
                        >
                          🌍 Traducir Idioma
                        </button>
                        <button 
                          type="button"
                          onClick={() => refineTextWithAI('shorter')} 
                          className="w-full text-left px-3 py-2 text-[12px] font-semibold text-[#334155] hover:bg-purple-50 hover:text-[#7c3aed] flex items-center gap-2 transition-colors border-t border-slate-50"
                        >
                          ✂️ Resumir / Corto
                        </button>
                      </div>
                    )}
                    <button 
                      type="button"
                      onClick={() => setShowAiMenu(!showAiMenu)} 
                      disabled={isRefining}
                      title="Asistente de Redacción AI"
                      className={`ml-2 p-1.5 rounded-full hover:bg-purple-50 text-[#805ad5] transition-all ${isRefining ? 'animate-spin' : 'active:scale-90'} ${showAiMenu ? 'bg-purple-100' : ''}`}
                    >
                      {isRefining ? <Loader2 className="w-5 h-5" /> : <Sparkles className="w-5 h-5 fill-current" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Button (Plane Icon like Web) */}
              <div className="mb-1.5 shrink-0">
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() || isSending || isBotActive}
                  className="p-2.5 text-[#54656f] disabled:opacity-40"
                >
                  {isSending ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <svg viewBox="0 0 24 24" width="24" height="24" className="fill-current"><path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"></path></svg>
                  )}
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
};
