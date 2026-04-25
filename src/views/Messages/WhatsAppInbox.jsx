// src/views/Messages/WhatsAppInbox.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MoreVertical, Send, Phone, User, Filter, ArrowLeft, Rocket, CheckCircle2, Users, Image as ImageIcon, Mic, FileText, Play, Download, Trash2, Paperclip, X, Reply, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSupabase } from '@/hooks/useSupabase';
import { getWhatsAppInbox, deleteChat } from '@/services/whatsapp';
import { getConversationsByContext, createConversation } from '@/services/conversations';
import { getUserPermissions } from '@/services/auth';
import { getPipelines, getPipelineStages } from '@/services/pipelines';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner, GlassCard, Modal, Badge } from '@/components/ui';
import { DealForm } from '@/views/Funnel/DealForm';
import { formatRelative } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';

const EMOJI_CATEGORIES = [
  {
    label: 'Recentes',
    emojis: ['👍', '🙏', '😂', '😍', '👏', '🔥', '✅', '🚀']
  },
  {
    label: 'Smileys e pessoas',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '😘', '😎', '🤩', '🥳', '😢', '😭', '😡', '😱', '🤔', '🤫', '🙌', '👏', '🤝', '🙏', '💪']
  },
  {
    label: 'Trabalho',
    emojis: ['✅', '☑️', '📌', '📎', '📄', '📊', '💼', '💰', '📈', '📉', '⏰', '📅', '☎️', '📞', '💬', '✉️', '🔔', '⭐', '🚀', '🔥']
  },
  {
    label: 'Símbolos',
    emojis: ['❤️', '💙', '💚', '💛', '🟢', '🔵', '🟡', '🔴', '⚠️', '❌', '❗', '❓', '➡️', '⬅️', '⬆️', '⬇️', '🔒', '🔓', '💡', '🎯']
  }
];

/**
 * COMPONENTE: INBOX ELITE (CENTRAL DE COMANDO WHATSAPP)
 */
