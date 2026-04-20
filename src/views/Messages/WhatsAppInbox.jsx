// src/views/Messages/WhatsAppInbox.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MoreVertical, Send, Phone, User, Filter, ArrowLeft, Rocket, CheckCircle2, Users, Image as ImageIcon, Mic, FileText, Play, Download, Trash2, Paperclip, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSupabase } from '@/hooks/useSupabase';
import { getWhatsAppInbox, deleteChat } from '@/services/whatsapp';
import { getConversationsByContext, createConversation } from '@/services/conversations';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner, GlassCard, Modal, Badge } from '@/components/ui';
import { DealForm } from '@/views/Funnel/DealForm';
import { formatRelative } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';

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
  const [isQualifying, setIsQualifying] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState(new Set());
   const [isGlobalAnalyzing, setIsGlobalAnalyzing] = useState(false);
   const [showChatMenu, setShowChatMenu] = useState(false);
   const [isDeleting, setIsDeleting] = useState(false);
  
  // [AUDIO RECORDING v29] Estados para o Gravador de Voz
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  
  const { data: inbox, setData: setInbox, loading: loadingInbox, refetch: refetchInbox } = useSupabase(getWhatsAppInbox);
  
  // [ELITE PERFORMANCE] Ordenação memorizada para evitar "travamentos" na UI
  const sortedInbox = React.useMemo(() => {
    if (!inbox) return [];
    return [...inbox].sort((a, b) => {
      const dateA = new Date(a.last_message_at || 0);
      const dateB = new Date(b.last_message_at || 0);
      return dateB - dateA;
    });
  }, [inbox]);

  const scrollRef = useRef(null);

  // --- [DERIVED IDENTITIES] ---
  const activeChatId = activeChat?.id; // Usar a chave única reconstruída (c-ID ou p-Phone)
  const activeDealId = activeChat?.deal_id;
  const activeChatPhone = activeChat?.contact_phone;
  const activeContactId = activeChat?.contact_id;

  // [ELITE PERFORMANCE] Sincronizar o chat ativo sem loops de re-renderização
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

  const isAutoCreated = activeChat?.is_qualified === false;

  // 1. Ouvir mudanças globais para atualizar a lista do Inbox
  useEffect(() => {
    const channel = supabase
      .channel('global-chat-inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deal_conversations' }, (payload) => {
        const newMsg = payload.new;
        
        setInbox(prev => {
          if (!prev) return prev;
          
          const chatIdx = prev.findIndex(chat => 
            chat.id === newMsg.chat_id || 
            (newMsg.contact_id && chat.contact_id === newMsg.contact_id)
          );

          if (chatIdx !== -1) {
            const updated = [...prev];
            updated[chatIdx] = {
              ...updated[chatIdx],
              last_message: newMsg.content,
              last_message_at: newMsg.created_at,
              sender_type: newMsg.sender_type,
              deal_id: newMsg.deal_id || updated[chatIdx].deal_id
            };
            return updated;
          } else {
            // Novo lead: Refetch para garantir integridade dos nomes
            refetchInbox();
            return prev;
          }
        });
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [refetchInbox]);

  // 2. Buscar mensagens quando selecionar um chat (Suporte a Leads e Deals)
  useEffect(() => {
    if (activeDealId || activeChatPhone || activeChatId) {
      loadMessages({ dealId: activeDealId, phone: activeChatPhone, chatId: activeChatId });
      
      const channel = supabase
        .channel(`chat-${activeDealId || activeChatPhone}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'deal_conversations',
          filter: `chat_id=eq.${activeChatId}` // Elite Filter: Specific to this JID
        }, (payload) => {
          if (payload.new) {
            setMessages(prev => {
               // Evitar duplicidade com optimistic records
               const alreadyExists = prev.some(m => m.id === payload.new.id || (m.is_optimistic && m.content === payload.new.content));
               if (alreadyExists) {
                  // Se já existe (ex: acabou de ser enviado pessimamente), só removemos a flag de otimismo se for o caso
                  return prev.map(m => (m.is_optimistic && m.content === payload.new.content) ? payload.new : m);
               }
               return [...prev, payload.new];
            });
          }
        })
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setMessages([]); // Limpar se nada estiver selecionado
    }
  }, [activeDealId, activeChatPhone, activeChatId]);

  async function loadMessages(context) {
    try {
      const msgs = await getConversationsByContext(context);
      setMessages(msgs);
    } catch (err) {
      console.error(err);
    }
  }

  // Auto-scroll sempre que as mensagens mudarem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const currentContext = activeDealId || activeChatPhone;
    if (!newMessage.trim() || !currentContext || isSending) return;

    const content = newMessage;
    setNewMessage(''); 
    
    // [Optimistic UI] Adicionar mensagem localmente
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      deal_id: activeDealId,
      sender_phone: activeChatPhone,
      content: content,
      sender_type: 'sales',
      source: 'whatsapp',
      created_at: new Date().toISOString(),
      is_optimistic: true
    };
    
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      setIsSending(true);
      // v22: Enviamos o Id completo (JID) para evitar duplicidade
      await createConversation(activeDealId, content, 'sales', 'whatsapp', activeChatId);
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(content);
      alert('Erro ao enviar: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  /**
   * [ELITE UPLOAD] Faz o upload de mídia para o Supabase Storage e dispara via WhatsApp
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
      alert("Não foi possível acessar o microfone. Verifique as permissões do seu navegador.");
    }
  };

  const handleStopRecording = (shouldSend = true) => {
    if (!mediaRecorderRef.current) return;
    
    if (!shouldSend) {
      audioChunksRef.current = []; // Limpa os chunks para não disparar o onstop com envio
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

      await createConversation(activeDealId, 'Mensagem de voz', 'sales', 'whatsapp', activeChatId, publicUrl, 'audio');
    } catch (err) {
      console.error('Erro ao enviar áudio:', err);
      alert('Falha ao enviar áudio.');
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

      // 2. Pegar URL pública (Garante que a Z-API consiga baixar)
      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp_media')
        .getPublicUrl(filePath);

      // 3. Determinar tipo de mensagem
      let type = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('audio/')) type = 'audio';
      else if (file.type.startsWith('video/')) type = 'video';

      // 4. Salvar e Disparar
      await createConversation(activeDealId, `Arquivo: ${file.name}`, 'sales', 'whatsapp', activeChatId, publicUrl, type);
      
    } catch (err) {
      console.error('Erro no upload/envio:', err);
      alert('Falha ao enviar arquivo. Verifique se o bucket "whatsapp_media" existe e é público.');
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
        // [ATOMIC SYNC] Injetar análise direto na mensagem local
        setMessages(prev => prev.map(msg => 
          msg.id === convId ? { ...msg, metadata: { ...msg.metadata, ai_analysis: aiResponse } } : msg
        ));
      }
    } catch (err) {
      console.error('AI Analysis Trigger Failed:', err);
      // [QUOTA UX] Alerta específico para limites da conta
      if (err.message?.includes('429') || err.message?.includes('Rate limit')) {
        alert('Oráculo: Limite de velocidade da OpenAI atingido. Este plano permite poucas requisições por minuto. Aguarde um pouco.');
      }
    } finally {
      setAnalyzingIds(prev => {
        const next = new Set(prev);
        next.delete(convId);
        return next;
      });
    }
  };

  // [ELITE DIAGNOSTIC] Monitorar mudanças no chat ativo
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
    
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    try {
      // 1. [VÍNCULO DE EMERGÊNCIA] Garantir que existe um Deal ID
      if (!currentDealId) {
        console.log('[Stitch Oracle] Lead sem negócio. Criando estrutura...');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Atenção: Você precisa estar logado.");

        // [Elite Auto-Company] Criar ou buscar empresa para o Lead
        let targetCompanyId = null;
        
        // Tentativa 1: Buscar empresa padrão ou por nome
        const companyName = `Empresa de ${activeChat.contact_name}`;
        const { data: existingCompany } = await supabase.from('companies').select('id').eq('name', companyName).maybeSingle();
        
        if (existingCompany) {
          targetCompanyId = existingCompany.id;
        } else {
          // Criar nova empresa placeholder
          const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
          const orgId = orgs?.[0]?.id || 'bf18a14a-c234-490f-a48b-7b8579eeff9e';
          
          const { data: newCompany, error: compError } = await supabase.from('companies').insert({
            name: companyName,
            org_id: orgId,
            responsible_id: user.id
          }).select().single();
          
          if (compError) {
            console.warn('[Stitch Oracle] Falha ao criar empresa, tentando prosseguir sem ID:', compError);
          } else {
            targetCompanyId = newCompany.id;
          }
        }

        const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
        const orgId = orgs?.[0]?.id || 'bf18a14a-c234-490f-a48b-7b8579eeff9e';

        const { data: newDeal, error: dealError } = await supabase.from('deals').insert({
          title: `Oportunidade Oracle: ${activeChat.contact_name}`,
          org_id: orgId,
          responsible_id: user.id,
          company_id: targetCompanyId, // FIX: Campo obrigatório no schema real
          stage: 'lead',
          status: 'open',
          value: 1000
        }).select().single();

        if (dealError) throw dealError;
        
        console.log('[Stitch Oracle] Negócio criado com sucesso:', newDeal.id);
        currentDealId = newDeal.id;
        
        // Vincular mensagens IMEDIATAMENTE (Retroatividade)
        const { error: linkError } = await supabase.from('deal_conversations')
          .update({ deal_id: newDeal.id })
          .eq('sender_phone', anchorPhone);
          
        if (linkError) console.warn('[Stitch Oracle] Erro menor ao vincular mensagens:', linkError);
        
        // [Elite Fix] Garantir que o estado local reflita o novo Deal
        setActiveChat(prev => ({ ...prev, deal_id: newDeal.id }));
        
        // Pequena pausa para o banco refletir o vínculo antes da IA ler
        await new Promise(r => setTimeout(r, 800));
      }

      console.log('[Stitch Oracle] Invocando Cérebro Global...');

      const { data: functionData, error: functionError } = await supabase.functions.invoke('analyze-conversation', {
        body: { deal_id: currentDealId, global: true }
      });
      
      if (functionError) throw functionError;
      if (functionData?.error) throw new Error(functionData.error);
      
      console.log('[Stitch Oracle DEBUG] RESPOSTA BRUTA:', functionData);
      const aiResponse = functionData?.analysis || functionData; // Fallback se o objeto vier sem o wrapper
      console.log('[Stitch Oracle] Análise Global Recebida:', aiResponse?.diagnostic ? 'SUCESSO (Diagnóstico Presente)' : 'FALHA DE ESTRUTURA');

      // [ULTRA SYNC] Atualizar o inbox localmente COM O DADO DIRETO DA FUNÇÃO
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

      // 3. [BACKUP SYNC] Opcional: Refetch longo prazo
      setTimeout(async () => {
         const { data: updatedDeal } = await supabase.from('deals').select('*').eq('id', currentDealId).single();
         if (updatedDeal?.ai_global_analysis) {
           setInbox(prev => prev?.map(chat => 
             chat.deal_id === currentDealId ? { ...chat, ai_global_analysis: updatedDeal.ai_global_analysis } : chat
           ));
         }
      }, 1000);
    } catch (err) {
      console.error('[Stitch Oracle] FALHA CRÍTICA:', err);
      
      // [ELITE QUOTA UX] Tradução inteligente para o usuário
      if (err.message?.includes('429') || err.message?.includes('Rate limit')) {
        alert('Oráculo: Limite de cota atingido (Sua conta OpenAI está no Tier 0: limite de 3 pedidos/min). Aguarde 60s ou adicione créditos ($5) para liberar acesso total.');
      } else if (err.message?.includes('insufficient_quota') || err.message?.includes('balance')) {
        alert('Oráculo: Saldo insuficiente na OpenAI. Por favor, recarregue seus créditos para continuar usando a inteligência.');
      } else {
        alert('Oráculo: ' + (err.message || 'Erro inesperado na análise global.'));
      }
    } finally {
      setIsGlobalAnalyzing(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!activeChatId) return;
    
    const confirmDelete = window.confirm(`Deseja realmente excluir TODA a conversa com ${activeChat.contact_name}? Esta ação não pode ser desfeita.`);
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
      
      console.log('[Stitch] Chat excluído com sucesso.');
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

  return (
    <div className="h-[calc(100vh-80px)] bg-slate-50/50 backdrop-blur-xl rounded-[3rem] border border-white/40 shadow-2xl overflow-hidden flex animate-in fade-in duration-700">
      
      {/* 📱 LISTA DE CONVERSAS (Sidebar Esquerda) */}
      <div className={cn(
        "w-full md:w-[400px] border-r border-slate-200 flex flex-col bg-white/40",
        (activeDealId || activeChatPhone) && "hidden md:flex"
      )}>
        <div className="p-8 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black tracking-tighter text-slate-800">Mensagens</h2>
            <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-all">
              <Filter className="w-5 h-5" />
            </button>
          </div>
          
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input 
              type="text"
              placeholder="Buscar chats ou mensagens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white/60 border border-white/20 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-2 custom-scrollbar">
          {loadingInbox ? (
            <div className="py-20 flex justify-center"><LoadingSpinner /></div>
          ) : filteredInbox?.length === 0 ? (
            <div className="py-20 text-center text-slate-400 italic text-sm">Nenhuma conversa encontrada</div>
          ) : filteredInbox?.map((chat, idx) => {
            // [Elite Fix] Unique Key
            const chatKey = chat.id;
            const isActive = activeChatId === chat.id;
            
            return (
              <button 
                key={chatKey}
                onClick={() => {
                  setActiveChat(chat);
                  setMessages([]); // Limpeza visual imediata
                }}
                className={cn(
                  "w-full p-5 rounded-3xl flex gap-4 transition-all duration-300 items-start text-left group border border-transparent",
                  isActive 
                    ? "bg-white shadow-xl shadow-slate-200/50 border-slate-100" 
                    : "hover:bg-white/60"
                )}
              >
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold overflow-hidden shadow-sm">
                     {chat.is_group ? <Users className="w-6 h-6" /> : (chat.contact_name?.[0]?.toUpperCase() || <User />)}
                  </div>
                  <div className={cn(
                    "absolute bottom-0 right-0 w-4 h-4 border-2 border-white rounded-full shadow-sm",
                    chat.is_group ? "bg-primary" : "bg-emerald-500"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-slate-800 truncate">{chat.contact_name}</h4>
                    <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">
                      {chat.last_message_at ? formatRelative(new Date(chat.last_message_at), new Date(), { locale: ptBR }) : ''}
                    </span>
                  </div>
                  <p className={cn(
                    "text-xs truncate transition-colors",
                    chat.sender_type === 'user' ? "text-slate-400" : "text-slate-600 font-medium"
                  )}>
                    {chat.sender_type === 'user' && 'Você: '}
                    {chat.last_message}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                      <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {chat.deal_title}
                      </span>
                      {chat.is_group && (
                         <span className="text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                           Grupo
                         </span>
                      )}
                      {!chat.is_qualified ? (
                        <span className={cn(
                          "text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                          chat.contact_is_auto ? "bg-amber-100 text-amber-600 animate-pulse" : "bg-slate-200 text-slate-600"
                        )}>
                          {chat.contact_is_auto ? 'Novo Lead' : 'Não Qualificado'}
                        </span>
                      ) : (
                        <span className="text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 text-primary">
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

      {/* 💬 JANELA DE CHAT (Direita) */}
          <div className={cn(
        "flex-1 flex flex-col bg-white/20 relative",
        !activeChat && "hidden md:flex items-center justify-center"
      )}>
        {activeChat ? (
          <>
            {/* Header do Chat */}
            <div className="p-6 border-b border-slate-200 bg-white/60 backdrop-blur-md flex justify-between items-center z-10 box-decoration-clone">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveDealId(null)} className="md:hidden p-2 text-slate-400"><ArrowLeft /></button>
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 shadow-sm overflow-hidden">
                   {activeChat.contact_name?.[0]}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 tracking-tight">{activeChat.contact_name}</h3>
                  <div className="flex items-center gap-2">
                     <div className={cn("w-2 h-2 rounded-full animate-pulse", activeChat.is_group ? "bg-primary" : "bg-emerald-500")} />
                     <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-2">
                        {activeChat.is_group ? 'Grupo WhatsApp' : 'WhatsApp Online'}
                        {!activeChat.is_qualified ? (
                          <span className={cn("ml-2 font-black", activeChat.contact_is_auto ? "text-amber-500" : "text-slate-400")}>
                            • {activeChat.contact_is_auto ? 'Novo Lead' : 'Lead Não Qualificado'}
                          </span>
                        ) : (
                          <span className="ml-2 text-primary font-black">• {activeChat.stage_label}</span>
                        )}
                     </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                {/* ⚡ STATUS BADGE (ELITE FEEDBACK) */}
                {isGlobalAnalyzing && (
                  <div className="mr-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full flex items-center gap-2 animate-pulse">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <span className="text-[9px] font-black uppercase text-primary tracking-widest">Oracle Thinking</span>
                  </div>
                )}

                {/* ⚡ BOTÃO GLOBAL ORACLE BOLT */}
                <button 
                  onClick={handleGlobalAnalyze}
                  disabled={isGlobalAnalyzing}
                  title="Análise Global 360° (Oracle)"
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

                {isAutoCreated && (
                  <button 
                    onClick={() => setIsQualifying(true)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] hover:scale-105 transition-all shadow-lg shadow-primary/20"
                  >
                    <Rocket className="w-3.5 h-3.5" />
                    Adicionar ao Funil
                  </button>
                )}
                <div className="h-8 w-px bg-slate-200 mx-2" />
                <button className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 transition-colors"><Phone className="w-5 h-5" /></button>
                
                {/* 🔴 MENU DE OPÇÕES (DELETE) */}
                <div className="relative">
                  <button 
                    onClick={() => setShowChatMenu(!showChatMenu)}
                    className={cn(
                      "p-3 rounded-2xl transition-all duration-300",
                      showChatMenu ? "bg-slate-100 text-slate-800" : "text-slate-400 hover:bg-slate-100"
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
              className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar scroll-smooth bg-slate-50/10"
            >
              <div className="flex flex-col items-center py-8">
                 <span className="px-4 py-1.5 rounded-full bg-white text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] shadow-sm mb-4 border border-slate-100">
                   Início da Conversa — {activeChat.deal_title}
                 </span>
              </div>

              {/* 🧠 ORACLE GLOBAL INSIGHT 360° (Safety Lockdown v8.2) */}
              {isGlobalAnalyzing ? (
                <div 
                  className="mb-10 p-1 bg-gradient-to-br from-primary/20 via-slate-100 to-transparent rounded-[3rem] animate-pulse"
                >
                  <div className="bg-white/90 backdrop-blur-2xl rounded-[2.9rem] p-10 shadow-xl border border-white flex flex-col items-center gap-6">
                     <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center">
                        <LoadingSpinner size="md" />
                     </div>
                     <div className="text-center">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.4em] text-primary mb-2">Oráculo Processando...</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sincronizando Histórico 360° • Aguarde</p>
                     </div>
                  </div>
                </div>
              ) : activeChat?.ai_global_analysis?.diagnostic ? (
                <div 
                  className="mb-10 p-1 bg-gradient-to-br from-primary/30 via-primary/5 to-transparent rounded-[3rem]"
                >
                  <div className="bg-white/90 backdrop-blur-2xl rounded-[2.9rem] p-10 shadow-2xl relative overflow-hidden group/global border border-white">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
                    
                    <div className="flex justify-between items-start mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-primary text-white flex items-center justify-center shadow-2xl shadow-primary/20 animate-pulse">
                          <span className="material-symbols-outlined text-2xl">auto_awesome</span>
                        </div>
                        <div>
                          <h4 className="text-[12px] font-black uppercase tracking-[0.4em] text-primary">Diagnóstico Global Oracle</h4>
                          <p className="text-[10px] font-bold text-slate-400 mt-1">Visão Estratégica 360° • Baseado no Histórico Completo</p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end">
                         <div className="px-4 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                           Probabilidade: {activeChat.ai_global_analysis.closing_probability}%
                         </div>
                         <p className="text-[8px] font-bold text-slate-300 mt-2 uppercase">Atualizado agora</p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 relative z-10">
                      <div className="space-y-4">
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Análise do Comportamento</span>
                         <div className="p-5 bg-slate-50/50 rounded-3xl border border-slate-100 leading-relaxed text-sm font-bold text-slate-700 italic">
                           "{activeChat.ai_global_analysis.diagnostic}"
                         </div>
                      </div>

                      <div className="space-y-4">
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Próxima Grande Jogada</span>
                         <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10">
                           <p className="text-sm font-manrope font-black text-primary mb-5">
                             {activeChat.ai_global_analysis.recommended_action?.suggested_message}
                           </p>
                           <button 
                              onClick={() => handleApplySuggestion(activeChat.ai_global_analysis.recommended_action?.suggested_message)}
                              className="w-full py-3.5 bg-primary text-white rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] shadow-xl shadow-primary/20 transition-all"
                           >
                             <span className="material-symbols-outlined text-sm">content_copy</span>
                             Usar Estratégia Recomendada
                           </button>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {messages.map((msg) => {
                const isMe = msg.sender_type === 'sales';
                const hasAI = msg.metadata?.ai_analysis;

                return (
                  <div key={msg.id} className="w-full">
                    <div 
                      className={cn(
                        "flex flex-col max-w-[80%] animate-in slide-in-from-bottom-2 duration-300 relative group",
                        isMe ? "ml-auto items-end" : "items-start"
                      )}
                    >
                      {/* Botão Oracle (Bolt) Elite - Refined Position */}
                      {!isMe && (
                        <button 
                          onClick={() => handleAnalyzeConversation(msg.id)}
                          className={cn(
                            "absolute -right-10 top-1 w-8 h-8 bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-white/40 text-primary flex items-center justify-center transition-all hover:scale-110 hover:bg-white hover:shadow-md active:scale-90 z-20",
                            analyzingIds.has(msg.id) ? "opacity-100" : "opacity-30 group-hover:opacity-100"
                          )}
                          title="Análise estratégica do Oracle"
                        >
                          <span className={cn("material-symbols-outlined text-[16px]", analyzingIds.has(msg.id) && "animate-spin")}>bolt</span>
                        </button>
                      )}

                      <div className={cn(
                        "px-6 py-4 rounded-[2rem] text-sm shadow-md transition-all border",
                        isMe 
                          ? "bg-primary text-white border-primary/20 rounded-tr-sm" 
                          : "bg-white text-slate-700 border-slate-100 rounded-tl-sm hover:shadow-lg",
                        msg.is_optimistic && "opacity-70 animate-pulse"
                      )}>
                        
                        {/* 🖼️ RENDERIZADOR MULTIMÍDIA ELITE (v8.0) */}
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
                               <p className={cn("text-[8px] font-black uppercase tracking-widest mb-1", isMe ? "text-white/60" : "text-slate-400")}>Mensagem de Voz</p>
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
                               <p className={cn("text-[9px] font-black uppercase tracking-widest", isMe ? "text-white/60" : "text-slate-400")}>Documento</p>
                               <p className={cn("text-xs font-bold truncate", isMe ? "text-white" : "text-slate-700")}>Ver arquivo anexo</p>
                            </div>
                            <Download className="w-4 h-4 opacity-40 shrink-0" />
                          </a>
                        )}

                        <div className={cn(
                          "leading-relaxed",
                          msg.message_type !== 'text' && "mt-3 pt-3 border-t font-medium text-[13px]",
                          msg.message_type !== 'text' && (isMe ? "border-white/10 text-white/90 italic" : "border-slate-100 text-slate-500 italic")
                        )}>
                          {msg.content}
                        </div>
                      </div>

                      <span className="text-[9px] text-slate-400 mt-2 font-black uppercase tracking-widest px-4 opacity-60">
                        {isMe ? 'Você' : 'Cliente'} • {msg.created_at ? formatRelative(new Date(msg.created_at), new Date(), { locale: ptBR }) : 'Agora'}
                      </span>
                    </div>

                    {/* 🧠 ORACLE INSIGHT CARD (Implementation v7.5) */}
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
                                  <p className="text-[10px] font-bold text-slate-400">Decision Intelligence • {msg.metadata.ai_analysis.strategy_category}</p>
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
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">Ação Sugerida pelo Oracle</span>
                                <div className="bg-primary/5 p-6 rounded-[2rem] border border-primary/10 group/msg relative transition-all hover:bg-primary/10">
                                  <p className="text-sm font-manrope font-bold text-slate-800 leading-tight mb-4">
                                    {msg.metadata.ai_analysis.recommended_action?.suggested_message}
                                  </p>
                                  <button 
                                    onClick={() => handleApplySuggestion(msg.metadata.ai_analysis.recommended_action?.suggested_message)}
                                    className="w-full py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                                  >
                                    <span className="material-symbols-outlined text-base">auto_fix_high</span>
                                    Aplicar Sugestão no Chat
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
            </div>

            {/* Input de Mensagem */}
            <div className="p-8 bg-white/40 border-t border-slate-200 backdrop-blur-sm">
              <div className={cn(
                "relative flex items-center gap-4 bg-white p-2 rounded-[2.5rem] shadow-2xl border border-slate-100 transition-all",
                isRecording ? " ring-4 ring-red-500/10 border-red-100" : "focus-within:ring-4 ring-primary/5"
              )}>
                <input 
                  type="file" 
                  hidden 
                  ref={fileInputRef} 
                  onChange={handleFileUpload}
                  accept="image/*,audio/*,video/*,application/pdf"
                />
                
                {!isRecording ? (
                  <>
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading || isRecording}
                      className={cn(
                        "p-3 rounded-full transition-all text-slate-400 hover:bg-slate-50 hover:text-primary disabled:opacity-30"
                      )}
                    >
                      <Paperclip className="w-6 h-6" />
                    </button>

                    <input 
                      type="text" 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder="Escreva sua resposta..."
                      className="flex-1 bg-transparent py-4 text-sm focus:outline-none text-slate-800 font-medium"
                    />

                    {/* Botão de Gravar Áudio */}
                    <button 
                      type="button"
                      onClick={handleStartRecording}
                      className="p-3 text-slate-400 hover:bg-slate-50 hover:text-red-500 transition-all"
                    >
                      <Mic className="w-6 h-6" />
                    </button>

                    <button 
                      type="button"
                      onClick={handleSendMessage}
                      disabled={isSending || isUploading || !newMessage.trim()}
                      className="px-8 py-4 bg-primary text-white rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-primary-container transition-all shadow-xl shadow-primary/20 active:scale-95 disabled:opacity-50"
                    >
                      {isSending ? <LoadingSpinner size="sm" /> : <><Send className="w-4 h-4" /> Enviar</>}
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
                        title="Cancelar Gravação"
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

      {/* 🚀 MODAL DE QUALIFICAÇÃO (DealForm Reutilizado) */}
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
              Finalizar Qualificação
            </button>
          </div>
        }
      >
        <div className="p-2">
            <p className="text-sm text-slate-500 mb-8 font-medium">
              Transforme este contato de WhatsApp em um negócio oficial do seu funil. Preencha os detalhes da oportunidade abaixo.
            </p>
            <DealForm 
              initialData={{
                id: activeChat?.deal_id,
                title: activeChat?.contact_name,
                company: activeChat?.contact_name,
                contacts: [{ name: activeChat?.contact_name, phone: activeChat?.contact_phone || '', role: 'Lead WhatsApp' }],
                leadSource: 'Whatsapp',
                stage: activeChat?.stage
              }}
              onSuccess={() => {
                setIsQualifying(false);
                refetchInbox();
              }}
              onCancel={() => setIsQualifying(false)}
            />
        </div>
      </Modal>
    </div>
  );
}