export default function WhatsAppInbox() {
  const [activeChat, setActiveChat] = useState(null); 
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const [isQualifying, setIsQualifying] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState(new Set());
   const [isGlobalAnalyzing, setIsGlobalAnalyzing] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [defaultPipelineStageId, setDefaultPipelineStageId] = useState(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [showOracleModal, setShowOracleModal] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState('');
  const pendingInitialScrollRef = useRef(false);
  
  // [AUDIO RECORDING v29] Estados para o Gravador de Voz
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const sendQueueRef = useRef([]);
  const isProcessingSendQueueRef = useRef(false);
  const [sendQueueSize, setSendQueueSize] = useState(0);
  
  const { data: inbox, setData: setInbox, loading: loadingInbox, refetch: refetchInbox } = useSupabase(getWhatsAppInbox);
  const latestMessageRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDefaultStage() {
      try {
        const pipelines = await getPipelines();
        if (!pipelines?.length) return;

        const stages = await getPipelineStages(pipelines[0].id);
        if (isMounted) setDefaultPipelineStageId(stages?.[0]?.id || null);
      } catch (err) {
        console.error('Erro ao carregar etapa inicial do pipeline:', err);
      }
    }

    loadDefaultStage();
    return () => {
      isMounted = false;
    };
  }, []);
  
  // [ELITE PERFORMANCE] OrdenaÃ§Ã£o memorizada para evitar "travamentos" na UI
  const sortedInbox = React.useMemo(() => {
    if (!inbox) return [];
    return [...inbox].sort((a, b) => {
      const dateA = new Date(a.last_message_at || 0);
      const dateB = new Date(b.last_message_at || 0);
      return dateB - dateA;
    });
  }, [inbox]);

  const scrollRef = useRef(null);
  const scrollToLatestMessage = React.useCallback((behavior = 'auto') => {
    const run = () => {
      if (latestMessageRef.current) {
        latestMessageRef.current.scrollIntoView({ block: 'end', behavior });
        return;
      }

      const container = scrollRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    };

    requestAnimationFrame(() => requestAnimationFrame(run));
    window.setTimeout(run, 80);
    window.setTimeout(run, 250);
  }, []);

  // --- [DERIVED IDENTITIES] ---
  const activeChatId = activeChat?.id; // Usar a chave Ãºnica reconstruÃ­da (c-ID ou p-Phone)
  const activeDealId = activeChat?.deal_id;
  const activeChatPhone = activeChat?.contact_phone;
  const activeThreadAliases = React.useMemo(() => activeChat?.thread_aliases || [], [activeChat?.thread_aliases]);
  const isActiveGroupThread = Boolean(activeChatId?.includes('@g.us') || activeChat?.is_group);
  const activeRecipientId = isActiveGroupThread || activeChatId?.includes('@lid')
    ? (activeChatId || activeChatPhone)
    : (activeChatPhone || activeChatId);
  const activeSenderPhone = activeChatPhone || activeRecipientId;
  const canQualifyActiveChat = Boolean(activeChat) && (!activeDealId || activeChat?.is_qualified === false);

  const isUuid = (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));

  const normalizePhoneForMatch = (value) => String(value || '').replace(/\D/g, '');
  const phonesMatch = (left, right) => {
    const a = normalizePhoneForMatch(left);
    const b = normalizePhoneForMatch(right);
    if (!a || !b) return false;
    return a === b || a.endsWith(b) || b.endsWith(a);
  };

  const findQualifiedDealForActiveThread = async () => {
    const phoneCandidates = [
      activeChatPhone,
      activeChat?.contact_phone,
      ...activeThreadAliases
        .filter(alias => String(alias).startsWith('phone:'))
        .map(alias => String(alias).slice(6))
    ].filter(Boolean);

    if (!phoneCandidates.length) return null;

    const { orgId } = await getUserPermissions();
    const { data, error } = await supabase
      .from('deals')
      .select(`
        id, title, stage, status, is_qualified, created_at,
        contacts:deal_contacts(contact:contacts(id, name, phone))
      `)
      .eq('org_id', orgId)
      .neq('stage', 'lead')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).find(deal =>
      deal.is_qualified !== false &&
      (deal.contacts || []).some(link =>
        phoneCandidates.some(phone => phonesMatch(phone, link.contact?.phone))
      )
    ) || null;
  };

  const linkActiveThreadToDeal = async (dealId) => {
    if (!isUuid(dealId)) return;

    const conditions = [];
    if (activeChatId) conditions.push(`chat_id.eq.${activeChatId}`);
    if (activeChatPhone) conditions.push(`sender_phone.eq.${activeChatPhone}`);
    activeThreadAliases.forEach((alias) => {
      const [type, ...valueParts] = String(alias).split(':');
      const value = valueParts.join(':');
      if (type === 'chat' && value) conditions.push(`chat_id.eq.${value}`);
      if (type === 'phone' && value) conditions.push(`sender_phone.eq.${value}`);
    });

    if (!conditions.length) return;

    const { orgId } = await getUserPermissions();
    const { error } = await supabase
      .from('deal_conversations')
      .update({ deal_id: dealId })
      .eq('org_id', orgId)
      .or([...new Set(conditions)].join(','));

    if (error) throw error;
  };

  const resolveDealIdForActiveThread = async (candidateDealId) => {
    const qualifiedDeal = await findQualifiedDealForActiveThread();
    if (qualifiedDeal?.id) {
      await linkActiveThreadToDeal(qualifiedDeal.id);
      return qualifiedDeal.id;
    }

    if (isUuid(candidateDealId)) return candidateDealId;

    const conditions = [];
    if (activeChatId) conditions.push(`chat_id.eq.${activeChatId}`);
    if (activeChatPhone) conditions.push(`sender_phone.eq.${activeChatPhone}`);
    activeThreadAliases.forEach((alias) => {
      const [type, ...valueParts] = String(alias).split(':');
      const value = valueParts.join(':');
      if (type === 'chat' && value) conditions.push(`chat_id.eq.${value}`);
      if (type === 'phone' && value) conditions.push(`sender_phone.eq.${value}`);
    });

    if (!conditions.length) return null;

    const { orgId } = await getUserPermissions();
    const { data, error } = await supabase
      .from('deal_conversations')
      .select('deal_id')
      .eq('org_id', orgId)
      .not('deal_id', 'is', null)
      .or([...new Set(conditions)].join(','))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return isUuid(data?.deal_id) ? data.deal_id : null;
  };

  // [ELITE PERFORMANCE] Sincronizar o chat ativo sem loops de re-renderizaÃ§Ã£o
  useEffect(() => {
    if (activeChat && inbox) {
      const updated = inbox.find(i => i.id === (activeChat.id || activeChat.chat_id));
      if (updated && (updated.last_message_at !== activeChat.last_message_at || updated.deal_id !== activeChat.deal_id)) {
        setActiveChat(updated);
      }
    }
  }, [inbox]);
  
  const filteredInbox = sortedInbox?.filter(i => 
    i.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.last_message?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const inboxMetrics = React.useMemo(() => {
    const todayKey = new Date().toDateString();
    const rows = sortedInbox || [];
    const activeToday = rows.filter(chat => {
      if (!chat.last_message_at) return false;
      return new Date(chat.last_message_at).toDateString() === todayKey;
    }).length;

    return {
      total: rows.length,
      activeToday,
      groups: rows.filter(chat => chat.is_group).length,
      pipeline: rows.filter(chat => chat.deal_id || chat.is_qualified).length,
      unqualified: rows.filter(chat => !chat.is_qualified).length
    };
  }, [sortedInbox]);

  const displayedMessages = React.useMemo(() => {
    const unique = [];

    messages.forEach((message) => {
      const existingIndex = unique.findIndex((item) => {
        if (item.id === message.id) return true;
        if (item.external_message_id && message.external_message_id && item.external_message_id === message.external_message_id) return true;
        if (item.chat_id !== message.chat_id) return false;
        if (item.sender_type !== message.sender_type) return false;
        if (!item.is_optimistic && !message.is_optimistic) return false;
        if ((item.message_type || 'text') !== (message.message_type || 'text')) return false;
        if ((item.message_type || 'text') !== 'text' && item.media_url && message.media_url && item.media_url !== message.media_url) return false;
        if (String(item.content || '').trim() !== String(message.content || '').trim()) return false;

        const itemTime = new Date(item.created_at).getTime();
        const messageTime = new Date(message.created_at).getTime();
        return Number.isFinite(itemTime) &&
          Number.isFinite(messageTime) &&
          Math.abs(itemTime - messageTime) < 10000;
      });

      if (existingIndex === -1) {
        unique.push(message);
        return;
      }

      if (unique[existingIndex].is_optimistic && !message.is_optimistic) {
        unique[existingIndex] = message;
      }
    });

    return unique;
  }, [messages]);

  const messageBelongsToActiveThread = React.useCallback((message) => {
    if (!message) return false;

    const messageChatId = String(message.chat_id || '');
    const messagePhone = message.sender_phone;

    if (activeChatId && messageChatId && messageChatId === activeChatId) return true;
    if (activeChatPhone && messagePhone && phonesMatch(messagePhone, activeChatPhone)) return true;

    return activeThreadAliases.some((alias) => {
      const [type, ...valueParts] = String(alias).split(':');
      const value = valueParts.join(':');
      if (!value) return false;

      if (type === 'chat') return Boolean(messageChatId) && messageChatId === value;
      if (type === 'phone') return Boolean(messagePhone) && phonesMatch(messagePhone, value);

      return false;
    });
  }, [activeChatId, activeChatPhone, activeThreadAliases]);

  const getReplyPreview = React.useCallback((message) => {
    if (!message) return null;
    const content = String(message.content || '').replace(/\s+/g, ' ').trim();
    return {
      id: message.id,
      externalId: message.external_message_id,
      sender: message.sender_type === 'sales' ? 'Você' : (message.sender_name || 'Cliente'),
      content: content || `[${message.message_type || 'mensagem'}]`
    };
  }, []);

  const filteredEmojiCategories = React.useMemo(() => {
    const query = emojiSearch.trim().toLowerCase();
    if (!query) return EMOJI_CATEGORIES;

    return EMOJI_CATEGORIES
      .map(category => ({
        ...category,
        emojis: category.emojis.filter(emoji => emoji.includes(query))
      }))
      .filter(category => category.emojis.length);
  }, [emojiSearch]);

  const insertEmoji = React.useCallback((emoji) => {
    const input = messageInputRef.current;
    const start = input?.selectionStart ?? newMessage.length;
    const end = input?.selectionEnd ?? newMessage.length;
    const nextMessage = `${newMessage.slice(0, start)}${emoji}${newMessage.slice(end)}`;

    setNewMessage(nextMessage);
    requestAnimationFrame(() => {
      messageInputRef.current?.focus();
      const cursor = start + emoji.length;
      messageInputRef.current?.setSelectionRange(cursor, cursor);
    });
  }, [newMessage]);

  // 1. Ouvir mudanÃ§as globais para atualizar a lista do Inbox
  useEffect(() => {
    const applyInboxMessage = (newMsg) => {
      setInbox(prev => {
        if (!prev) return prev;

        const chatIdx = prev.findIndex(chat =>
          chat.id === newMsg.chat_id ||
          (newMsg.contact_id && chat.contact_id === newMsg.contact_id) ||
          chat.thread_aliases?.includes(`chat:${newMsg.chat_id}`) ||
          chat.thread_aliases?.includes(`phone:${newMsg.sender_phone}`)
        );

        if (chatIdx !== -1) {
          const updated = [...prev];
          const currentDate = new Date(updated[chatIdx].last_message_at || 0).getTime();
          const newDate = new Date(newMsg.created_at || 0).getTime();
          const shouldRefreshPreview = !Number.isFinite(currentDate) || !Number.isFinite(newDate) || newDate >= currentDate;

          updated[chatIdx] = {
            ...updated[chatIdx],
            last_message: shouldRefreshPreview ? newMsg.content : updated[chatIdx].last_message,
            last_message_at: shouldRefreshPreview ? newMsg.created_at : updated[chatIdx].last_message_at,
            sender_type: shouldRefreshPreview ? newMsg.sender_type : updated[chatIdx].sender_type,
            deal_id: newMsg.deal_id || updated[chatIdx].deal_id
          };
          return updated;
        }

        refetchInbox();
        return prev;
      });
    };

    const channel = supabase
      .channel('global-chat-inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deal_conversations' }, (payload) => {
        if (payload.new) applyInboxMessage(payload.new);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deal_conversations' }, (payload) => {
        if (payload.new) applyInboxMessage(payload.new);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [refetchInbox]);

  // 2. Buscar mensagens quando selecionar um chat (Suporte a Leads e Deals)
  useEffect(() => {
    if (activeDealId || activeChatPhone || activeChatId) {
      pendingInitialScrollRef.current = true;
      setReplyToMessage(null);
      loadMessages({
        dealId: activeDealId,
        phone: activeChatPhone,
        chatId: activeChatId,
        aliases: activeThreadAliases
      });
      
      const channel = supabase
        .channel(`chat-${activeDealId || activeChatPhone}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'deal_conversations'
        }, (payload) => {
          if (payload.new) {
            const newMsg = payload.new;
            if (!messageBelongsToActiveThread(newMsg)) return;

            setMessages(prev => {
               // Evitar duplicidade com optimistic records
               const alreadyExists = prev.some((m) => {
                 if (m.id === newMsg.id) return true;
                 if (m.external_message_id && newMsg.external_message_id && m.external_message_id === newMsg.external_message_id) return true;
                 if (!m.is_optimistic) return false;
                 if ((m.message_type || 'text') !== (newMsg.message_type || 'text')) return false;
                 if ((m.message_type || 'text') !== 'text' && m.media_url && newMsg.media_url && m.media_url !== newMsg.media_url) return false;
                 return String(m.content || '').trim() === String(newMsg.content || '').trim();
               });
               if (alreadyExists) {
                  // Se jÃ¡ existe (ex: acabou de ser enviado pessimamente), sÃ³ removemos a flag de otimismo se for o caso
                  return prev.map((m) => {
                    if (m.id === newMsg.id) return newMsg;
                    if (m.external_message_id && newMsg.external_message_id && m.external_message_id === newMsg.external_message_id) return newMsg;
                    if (!m.is_optimistic) return m;
                    if ((m.message_type || 'text') !== (newMsg.message_type || 'text')) return m;
                    if ((m.message_type || 'text') !== 'text' && m.media_url && newMsg.media_url && m.media_url !== newMsg.media_url) return m;
                    return String(m.content || '').trim() === String(newMsg.content || '').trim() ? newMsg : m;
                  });
               }
               pendingInitialScrollRef.current = false;
               return [...prev, newMsg];
            });
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'deal_conversations'
        }, (payload) => {
          if (!payload.new) return;
          const updatedMsg = payload.new;
          if (!messageBelongsToActiveThread(updatedMsg)) return;

          setMessages(prev => {
            const existing = prev.some((message) =>
              message.id === updatedMsg.id ||
              (message.external_message_id && updatedMsg.external_message_id && message.external_message_id === updatedMsg.external_message_id)
            );

            if (!existing) return [...prev, updatedMsg];

            return prev.map((message) =>
              message.id === updatedMsg.id ||
              (message.external_message_id && updatedMsg.external_message_id && message.external_message_id === updatedMsg.external_message_id)
                ? updatedMsg
                : message
            );
          });
        })
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setMessages([]); // Limpar se nada estiver selecionado
    }
  }, [activeDealId, activeChatPhone, activeChatId, activeThreadAliases, messageBelongsToActiveThread]);

  async function loadMessages(context) {
    try {
      setIsLoadingMessages(true);
      const msgs = await getConversationsByContext(context);
      setMessages(msgs);
    } catch (err) {
      console.error(err);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function handleQualifySuccess(savedDeal) {
    const dealId = savedDeal?.id || activeDealId;

    try {
      if (dealId) {
        const { orgId } = await getUserPermissions();
        const conditions = [];

        if (activeChatId) conditions.push(`chat_id.eq.${activeChatId}`);
        if (activeChatPhone) conditions.push(`sender_phone.eq.${activeChatPhone}`);
        activeThreadAliases.forEach((alias) => {
          const [type, ...valueParts] = String(alias).split(':');
          const value = valueParts.join(':');
          if (type === 'chat' && value) conditions.push(`chat_id.eq.${value}`);
          if (type === 'phone' && value) conditions.push(`sender_phone.eq.${value}`);
        });

        if (orgId && conditions.length) {
          const { error } = await supabase
            .from('deal_conversations')
            .update({ deal_id: dealId })
            .eq('org_id', orgId)
            .or([...new Set(conditions)].join(','));

          if (error) throw error;
        }
      }

      setIsQualifying(false);
      setActiveChat(prev => prev ? {
        ...prev,
        deal_id: dealId || prev.deal_id,
        is_qualified: true,
        stage_label: savedDeal?.stage || prev.stage_label
      } : prev);
      await refetchInbox();
    } catch (err) {
      console.error('Erro ao vincular conversa ao pipeline:', err);
      alert('O lead foi salvo, mas houve falha ao vincular o histÃ³rico da conversa. Recarregue a tela e tente novamente.');
    }
  }

  // Auto-scroll sempre que as mensagens mudarem
  useEffect(() => {
    if (!displayedMessages.length) return;
    scrollToLatestMessage(pendingInitialScrollRef.current ? 'auto' : 'smooth');
    pendingInitialScrollRef.current = false;
  }, [displayedMessages.length, activeChatId, activeChatPhone, scrollToLatestMessage]);

  const processSendQueue = React.useCallback(async () => {
    if (isProcessingSendQueueRef.current) return;

    isProcessingSendQueueRef.current = true;
    setIsSending(true);

    try {
      while (sendQueueRef.current.length) {
        const item = sendQueueRef.current[0];
        setSendQueueSize(sendQueueRef.current.length);

        setMessages(prev => prev.map(message =>
          message.id === item.tempId
            ? {
                ...message,
                metadata: {
                  ...(message.metadata || {}),
                  send_status: 'sending',
                  send_error: null
                }
              }
            : message
        ));

        try {
          const savedMessage = await createConversation(
            item.dealId,
            item.content,
            'sales',
            'whatsapp',
            item.recipientId,
            item.mediaUrl,
            item.messageType,
            item.options
          );

          setMessages(prev => prev.map(message => message.id === item.tempId ? savedMessage : message));
        } catch (err) {
          console.error('Erro ao enviar WhatsApp:', err);
          setMessages(prev => prev.map(message =>
            message.id === item.tempId
              ? {
                  ...message,
                  is_optimistic: false,
                  metadata: {
                    ...(message.metadata || {}),
                    send_status: 'failed',
                    send_error: err.message || 'Falha ao enviar.'
                  }
                }
              : message
          ));
          alert('Erro ao enviar: ' + (err.message || 'Falha ao enviar mensagem.'));
        } finally {
          sendQueueRef.current.shift();
          setSendQueueSize(sendQueueRef.current.length);
        }
      }
    } finally {
      isProcessingSendQueueRef.current = false;
      setIsSending(false);
      setSendQueueSize(sendQueueRef.current.length);
    }
  }, []);

  const enqueueOutgoingMessage = React.useCallback((item) => {
    sendQueueRef.current.push(item);
    setSendQueueSize(sendQueueRef.current.length);
    processSendQueue();
  }, [processSendQueue]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const currentContext = activeDealId || activeChatPhone || activeChatId;
    if (!newMessage.trim() || !currentContext) return;

    const content = newMessage.trim();
    const replySnapshot = replyToMessage;
    setNewMessage(''); 
    setShowEmojiPicker(false);
    setReplyToMessage(null);
    
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticMsg = {
      id: tempId,
      deal_id: activeDealId,
      sender_phone: activeChatPhone,
      chat_id: activeChatId,
      content: content,
      sender_type: 'sales',
      source: 'whatsapp',
      created_at: new Date().toISOString(),
      message_type: 'text',
      metadata: {
        ...(replySnapshot ? {
          reply_to_message_id: replySnapshot.externalId,
          reply_to_content: replySnapshot.content,
          reply_to_sender: replySnapshot.sender
        } : {}),
        send_status: sendQueueRef.current.length || isProcessingSendQueueRef.current ? 'queued' : 'sending'
      },
      is_optimistic: true
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    enqueueOutgoingMessage({
      tempId,
      dealId: activeDealId,
      content,
      recipientId: activeRecipientId,
      mediaUrl: null,
      messageType: 'text',
      options: {
        chatId: activeChatId,
        recipientPhone: activeRecipientId,
        senderPhone: activeSenderPhone,
        replyToMessageId: replySnapshot?.externalId,
        replyToContent: replySnapshot?.content,
        replyToSender: replySnapshot?.sender
      }
    });
  };

  /**
   * [ELITE UPLOAD] Faz o upload de mÃ­dia para o Supabase Storage e dispara via WhatsApp
   */
  /**
   * [ELITE AUDIO RECORDING] Gerenciamento do Gravador de Voz
   */
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioChunksRef.current.length > 0) {
          await handleSendAudioBlob(audioBlob);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Erro ao acessar microfone:", err);
      alert("NÃ£o foi possÃ­vel acessar o microfone. Verifique as permissÃµes do seu navegador.");
    }
  };

  const handleStopRecording = (shouldSend = true) => {
    if (!mediaRecorderRef.current) return;
    
    if (!shouldSend) {
      audioChunksRef.current = []; // Limpa os chunks para nÃ£o disparar o onstop com envio
    }
    
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    clearInterval(timerIntervalRef.current);
    setRecordingTime(0);
  };

  const handleSendAudioBlob = async (blob) => {
    try {
      setIsUploading(true);
      const fileName = `audio_record_${Date.now()}.webm`;
      const filePath = `outbound/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('whatsapp_media')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp_media')
        .getPublicUrl(filePath);

      const tempId = `temp-audio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setMessages(prev => [...prev, {
        id: tempId,
        deal_id: activeDealId,
        sender_phone: activeChatPhone,
        chat_id: activeChatId,
        content: 'Mensagem de voz',
        sender_type: 'sales',
        source: 'whatsapp',
        created_at: new Date().toISOString(),
        message_type: 'audio',
        media_url: publicUrl,
        metadata: { send_status: sendQueueRef.current.length || isProcessingSendQueueRef.current ? 'queued' : 'sending' },
        is_optimistic: true
      }]);
      enqueueOutgoingMessage({
        tempId,
        dealId: activeDealId,
        content: 'Mensagem de voz',
        recipientId: activeRecipientId,
        mediaUrl: publicUrl,
        messageType: 'audio',
        options: {
          chatId: activeChatId,
          recipientPhone: activeRecipientId,
          senderPhone: activeSenderPhone
        }
      });
    } catch (err) {
      console.error('Erro ao enviar Ã¡udio:', err);
      alert('Falha ao enviar Ã¡udio.');
    } finally {
      setIsUploading(false);
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `outbound/${fileName}`;

      // 1. Upload para o bucket 'whatsapp_media'
      const { error: uploadError } = await supabase.storage
        .from('whatsapp_media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Pegar URL pÃºblica (Garante que a Z-API consiga baixar)
      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp_media')
        .getPublicUrl(filePath);

      // 3. Determinar tipo de mensagem
      let type = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('audio/')) type = 'audio';
      else if (file.type.startsWith('video/')) type = 'video';

      const tempId = `temp-file-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const content = `Arquivo: ${file.name}`;
      setMessages(prev => [...prev, {
        id: tempId,
        deal_id: activeDealId,
        sender_phone: activeChatPhone,
        chat_id: activeChatId,
        content,
        sender_type: 'sales',
        source: 'whatsapp',
        created_at: new Date().toISOString(),
        message_type: type,
        media_url: publicUrl,
        metadata: { send_status: sendQueueRef.current.length || isProcessingSendQueueRef.current ? 'queued' : 'sending' },
        is_optimistic: true
      }]);
      enqueueOutgoingMessage({
        tempId,
        dealId: activeDealId,
        content,
        recipientId: activeRecipientId,
        mediaUrl: publicUrl,
        messageType: type,
        options: {
          chatId: activeChatId,
          recipientPhone: activeRecipientId,
          senderPhone: activeSenderPhone
        }
      });
      
    } catch (err) {
      console.error('Erro no upload/envio:', err);
      alert('Falha ao enviar arquivo. Verifique se o bucket "whatsapp_media" existe e Ã© pÃºblico.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAnalyzeConversation = async (convId) => {
    setAnalyzingIds(prev => new Set(prev).add(convId));
    try {
      const { data: functionData, error } = await supabase.functions.invoke('analyze-conversation', {
        body: { conversation_id: convId, deal_id: activeDealId }
      });
      if (error) throw error;
      if (functionData?.error) throw new Error(functionData.error);

      const aiResponse = functionData?.analysis;
      if (aiResponse) {
        // [ATOMIC SYNC] Injetar anÃ¡lise direto na mensagem local
        setMessages(prev => prev.map(msg => 
          msg.id === convId ? { ...msg, metadata: { ...msg.metadata, ai_analysis: aiResponse } } : msg
        ));
      }
    } catch (err) {
      console.error('AI Analysis Trigger Failed:', err);
      // [QUOTA UX] Alerta especÃ­fico para limites da conta
      if (err.message?.includes('429') || err.message?.includes('Rate limit')) {
        alert('OrÃ¡culo: Limite de velocidade da OpenAI atingido. Este plano permite poucas requisiÃ§Ãµes por minuto. Aguarde um pouco.');
      }
    } finally {
      setAnalyzingIds(prev => {
        const next = new Set(prev);
        next.delete(convId);
        return next;
      });
    }
  };

  // [ELITE DIAGNOSTIC] Monitorar mudanÃ§as no chat ativo
  useEffect(() => {
    if (activeChat) {
      console.log(`[Stitch Audit] Chat Ativo: ${activeChat.contact_name} | IA Insight:`, activeChat.ai_global_analysis?.diagnostic ? 'PRESENTE' : 'AUSENTE');
    }
  }, [activeChat]);

  const handleGlobalAnalyze = async () => {
    let currentDealId = activeDealId;
    if (isGlobalAnalyzing || !activeChat) return;
    
    const anchorPhone = activeChatPhone || activeChat.contact_phone;
    console.log('[Stitch Oracle] MODO GLOBAL ATIVADO para:', anchorPhone);
    setIsGlobalAnalyzing(true);
    setShowOracleModal(true);
    
    try {
      // 1. Analise global exige um negocio real no pipeline.
      if (!currentDealId) {
        throw new Error('Adicione este atendimento ao pipeline antes de rodar a analise Oracle. O sistema nao cria empresa ou negocio automaticamente.');
      }

      console.log('[Stitch Oracle] Invocando CÃ©rebro Global...');

      currentDealId = await resolveDealIdForActiveThread(currentDealId);
      if (!currentDealId) {
        throw new Error('Nao foi possivel localizar um negocio valido para analisar esta conversa.');
      }

      const invokePromise = supabase.functions.invoke('analyze-conversation', {
        body: { deal_id: currentDealId, global: true }
      });
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Tempo limite atingido na anÃ¡lise. Tente novamente em alguns segundos.')), 45000);
      });
      const { data: functionData, error: functionError } = await Promise.race([invokePromise, timeoutPromise]);
      
      if (functionError) {
        const readableError = await extractFunctionErrorMessage(functionError);
        throw new Error(readableError || functionError.message || 'Falha ao executar analise Oracle.');
      }
      if (functionData?.error) throw new Error(functionData.error);
      
      console.log('[Stitch Oracle DEBUG] RESPOSTA BRUTA:', functionData);
      const aiResponse = functionData?.analysis || functionData; // Fallback se o objeto vier sem o wrapper
      console.log('[Stitch Oracle] AnÃ¡lise Global Recebida:', aiResponse?.diagnostic ? 'SUCESSO (DiagnÃ³stico Presente)' : 'FALHA DE ESTRUTURA');

      // [ULTRA SYNC] Atualizar o inbox localmente COM O DADO DIRETO DA FUNÃ‡ÃƒO
      setInbox(prev => prev?.map(chat => 
        (chat.deal_id === currentDealId || chat.contact_phone === anchorPhone)
          ? { 
              ...chat, 
              deal_id: currentDealId, 
              ai_global_analysis: aiResponse || chat.ai_global_analysis,
              is_qualified: true 
            } 
          : chat
      ));
      setActiveChat(prev => prev ? {
        ...prev,
        deal_id: currentDealId,
        ai_global_analysis: aiResponse || prev.ai_global_analysis,
        is_qualified: true
      } : prev);
      scrollToLatestMessage('smooth');

      // 3. [BACKUP SYNC] Opcional: Refetch longo prazo
      setTimeout(async () => {
         const { data: updatedDeal } = await supabase.from('deals').select('*').eq('id', currentDealId).single();
         if (updatedDeal?.ai_global_analysis) {
           setInbox(prev => prev?.map(chat => 
             chat.deal_id === currentDealId ? { ...chat, ai_global_analysis: updatedDeal.ai_global_analysis } : chat
           ));
           setActiveChat(prev => prev && prev.deal_id === currentDealId
             ? { ...prev, ai_global_analysis: updatedDeal.ai_global_analysis }
             : prev
           );
         }
      }, 1000);
    } catch (err) {
      console.error('[Stitch Oracle] FALHA CRÃTICA:', err);
      
      // [ELITE QUOTA UX] TraduÃ§Ã£o inteligente para o usuÃ¡rio
      if (err.message?.includes('429') || err.message?.includes('Rate limit')) {
        alert('OrÃ¡culo: Limite de cota atingido (Sua conta OpenAI estÃ¡ no Tier 0: limite de 3 pedidos/min). Aguarde 60s ou adicione crÃ©ditos ($5) para liberar acesso total.');
      } else if (err.message?.includes('insufficient_quota') || err.message?.includes('balance')) {
        alert('OrÃ¡culo: Saldo insuficiente na OpenAI. Por favor, recarregue seus crÃ©ditos para continuar usando a inteligÃªncia.');
      } else {
        alert('OrÃ¡culo: ' + (err.message || 'Erro inesperado na anÃ¡lise global.'));
      }
    } finally {
      setIsGlobalAnalyzing(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!activeChatId) return;
    
    const confirmDelete = window.confirm(`Deseja realmente excluir TODA a conversa com ${activeChat.contact_name}? Esta aÃ§Ã£o nÃ£o pode ser desfeita.`);
    if (!confirmDelete) return;

    try {
      setIsDeleting(true);
      setShowChatMenu(false);
      
      await deleteChat(activeChatId);
      
      // [Optimistic UI] Remover do inbox localmente
      setInbox(prev => prev.filter(c => c.id !== activeChatId));
      
      // Limpar chat ativo
      setActiveChat(null);
      setMessages([]);
      
      console.log('[Stitch] Chat excluÃ­do com sucesso.');
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleApplySuggestion = (suggestion) => {
    if (!suggestion) return;
    setNewMessage(suggestion);
  };

  const extractFunctionErrorMessage = async (error) => {
    if (!error) return null;

    try {
      if (error.context && typeof error.context.json === 'function') {
        const payload = await error.context.json();
        return payload?.error || payload?.message || null;
      }

      if (error.context && typeof error.context.text === 'function') {
        const text = await error.context.text();
        if (text) {
          try {
            const payload = JSON.parse(text);
            return payload?.error || payload?.message || text;
          } catch {
            return text;
          }
        }
      }
    } catch {
      return error.message || null;
    }

    return error.message || null;
  };

  return (
    <div className="relative z-0 flex flex-col gap-3 pb-8 pt-0 -mt-16 animate-in fade-in duration-700">
      <div className="pointer-events-none absolute -top-20 left-24 h-72 w-72 rounded-full bg-cyan-200/35 blur-3xl" />
      <div className="pointer-events-none absolute top-10 right-12 h-72 w-72 rounded-full bg-fuchsia-200/35 blur-3xl" />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Conversas</h1>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            Central de atendimento WhatsApp com leitura em tempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: 'Atendimentos', value: inboxMetrics.total, icon: Send },
            { label: 'Hoje', value: inboxMetrics.activeToday, icon: CheckCircle2 },
            { label: 'Grupos', value: inboxMetrics.groups, icon: Users },
            { label: 'Pipeline', value: inboxMetrics.pipeline, icon: Rocket }
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-700 shadow-sm backdrop-blur-xl"
              >
                <Icon className="h-3.5 w-3.5 text-primary" />
                <span className="text-slate-950">{metric.value}</span>
                <span className="hidden sm:inline">{metric.label}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-700 shadow-sm backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.7)]" />
            Inbox ativo
          </div>
        </div>
      </div>

      <div className="relative h-[calc(100vh-154px)] min-h-[686px] overflow-hidden rounded-[2.5rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(196,250,255,0.46),rgba(250,230,255,0.36))] shadow-[0_28px_85px_rgba(15,23,42,0.16)] backdrop-blur-2xl flex ring-1 ring-slate-900/5">
      
      {/* ðŸ“± LISTA DE CONVERSAS (Sidebar Esquerda) */}
      <div className={cn(
        "w-full md:w-[420px] border-r border-white/60 flex flex-col bg-white/55 backdrop-blur-2xl",
        (activeDealId || activeChatPhone) && "hidden md:flex"
      )}>
        <div className="p-8 space-y-6 border-b border-white/60 bg-white/35">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-950">Mensagens</h2>
              <p className="text-sm font-bold text-slate-600 mt-1">Atendimentos WhatsApp em tempo real</p>
            </div>
            <button className="p-3 hover:bg-white rounded-2xl text-slate-700 transition-all border border-white/60 shadow-sm">
              <Filter className="w-5 h-5" />
            </button>
          </div>
          
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-primary transition-colors" />
            <input 
              type="text"
              placeholder="Buscar chats ou mensagens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white/85 border border-slate-300 rounded-2xl text-base text-slate-900 placeholder:text-slate-500 font-semibold focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3 custom-scrollbar">
          {loadingInbox ? (
            <div className="py-20 flex justify-center"><LoadingSpinner /></div>
          ) : filteredInbox?.length === 0 ? (
            <div className="py-20 text-center text-slate-600 italic text-base font-semibold">Nenhuma conversa encontrada</div>
          ) : filteredInbox?.map((chat, idx) => {
            // [Elite Fix] Unique Key
            const chatKey = chat.id;
            const isActive = activeChatId === chat.id;
            
            return (
              <button 
                key={chatKey}
                onClick={() => {
                  pendingInitialScrollRef.current = true;
                  setActiveChat(chat);
                  setMessages([]); // Limpeza visual imediata
                }}
                className={cn(
                  "w-full p-5 rounded-[2rem] flex gap-4 transition-all duration-300 items-start text-left group border",
                  isActive 
                    ? "bg-white shadow-xl shadow-slate-200/60 border-primary/20 ring-4 ring-primary/5" 
                    : "bg-white/45 border-white/50 hover:bg-white/85 hover:shadow-lg"
                )}
              >
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-white/80 flex items-center justify-center text-slate-700 font-black overflow-hidden shadow-sm">
                     {chat.is_group ? <Users className="w-6 h-6" /> : (chat.contact_name?.[0]?.toUpperCase() || <User />)}
                  </div>
                  <div className={cn(
                    "absolute bottom-0 right-0 w-4 h-4 border-2 border-white rounded-full shadow-sm",
                    chat.is_group ? "bg-primary" : "bg-emerald-500"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-black text-slate-950 truncate text-lg">{chat.contact_name}</h4>
                    <span className="text-sm text-slate-700 font-bold whitespace-nowrap">
                      {chat.last_message_at ? formatRelative(new Date(chat.last_message_at), new Date(), { locale: ptBR }) : ''}
                    </span>
                  </div>
                  <p className={cn(
                    "text-base truncate transition-colors font-semibold",
                    chat.sender_type === 'user' ? "text-slate-600" : "text-slate-700"
                  )}>
                    {chat.sender_type === 'user' && 'VocÃª: '}
                    {chat.last_message}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-slate-100 text-slate-700">
                        {chat.deal_title}
                      </span>
                      {chat.is_group && (
                         <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-blue-100 text-blue-700">
                           Grupo
                         </span>
                      )}
                      {!chat.is_qualified ? (
                        <span className={cn(
                          "text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full",
                          chat.contact_is_auto ? "bg-amber-100 text-amber-600 animate-pulse" : "bg-slate-200 text-slate-600"
                        )}>
                          {chat.contact_is_auto ? 'Novo Lead' : 'NÃ£o Qualificado'}
                        </span>
                      ) : (
                        <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-primary/10 text-primary">
                          {chat.stage_label}
                        </span>
                      )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ðŸ’¬ JANELA DE CHAT (Direita) */}
          <div className={cn(
        "flex-1 flex flex-col bg-white/20 relative",
        !activeChat && "hidden md:flex items-center justify-center"
      )}>
        {activeChat ? (
          <>
            {/* Header do Chat */}
            <div className="p-6 border-b border-white/60 bg-white/65 backdrop-blur-2xl flex justify-between items-center z-10 box-decoration-clone shadow-sm">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveChat(null)} className="md:hidden p-2 text-slate-700"><ArrowLeft /></button>
                <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-white/80 flex items-center justify-center font-black text-slate-700 shadow-sm overflow-hidden">
                   {activeChat.contact_name?.[0]}
                </div>
                <div>
                  <h3 className="font-black text-slate-950 tracking-tight text-lg">{activeChat.contact_name}</h3>
                  <div className="flex items-center gap-2">
                     <div className={cn("w-2 h-2 rounded-full animate-pulse", activeChat.is_group ? "bg-primary" : "bg-emerald-500")} />
                     <p className="text-sm text-slate-700 font-black uppercase tracking-widest flex items-center gap-2">
                        {activeChat.is_group ? 'Grupo WhatsApp' : 'WhatsApp Online'}
                        {!activeChat.is_qualified ? (
                          <span className={cn("ml-2 font-black", activeChat.contact_is_auto ? "text-amber-600" : "text-slate-700")}>
                            â€¢ {activeChat.contact_is_auto ? 'Novo Lead' : 'Lead NÃ£o Qualificado'}
                          </span>
                        ) : (
                          <span className="ml-2 text-primary font-black">â€¢ {activeChat.stage_label}</span>
                        )}
                     </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                {/* âš¡ STATUS BADGE (ELITE FEEDBACK) */}
                {isGlobalAnalyzing && (
                  <div className="mr-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full flex items-center gap-2 animate-pulse">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <span className="text-xs font-black uppercase text-primary tracking-widest">Oracle Thinking</span>
                  </div>
                )}

                {/* âš¡ BOTÃƒO GLOBAL ORACLE BOLT */}
                <button 
                  onClick={handleGlobalAnalyze}
                  disabled={isGlobalAnalyzing}
                  title="AnÃ¡lise Global 360Â° (Oracle)"
                  className={cn(
                    "relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-700 group",
                    isGlobalAnalyzing 
                      ? "bg-primary text-white scale-110 shadow-[0_0_40px_rgba(59,130,246,0.6)]" 
                      : "bg-white border border-slate-200 text-primary hover:border-primary hover:shadow-xl hover:shadow-primary/10"
                  )}
                >
                  {isGlobalAnalyzing ? (
                    <LoadingSpinner size="xs" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">bolt</span>
                      {/* Glow Pulse Effect */}
                      <span className="absolute inset-0 bg-primary/20 animate-ping opacity-0 group-hover:opacity-100 rounded-full" />
                      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/40 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    </>
                  )}
                </button>

                <div className="h-8 w-px bg-slate-200 mx-2" />

                {canQualifyActiveChat && (
                  <button 
                    onClick={() => setIsQualifying(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-primary/20"
                  >
                    <Rocket className="w-3.5 h-3.5" />
                    Adicionar ao Pipeline
                  </button>
                )}
                <div className="h-8 w-px bg-slate-200 mx-2" />
                <button className="p-3 hover:bg-white rounded-2xl text-slate-700 transition-colors border border-white/50"><Phone className="w-5 h-5" /></button>
                
                {/* ðŸ”´ MENU DE OPÃ‡Ã•ES (DELETE) */}
                <div className="relative">
                  <button 
                    onClick={() => setShowChatMenu(!showChatMenu)}
                    className={cn(
                      "p-3 rounded-2xl transition-all duration-300",
                      showChatMenu ? "bg-white text-slate-900" : "text-slate-700 hover:bg-white"
                    )}
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  <AnimatePresence>
                    {showChatMenu && (
                      <>
                        {/* Overlay para fechar ao clicar fora */}
                        <div className="fixed inset-0 z-40" onClick={() => setShowChatMenu(false)} />
                        
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: 10 }}
                          className="absolute right-0 mt-2 w-56 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-[2rem] shadow-2xl z-50 overflow-hidden"
                        >
                          <div className="p-2">
                             <button 
                               onClick={handleDeleteChat}
                               disabled={isDeleting}
                               className="w-full flex items-center gap-3 px-4 py-4 text-red-500 hover:bg-red-50 rounded-2xl transition-colors text-sm font-bold group"
                             >
                                <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                   {isDeleting ? <LoadingSpinner size="xs" /> : <Trash2 className="w-4 h-4" />}
                                </div>
                                <span>{isDeleting ? 'Excluindo...' : 'Excluir Conversa'}</span>
                             </button>
                             
                             <div className="h-px bg-slate-100 my-1 mx-2" />
                             
                             <button 
                               onClick={() => setShowChatMenu(false)}
                               className="w-full flex items-center gap-3 px-4 py-4 text-slate-600 hover:bg-slate-50 rounded-2xl transition-colors text-sm font-bold"
                             >
                                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                                   <ArrowLeft className="w-4 h-4" />
                                </div>
                                <span>Voltar</span>
                             </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Mensagens */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar scroll-smooth bg-[linear-gradient(180deg,rgba(255,255,255,0.20),rgba(240,249,255,0.18),rgba(250,245,255,0.18))]"
            >
              <div className="flex flex-col items-center py-8">
                 <span className="px-5 py-2 rounded-full bg-white/90 text-sm font-black text-slate-700 uppercase tracking-widest shadow-sm mb-4 border border-white/70">
                   InÃ­cio da Conversa â€” {activeChat.deal_title}
                 </span>
              </div>

              {!isLoadingMessages && displayedMessages.length === 0 ? (
                <div className="flex justify-center py-10">
                  <div className="px-6 py-4 rounded-3xl bg-white/80 border border-white/70 shadow-sm text-sm font-bold text-slate-500">
                    Nenhuma mensagem encontrada neste atendimento.
                  </div>
                </div>
              ) : null}

              {displayedMessages.map((msg) => {
                const isMe = msg.sender_type === 'sales';
                const hasAI = msg.metadata?.ai_analysis;
                const sendStatus = msg.metadata?.send_status;
                const replyMeta = msg.metadata?.reply_to_content || msg.metadata?.reply_to_message_id
                  ? {
                      sender: msg.metadata?.reply_to_sender || 'Mensagem citada',
                      content: msg.metadata?.reply_to_content || 'Mensagem citada'
                    }
                  : null;

                return (
                  <div key={msg.id} className="w-full">
                    <div 
                      className={cn(
                        "flex flex-col max-w-[80%] animate-in slide-in-from-bottom-2 duration-300 relative",
                        isMe ? "ml-auto items-end" : "items-start"
                      )}
                    >
                      {/* BotÃ£o Oracle (Bolt) Elite - Refined Position */}
                      {!isMe && (
                        <button 
                          onClick={() => handleAnalyzeConversation(msg.id)}
                          className={cn(
                            "absolute -right-9 top-8 w-7 h-7 bg-white/90 backdrop-blur-md rounded-full shadow-sm border border-white/70 text-primary flex items-center justify-center transition-all hover:scale-110 hover:bg-white hover:shadow-md active:scale-90 z-20",
                            analyzingIds.has(msg.id) ? "opacity-100" : "opacity-0 group-hover/bubble:opacity-90"
                          )}
                          title="AnÃ¡lise estratÃ©gica do Oracle"
                        >
                          <span className={cn("material-symbols-outlined text-[14px]", analyzingIds.has(msg.id) && "animate-spin")}>bolt</span>
                        </button>
                      )}

                      <div className={cn(
                        "relative group/bubble px-7 py-5 rounded-[2rem] text-lg font-semibold shadow-md transition-all border leading-relaxed",
                        isMe 
                          ? "bg-primary text-white border-primary/20 rounded-tr-sm shadow-primary/20" 
                          : "bg-white/95 text-slate-800 border-white/80 rounded-tl-sm hover:shadow-lg",
                        msg.is_optimistic && "opacity-70 animate-pulse"
                      )}>
                        <button
                          onClick={() => setReplyToMessage(getReplyPreview(msg))}
                          disabled={!msg.external_message_id}
                          className={cn(
                            "absolute top-2 w-7 h-7 bg-white/95 backdrop-blur-md rounded-full shadow-md border border-slate-100 text-slate-500 flex items-center justify-center transition-all hover:scale-110 hover:bg-white hover:text-primary hover:shadow-lg active:scale-95 z-20",
                            isMe ? "left-2 -translate-x-full -ml-1" : "right-2 translate-x-full mr-1",
                            !msg.external_message_id ? "hidden" : "opacity-0 group-hover/bubble:opacity-100"
                          )}
                          title="Responder esta mensagem"
                        >
                          <Reply className="w-3.5 h-3.5" />
                        </button>

                        {replyMeta && (
                          <div className={cn(
                            "mb-3 rounded-2xl border-l-4 px-4 py-3 text-sm",
                            isMe ? "bg-white/10 border-white/70 text-white/90" : "bg-slate-50 border-primary/70 text-slate-700"
                          )}>
                            <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", isMe ? "text-white/70" : "text-primary")}>
                              Respondendo {replyMeta.sender}
                            </p>
                            <p className="font-bold leading-snug line-clamp-3">
                              {replyMeta.content}
                            </p>
                          </div>
                        )}
                        
                        
                        {/* ðŸ–¼ï¸ RENDERIZADOR MULTIMÃDIA ELITE (v8.0) */}
                        {msg.message_type === 'image' && msg.media_url && (
                          <div className="mb-3 -mx-2 -mt-1 overflow-hidden rounded-[1.5rem] border border-slate-100 shadow-inner bg-slate-50 flex justify-center">
                            <img 
                              src={msg.media_url} 
                              alt="WhatsApp" 
                              className="max-w-[350px] max-h-[400px] w-auto h-auto object-contain hover:scale-105 transition-transform duration-500 cursor-zoom-in rounded-[1rem]"
                              onClick={() => window.open(msg.media_url, '_blank')}
                            />
                          </div>
                        )}
                        
                        {msg.message_type === 'audio' && msg.media_url && (
                          <div className={cn(
                            "mb-3 p-4 rounded-3xl flex items-center gap-4 min-w-[240px]",
                            isMe ? "bg-white/10" : "bg-slate-50 border border-slate-100"
                          )}>
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center shadow-lg",
                              isMe ? "bg-white text-primary" : "bg-primary text-white"
                            )}>
                              <Mic className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                               <p className={cn("text-xs font-black uppercase tracking-widest mb-1", isMe ? "text-white/70" : "text-slate-600")}>Mensagem de Voz</p>
                               <audio src={msg.media_url} controls className={cn("h-8 w-full", isMe && "invert")} />
                            </div>
                          </div>
                        )}

                        {msg.message_type === 'video' && msg.media_url && (
                          <div className="mb-3 -mx-2 -mt-1 overflow-hidden rounded-[1.5rem] bg-black shadow-2xl">
                            <video src={msg.media_url} controls className="max-w-full h-auto aspect-video" />
                          </div>
                        )}

                        {msg.message_type === 'document' && msg.media_url && (
                          <a 
                            href={msg.media_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={cn(
                              "flex items-center gap-4 p-4 rounded-[1.5rem] transition-all mb-2 border",
                              isMe ? "bg-white/10 border-white/20 hover:bg-white/20" : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                            )}
                          >
                            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-md", isMe ? "bg-white text-primary" : "bg-primary text-white")}>
                              <FileText className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className={cn("text-xs font-black uppercase tracking-widest", isMe ? "text-white/70" : "text-slate-600")}>Documento</p>
                               <p className={cn("text-sm font-bold truncate", isMe ? "text-white" : "text-slate-800")}>Ver arquivo anexo</p>
                            </div>
                            <Download className="w-4 h-4 opacity-40 shrink-0" />
                          </a>
                        )}

                        <div className={cn(
                          "leading-relaxed whitespace-pre-wrap break-words",
                          msg.message_type !== 'text' && "mt-3 pt-3 border-t font-semibold text-base",
                          msg.message_type !== 'text' && (isMe ? "border-white/10 text-white/95 italic" : "border-slate-100 text-slate-700 italic")
                        )}>
                          {msg.content}
                        </div>

                        {sendStatus && (
                          <div className={cn(
                            "mt-3 pt-2 border-t text-[10px] font-black uppercase tracking-[0.18em]",
                            sendStatus === 'failed'
                              ? "border-red-200 text-red-100"
                              : isMe
                                ? "border-white/10 text-white/70"
                                : "border-slate-100 text-slate-400"
                          )}>
                            {sendStatus === 'queued' && 'Na fila'}
                            {sendStatus === 'sending' && 'Enviando'}
                            {sendStatus === 'failed' && (msg.metadata?.send_error || 'Falha ao enviar')}
                          </div>
                        )}
                      </div>

                      <span className="text-[11px] text-slate-600 mt-2 font-black uppercase tracking-[0.12em] px-4">
                        {isMe ? 'VocÃª' : 'Cliente'} â€¢ {msg.created_at ? formatRelative(new Date(msg.created_at), new Date(), { locale: ptBR }) : 'Agora'}
                        {msg.metadata?.is_edited ? ' â€¢ Editada' : ''}
                      </span>
                    </div>

                    {/* ðŸ§  ORACLE INSIGHT CARD (Implementation v7.5) */}
                    <AnimatePresence>
                      {hasAI && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: 'auto' }}
                          exit={{ opacity: 0, y: -10, height: 0 }}
                          className="w-full mt-4 mb-8"
                        >
                          <div className="max-w-[85%] mx-auto bg-gradient-to-br from-white/90 to-slate-50/90 backdrop-blur-xl rounded-[2.5rem] border border-primary/20 p-8 shadow-2xl shadow-primary/10 relative overflow-hidden group/insight transition-all hover:border-primary/40">
                             {/* Magic Particles Simulation */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                            
                            <div className="flex justify-between items-start relative z-10">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/30">
                                  <span className="material-symbols-outlined text-white">sparkles</span>
                                </div>
                                <div>
                                  <h5 className="text-[11px] font-black uppercase tracking-[0.25em] text-primary">Oracle Highlight</h5>
                                  <p className="text-[10px] font-bold text-slate-400">Decision Intelligence â€¢ {msg.metadata.ai_analysis.strategy_category}</p>
                                </div>
                              </div>
                              
                              <div className={cn(
                                "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm",
                                msg.metadata.ai_analysis.temperature === 'hot' ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                                msg.metadata.ai_analysis.temperature === 'risk' ? "bg-rose-50 border-rose-100 text-rose-600" :
                                "bg-slate-50 border-slate-100 text-slate-500"
                              )}>
                                {msg.metadata.ai_analysis.temperature}
                              </div>
                            </div>

                            <div className="mt-6 space-y-6 relative z-10">
                              <div className="p-4 bg-white/60 rounded-[2rem] border border-white/40 shadow-sm">
                                <p className="text-sm font-bold text-slate-700 italic leading-relaxed">
                                  "{msg.metadata.ai_analysis.diagnostic}"
                                </p>
                              </div>

                              <div className="space-y-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">AÃ§Ã£o Sugerida pelo Oracle</span>
                                <div className="bg-primary/5 p-6 rounded-[2rem] border border-primary/10 group/msg relative transition-all hover:bg-primary/10">
                                  <p className="text-sm font-manrope font-bold text-slate-800 leading-tight mb-4">
                                    {msg.metadata.ai_analysis.recommended_action?.suggested_message}
                                  </p>
                                  <button 
                                    onClick={() => handleApplySuggestion(msg.metadata.ai_analysis.recommended_action?.suggested_message)}
                                    className="w-full py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                                  >
                                    <span className="material-symbols-outlined text-base">auto_fix_high</span>
                                    Aplicar SugestÃ£o no Chat
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
              <div ref={latestMessageRef} className="h-px w-full" aria-hidden="true" />
            </div>

            {/* Input de Mensagem */}
            <div className="p-7 bg-white/55 border-t border-white/60 backdrop-blur-2xl">
              {replyToMessage && (
                <div className="mb-3 mx-2 rounded-2xl bg-white/90 border border-primary/15 border-l-4 border-l-primary px-5 py-3 shadow-sm flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">
                      Respondendo {replyToMessage.sender}
                    </p>
                    <p className="text-sm font-bold text-slate-700 truncate">
                      {replyToMessage.content}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyToMessage(null)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    title="Cancelar resposta"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className={cn(
                "relative flex items-center gap-4 bg-white/95 p-2 rounded-[2.5rem] shadow-2xl border border-white/80 transition-all",
                isRecording ? " ring-4 ring-red-500/10 border-red-100" : "focus-within:ring-4 ring-primary/5"
              )}>
                <input 
                  type="file" 
                  hidden 
                  ref={fileInputRef} 
                  onChange={handleFileUpload}
                  accept="image/*,audio/*,video/*,application/pdf"
                />
                <AnimatePresence>
                  {showEmojiPicker && !isRecording && (
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.98 }}
                      className="absolute left-5 bottom-[5.25rem] z-50 w-[min(420px,calc(100vw-2rem))] rounded-[1.75rem] bg-white/95 backdrop-blur-2xl border border-white/80 shadow-2xl p-4"
                    >
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={emojiSearch}
                          onChange={(event) => setEmojiSearch(event.target.value)}
                          placeholder="Pesquisar emoji"
                          className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/10"
                        />
                      </div>

                      <div className="max-h-72 overflow-y-auto custom-scrollbar pr-1 space-y-4">
                        {filteredEmojiCategories.length ? filteredEmojiCategories.map((category) => (
                          <div key={category.label}>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
                              {category.label}
                            </p>
                            <div className="grid grid-cols-8 gap-1">
                              {category.emojis.map((emoji) => (
                                <button
                                  key={`${category.label}-${emoji}`}
                                  type="button"
                                  onClick={() => insertEmoji(emoji)}
                                  className="h-10 rounded-xl text-2xl flex items-center justify-center hover:bg-primary/10 active:scale-90 transition-all"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        )) : (
                          <div className="py-8 text-center text-sm font-bold text-slate-400">
                            Nenhum emoji encontrado.
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {!isRecording ? (
                  <>
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading || isRecording}
                      className={cn(
                        "p-3 rounded-full transition-all text-slate-700 hover:bg-slate-50 hover:text-primary disabled:opacity-30"
                      )}
                    >
                      <Paperclip className="w-6 h-6" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(prev => !prev)}
                      className={cn(
                        "p-3 rounded-full transition-all text-slate-700 hover:bg-slate-50 hover:text-primary",
                        showEmojiPicker && "bg-primary/10 text-primary"
                      )}
                      title="Enviar emoji"
                    >
                      <Smile className="w-6 h-6" />
                    </button>

                    <input 
                      type="text" 
                      ref={messageInputRef}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder="Escreva sua resposta..."
                      className="flex-1 bg-transparent py-4 text-lg focus:outline-none text-slate-900 placeholder:text-slate-500 font-semibold"
                    />

                    {/* BotÃ£o de Gravar Ãudio */}
                    <button 
                      type="button"
                      onClick={handleStartRecording}
                      className="p-3 text-slate-700 hover:bg-slate-50 hover:text-red-500 transition-all"
                    >
                      <Mic className="w-6 h-6" />
                    </button>

                    <button 
                      type="button"
                      onClick={handleSendMessage}
                      disabled={isUploading || !newMessage.trim()}
                      className="px-8 py-4 bg-primary text-white rounded-[2rem] font-black text-sm uppercase tracking-widest flex items-center gap-2 hover:bg-primary-container transition-all shadow-xl shadow-primary/20 active:scale-95 disabled:opacity-50"
                    >
                      {isSending && !newMessage.trim()
                        ? <LoadingSpinner size="sm" />
                        : <><Send className="w-4 h-4" /> {sendQueueSize > 0 ? `Enviar (${sendQueueSize})` : 'Enviar'}</>}
                    </button>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-between px-4 py-2">
                    <div className="flex items-center gap-4">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
                      <span className="text-sm font-black text-slate-800 font-mono tracking-tighter w-12">
                        {formatTimer(recordingTime)}
                      </span>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                        Gravando Voz...
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleStopRecording(false)}
                        className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all rounded-full"
                        title="Cancelar GravaÃ§Ã£o"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleStopRecording(true)}
                        className="px-6 py-3 bg-red-500 text-white rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Finalizar e Enviar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center space-y-6 max-w-sm">
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-300 animate-pulse">
               <Send className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Selecione um Atendimento</h3>
              <p className="text-sm text-slate-400 mt-2 font-medium">Escolha um lead na lista ao lado para iniciar o atendimento em tempo real via WhatsApp.</p>
            </div>
          </div>
        )}
      </div>
      </div>

      <Modal
        isOpen={showOracleModal}
        onClose={() => setShowOracleModal(false)}
        title="Diagnóstico Oracle"
        className="max-w-3xl"
        footer={
          <div className="flex items-center justify-end gap-3">
            {activeChat?.ai_global_analysis?.recommended_action?.suggested_message && !isGlobalAnalyzing ? (
              <button
                onClick={() => {
                  handleApplySuggestion(activeChat.ai_global_analysis.recommended_action?.suggested_message);
                  setShowOracleModal(false);
                }}
                className="px-6 py-3 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
                Usar sugestão
              </button>
            ) : null}
            <button
              onClick={() => setShowOracleModal(false)}
              className="px-6 py-3 rounded-2xl text-slate-500 font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-colors"
            >
              Fechar
            </button>
          </div>
        }
      >
        {isGlobalAnalyzing ? (
          <div className="py-16 flex flex-col items-center justify-center text-center gap-6">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
            <div>
              <h4 className="text-[12px] font-black uppercase tracking-[0.35em] text-primary mb-3">Oracle processando</h4>
              <p className="text-sm font-bold text-slate-500">Analisando o histórico completo da conversa.</p>
            </div>
          </div>
        ) : activeChat?.ai_global_analysis?.diagnostic ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400 mb-2">Atendimento</p>
                <h3 className="text-xl font-black text-slate-900">{activeChat.contact_name}</h3>
              </div>
              <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                Probabilidade: {activeChat.ai_global_analysis.closing_probability}%
              </div>
            </div>

            <div className="p-6 bg-slate-50/80 rounded-3xl border border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-3">Análise do comportamento</p>
              <p className="text-base font-bold leading-relaxed text-slate-800 whitespace-pre-wrap">
                {activeChat.ai_global_analysis.diagnostic}
              </p>
            </div>

            {activeChat.ai_global_analysis.recommended_action?.suggested_message ? (
              <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary mb-3">Próxima resposta sugerida</p>
                <p className="text-base font-black leading-relaxed text-primary whitespace-pre-wrap">
                  {activeChat.ai_global_analysis.recommended_action.suggested_message}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm font-bold text-slate-500">Nenhum diagnóstico disponível para esta conversa ainda.</p>
          </div>
        )}
      </Modal>

      {/* ðŸš€ MODAL DE QUALIFICAÃ‡ÃƒO (DealForm Reutilizado) */}
      <Modal
        isOpen={isQualifying}
        onClose={() => setIsQualifying(false)}
        title="Qualificar Novo Lead WhatsApp"
        size="lg"
        footer={
          <div className="flex gap-4">
            <button 
              onClick={() => setIsQualifying(false)}
              className="px-8 py-3 rounded-2xl text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              form="deal-form"
              className="px-10 py-3 rounded-2xl bg-primary hover:bg-primary-container text-white font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/20 transition-all active:scale-95 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Finalizar QualificaÃ§Ã£o
            </button>
          </div>
        }
      >
        <div className="p-2">
            <p className="text-sm text-slate-500 mb-8 font-medium">
              Transforme este contato de WhatsApp em um negÃ³cio oficial do seu funil. Preencha os detalhes da oportunidade abaixo.
            </p>
            <DealForm 
              initialData={{
                id: activeChat?.deal_id,
                title: activeChat?.contact_name,
                company: activeChat?.contact_name,
                contacts: [{ name: activeChat?.contact_name, phone: activeChat?.contact_phone || '', role: 'Lead WhatsApp' }],
                leadSource: 'Whatsapp',
                stage: activeChat?.stage || defaultPipelineStageId
              }}
              onSuccess={handleQualifySuccess}
              onCancel={() => setIsQualifying(false)}
            />
        </div>
      </Modal>
    </div>
  );
}
