import React, { useMemo, useRef, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Check,
  CircleHelp,
  Clock3,
  Copy,
  FileText,
  Link2,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Paperclip,
  Phone,
  Play,
  Plus,
  SendHorizontal,
  Smile,
  Trash2,
  Upload,
  X,
  User,
  Building2,
  Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';
import EmojiPicker from 'emoji-picker-react';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const MESSAGE_TYPES = new Set([
  'send_message',
  'send_link',
  'send_video',
  'send_image',
  'send_audio',
  'send_document',
  'send_options',
  'send_copy_code'
]);

const MAGIC_VARIABLES = [
  { id: 'contato.nome', label: 'Nome do Contato', icon: User },
  { id: 'contato.telefone', label: 'Telefone do Contato', icon: Phone },
  { id: 'empresa.nome', label: 'Nome da Empresa', icon: Building2 },
  { id: 'empresa.cnpj', label: 'CNPJ da Empresa', icon: FileText },
  { id: 'vendedor.nome', label: 'Nome do Responsável', icon: Briefcase }
];

const MEDIA_META = {
  send_video: { prefix: 'video', label: 'videos', accept: 'video/*', icon: Play },
  send_image: { prefix: 'image', label: 'imagens', accept: 'image/*', icon: Upload },
  send_audio: { prefix: 'audio', label: 'audios', accept: 'audio/*', icon: Mic },
  send_document: {
    prefix: 'document',
    label: 'documentos',
    accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx',
    icon: FileText
  }
};

function NodeHandle({ id, type = 'source', position = Position.Right, tone = 'cyan', className = '' }) {
  const toneClass = {
    cyan: '!border-cyan-300 !bg-white',
    blue: '!border-blue-400 !bg-white',
    rose: '!border-rose-300 !bg-white',
    amber: '!border-amber-300 !bg-white',
    emerald: '!border-emerald-300 !bg-white'
  }[tone] || '!border-cyan-300 !bg-white';

  return (
    <Handle
      id={id}
      type={type}
      position={position}
      className={cn('!h-4 !w-4 !border-2', toneClass, className)}
    />
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex-1 rounded-md bg-white/12 px-2 py-2 text-center ring-1 ring-white/10">
      <div className="text-2xl font-black leading-none text-white">{value}</div>
      <div className="mt-1 text-[10px] font-bold text-white/85">{label}</div>
    </div>
  );
}

function FooterStatus({ value, onChange, accent = 'cyan', label = 'Status digitando' }) {
  const accentClass = accent === 'violet' ? 'border-violet-300 text-violet-500' : 'border-cyan-300 text-cyan-500';

  return (
    <div className="flex items-center justify-between px-5 py-2.5">
      <div className="flex items-center gap-2">
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2', accentClass)}>
          <MoreHorizontal className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[10px] font-semibold text-slate-500 leading-tight">{label}</div>
          <div className="flex items-center gap-1">
            <input
              value={value ?? '0'}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onChange(event.target.value)}
              className="nodrag nopan h-5 w-7 rounded-full border border-slate-200 bg-slate-50 text-center text-[10px] font-bold text-slate-700 outline-none"
            />
            <span className="text-[10px] font-semibold text-slate-400">seg</span>
          </div>
        </div>
      </div>
      <div className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-tight">Proximo</div>
    </div>
  );
}

function formatWhatsAppText(text) {
  if (!text) return '';
  return text
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/~(.*?)~/g, '<del>$1</del>')
    .split('\n').join('<br />');
}

function ActivatedText({ children }) {
  const formatted = useMemo(() => formatWhatsAppText(children), [children]);
  
  return (
    <div className="w-full">
      <div className="relative w-full rounded-2xl rounded-tl-none bg-[#e2ffc7] px-3.5 py-2.5 text-[13px] leading-[1.45] text-slate-800 shadow-sm border border-[#d1f4ad]">
        <div className="flex flex-col gap-1">
          <div 
            className="min-w-0 break-words"
            dangerouslySetInnerHTML={{ __html: formatted }}
          />
          <div className="flex justify-end -mb-1 -mr-1">
            <Check className="h-3.5 w-3.5 text-sky-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FlowNodeCard({ id, data, selected }) {
  const {
    node,
    meta,
    onSelect,
    onUpdateNodeConfig,
    onDuplicate,
    onRemove,
    onQuickAdd,
    onAddBranch
  } = data;

  const config = node.config || {};
  const Icon = meta.icon;
  const fileInputRef = useRef(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestTab, setRequestTab] = useState('headers');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showVarsMenu, setShowVarsMenu] = useState(false);
  const [isTriggerEditing, setIsTriggerEditing] = useState(false);
  const [localTriggerType, setLocalTriggerType] = useState(config.trigger_type || 'any_interaction');
  const [localKeyword, setLocalKeyword] = useState(config.keyword || '');
  const [localWorkingHours, setLocalWorkingHours] = useState(Boolean(config.use_working_hours));
  const emojiPickerRef = useRef(null);
  const attachMenuRef = useRef(null);
  const varsMenuRef = useRef(null);
  const messageInputRef = useRef(null);

  useEffect(() => {
    const el = messageInputRef.current;
    if (el) {
      // Se não estiver focado (ex: carregamento inicial ou clique em emoji),
      // sincronizamos o valor com o estado global.
      if (document.activeElement !== el) {
        el.value = config.message || '';
      }
      // Sempre ajustamos a altura
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }, [config.message, config.text_activated]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target)) {
        setShowAttachMenu(false);
      }
      if (varsMenuRef.current && !varsMenuRef.current.contains(event.target)) {
        setShowVarsMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isStart = node.type === 'trigger_start';
  const isValidationCondition = (
    node.type === 'condition_validation'
    || node.type === 'action_validation'
    || meta?.type === 'condition_validation'
    || meta?.title === 'Validar Formato'
  );
  const isCondition = node.type.startsWith('condition_') || isValidationCondition;
  const isOptions = node.type === 'send_options';
  const isActionButtons = node.type === 'send_action_buttons';
  const isCopyCode = node.type === 'send_copy_code';
  const isDelay = node.type === 'action_delay';
  const isExternalCall = node.type === 'integration_external_call';
  const isLink = node.type === 'send_link';
  const mediaMeta = MEDIA_META[node.type];
  const isMedia = Boolean(mediaMeta);
  const isMessageLike = MESSAGE_TYPES.has(node.type) || isActionButtons;
  const textActivated = Boolean(config.text_activated);
  const hasMessageText = Boolean(String(config.message || '').trim());
  const hasActionText = Boolean(String(config.title || config.description || config.footer || '').trim());
  
  const isButtonBlock = isOptions || isActionButtons;
  const isAllowedToAttach = isButtonBlock || isMedia;
  const actions = useMemo(() => {
    if (!Array.isArray(config.actions) || !config.actions.length) {
      return [{ type: 'link', title: '', value: '' }];
    }
    return config.actions;
  }, [config.actions]);
  const options = useMemo(() => String(config.options ?? '').split('\n'), [config.options]);
  const optionFormat = config.format || 'botoes';

  const updateConfig = (partial) => onUpdateNodeConfig(id, partial);
  const activateMessage = () => {
    if (!hasMessageText) return;
    updateConfig({ text_activated: true });
  };
  const activateActionsText = () => {
    if (!hasActionText) return;
    updateConfig({ text_activated: true });
  };

  const updateOption = (index, value) => {
    const next = [...options];
    next[index] = value;
    updateConfig({ options: next.join('\n') });
  };
  const addOption = () => {
    const limit = optionFormat === 'botoes' ? 3 : 10;
    if (options.length >= limit) return;
    updateConfig({ options: [...options, ''].join('\n') });
  };
  const removeOption = (index) => {
    const next = options.filter((_, itemIndex) => itemIndex !== index);
    updateConfig({ options: (next.length ? next : ['']).join('\n') });
  };
  const updateAction = (index, partial) => {
    const next = actions.map((action, itemIndex) => (
      itemIndex === index ? { ...action, ...partial } : action
    ));
    updateConfig({ actions: next });
  };
  const addAction = () => updateConfig({ actions: [...actions, { type: 'link', title: '', value: '' }] });
  const removeAction = (index) => {
    const next = actions.filter((_, itemIndex) => itemIndex !== index);
    updateConfig({ actions: next.length ? next : [{ type: 'link', title: '', value: '' }] });
  };

  const chooseFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Detectamos o tipo pelo arquivo
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/');
    
    let targetType = node.type;
    if (!MEDIA_META[node.type]) {
      targetType = isVideo ? 'send_video' : isAudio ? 'send_audio' : isImage ? 'send_image' : 'send_document';
    }
    
    const targetMeta = MEDIA_META[targetType];
    const prefix = targetMeta.prefix;

    // 1. Mostrar estado de carregando
    updateConfig({
      [`${prefix}_uploading`]: true,
      [`${prefix}_ready`]: false,
      [`${prefix}_name`]: file.name,
      // Se for um bloco de botoes, mantemos o tipo. Se for outro, mudamos para o tipo da midia.
      type: isButtonBlock ? node.type : targetType
    });

    try {
      // 2. Upload para o Supabase (usando bucket existente deal-attachments)
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `flows/flow-${id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('deal-attachments')
        .upload(filePath, file);

      if (uploadError) {
        console.error('[FlowBuilder] Erro no upload:', uploadError.message);
        throw uploadError;
      }

      // 3. Pegar URL Publica
      const { data: { publicUrl } } = supabase.storage
        .from('deal-attachments')
        .getPublicUrl(filePath);

      // 4. Finalizar config do no
      onUpdateNodeConfig(id, {
        ...config,
        type: targetType,
        [`${prefix}_url`]: publicUrl,
        [`${prefix}_name`]: file.name,
        [`${prefix}_file_size`]: file.size,
        [`${prefix}_ready`]: true,
        [`${prefix}_uploading`]: false,
        [`${prefix}_source`]: 'url',
        text_activated: false
      });
    } catch (err) {
      console.error('[FlowBuilder] Erro no upload:', err);
      updateConfig({
        [`${prefix}_uploading`]: false,
        [`${prefix}_error`]: 'Falha no upload'
      });
    }
  };


  const renderMessageInput = ({ placeholder = 'Digite sua mensagem', withAttach = false } = {}) => (
    <div className="border-t border-b border-slate-200/80 bg-white/90 px-2 py-2">
      {!textActivated ? (
          <div className="flex items-end gap-1.5 flex-nowrap relative">
            <div className="flex items-end gap-0.5 shrink-0 relative pb-0.5">
              <div ref={attachMenuRef} className="relative">
                {isAllowedToAttach && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowAttachMenu(!showAttachMenu);
                      setShowEmojiPicker(false);
                    }}
                    className={cn(
                      "nodrag nopan flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                      showAttachMenu ? "bg-slate-200 text-slate-700" : "text-slate-400 hover:bg-slate-100"
                    )}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </button>
                )}
                
                {showAttachMenu && (
                  <div className="absolute bottom-full left-0 mb-2 z-[100] flex flex-col gap-2 p-2 bg-white rounded-xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setShowAttachMenu(false);
                        // Abrimos o seletor. A logica de mudar o tipo esta no chooseFile
                        fileInputRef.current.accept = 'video/*';
                        fileInputRef.current.click();
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-600 hover:bg-violet-50 hover:text-violet-600 shadow-sm transition-all"
                      title="Anexar Vídeo"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setShowAttachMenu(false);
                        fileInputRef.current.accept = 'image/*';
                        fileInputRef.current.click();
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-600 hover:bg-violet-50 hover:text-violet-600 shadow-sm transition-all"
                      title="Anexar Imagem"
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div ref={emojiPickerRef} className="relative">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowEmojiPicker(!showEmojiPicker);
                    setShowAttachMenu(false);
                  }}
                  className={cn(
                    "nodrag nopan flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                    showEmojiPicker ? "bg-slate-200 text-slate-700" : "text-slate-400 hover:bg-slate-100"
                  )}
                >
                  <Smile className="h-3.5 w-3.5" />
                </button>

                {showEmojiPicker && (
                  <div className="absolute bottom-full left-0 mb-2 z-[100] shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <EmojiPicker
                      onEmojiClick={(emojiData) => {
                        const currentMsg = config.message || '';
                        updateConfig({ message: currentMsg + emojiData.emoji });
                        setShowEmojiPicker(false);
                      }}
                      width={280}
                      height={350}
                      theme="light"
                      searchDisabled
                      skinTonesDisabled
                      previewConfig={{ showPreview: false }}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="relative flex-1 min-w-0" ref={varsMenuRef}>
              {showVarsMenu && (
                <div className="absolute bottom-full left-0 mb-2 z-[100] w-64 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="bg-slate-50 px-3 py-2 border-b border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Variáveis Dinâmicas</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1">
                    {MAGIC_VARIABLES.map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const el = messageInputRef.current;
                          const val = el.value;
                          const cursor = el.selectionStart;
                          const lastAtSymbolIndex = val.lastIndexOf('@', cursor - 1);
                          
                          let newVal;
                          let newCursor;
                          if (lastAtSymbolIndex !== -1) {
                            newVal = val.slice(0, lastAtSymbolIndex) + `{${v.id}}` + val.slice(cursor);
                            newCursor = lastAtSymbolIndex + v.id.length + 2;
                          } else {
                            newVal = val.slice(0, cursor) + `{${v.id}}` + val.slice(cursor);
                            newCursor = cursor + v.id.length + 2;
                          }
                          
                          updateConfig({ message: newVal, text_activated: false });
                          el.value = newVal;
                          setShowVarsMenu(false);
                          
                          setTimeout(() => {
                            el.focus();
                            el.setSelectionRange(newCursor, newCursor);
                            el.style.height = 'auto';
                            el.style.height = el.scrollHeight + 'px';
                          }, 10);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-violet-50 text-left transition-colors group/var"
                      >
                        <v.icon className="h-3.5 w-3.5 text-slate-400 group-hover/var:text-violet-500" />
                        <span className="text-xs font-semibold text-slate-600 group-hover/var:text-violet-700">{v.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <textarea
                ref={messageInputRef}
                defaultValue={config.message || ''}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => {
                  event.target.style.height = 'auto';
                  event.target.style.height = event.target.scrollHeight + 'px';
                  const val = event.target.value;
                  const cursor = event.target.selectionStart;
                  updateConfig({ message: val, text_activated: false });
                  
                  if (val[cursor - 1] === '@') {
                    setShowVarsMenu(true);
                  } else if (showVarsMenu && val[cursor - 1] === ' ') {
                    setShowVarsMenu(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    activateMessage();
                  }
                }}
                placeholder={placeholder}
                rows={1}
                className="nodrag nopan block min-h-[32px] w-full resize-none overflow-hidden rounded-lg border border-slate-100 bg-slate-50/50 px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 outline-none focus:border-slate-300 focus:bg-white transition-colors"
              />
            </div>
            <div className="pb-0.5">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  activateMessage();
                }}
                className={cn(
                  'nodrag nopan flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-all',
                  hasMessageText ? 'border-cyan-200 bg-cyan-50 text-cyan-600' : 'border-slate-100 bg-slate-50 text-slate-300'
                )}
                title="Ativar mensagem"
              >
                <SendHorizontal className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
      ) : (
        <div className="space-y-2.5">
          <ActivatedText>{config.message || 'Mensagem vazia'}</ActivatedText>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 shrink-0">
              <div className="relative">
                {isAllowedToAttach && (
                  <button 
                    type="button" 
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowAttachMenu(!showAttachMenu);
                      setShowEmojiPicker(false);
                    }} 
                    className={cn(
                      "nodrag nopan flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                      showAttachMenu ? "bg-slate-200 text-slate-700" : "text-slate-400 hover:bg-slate-100"
                    )}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </button>
                )}
                {showAttachMenu && (
                  <div className="absolute bottom-full left-0 mb-2 z-[100] flex flex-col gap-2 p-2 bg-white rounded-xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-bottom-2">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setShowAttachMenu(false); updateConfig({ type: 'send_video' }); fileInputRef.current?.click(); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-600 hover:bg-violet-50 hover:text-violet-600 shadow-sm transition-all"><Play className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setShowAttachMenu(false); updateConfig({ type: 'send_image' }); fileInputRef.current?.click(); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-600 hover:bg-violet-50 hover:text-violet-600 shadow-sm transition-all"><Upload className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </div>
              <div className="relative">
                <button 
                  type="button" 
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowEmojiPicker(!showEmojiPicker);
                    setShowAttachMenu(false);
                  }} 
                  className={cn(
                    "nodrag nopan flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                    showEmojiPicker ? "bg-slate-200 text-slate-700" : "text-slate-400 hover:bg-slate-100"
                  )}
                >
                  <Smile className="h-3.5 w-3.5" />
                </button>
                {showEmojiPicker && (
                  <div className="absolute bottom-full left-0 mb-2 z-[100] shadow-2xl animate-in fade-in slide-in-from-bottom-2">
                    <EmojiPicker
                      onEmojiClick={(emojiData) => {
                        const currentMsg = config.message || '';
                        updateConfig({ message: currentMsg + emojiData.emoji, text_activated: false });
                        setShowEmojiPicker(false);
                      }}
                      width={280}
                      height={350}
                      theme="light"
                      searchDisabled
                      skinTonesDisabled
                      previewConfig={{ showPreview: false }}
                    />
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                updateConfig({ text_activated: false });
              }}
              className="nodrag nopan h-8 flex-1 rounded-lg border border-slate-200 bg-white text-[11px] font-black uppercase text-slate-500 hover:border-slate-300 hover:bg-slate-50 transition-all tracking-tight shadow-sm"
            >
              Editar
            </button>
            <button
              type="button"
              className="nodrag nopan flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-300 opacity-40"
              disabled
            >
              <SendHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderLink = () => (
    <>
      <div className="border-t border-b border-slate-200/80 bg-white/90 px-5 py-2.5">
        <input
          value={config.link_url || ''}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => updateConfig({ link_url: event.target.value, link_activated: false })}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && String(config.link_url || '').trim()) {
              updateConfig({ link_activated: true });
            }
          }}
          placeholder="https://..."
          className="nodrag nopan h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-300"
        />
        {config.link_activated && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-cyan-500" />
              <span className="truncate">{config.link_url}</span>
              <Check className="ml-auto h-4 w-4 text-emerald-500" />
            </div>
          </div>
        )}
      </div>
      {renderMessageInput({ placeholder: 'Digite @ p/ utilizar os campos' })}
      <FooterStatus value={config.typing_seconds} onChange={(value) => updateConfig({ typing_seconds: value })} />
    </>
  );

  const renderMediaPreview = () => {
    // Se estivermos em um bloco de midia (send_image, etc), o mediaMeta ja existe.
    // Se estivermos em um bloco de botoes, precisamos descobrir o prefixo com base no que esta anexado.
    let activeMeta = mediaMeta;
    if (!activeMeta) {
      if (config.video_ready || config.video_uploading) activeMeta = MEDIA_META.send_video;
      else if (config.image_ready || config.image_uploading) activeMeta = MEDIA_META.send_image;
      else if (config.audio_ready || config.audio_uploading) activeMeta = MEDIA_META.send_audio;
      else activeMeta = MEDIA_META.send_image; // Default
    }

    const prefix = activeMeta.prefix;
    const FileIcon = activeMeta.icon;
    const name = config[`${prefix}_name`] || '';
    const ready = Boolean(config[`${prefix}_ready`]);
    const url = config[`${prefix}_url` ] || config[`${prefix}_link`];
    const isUploading = Boolean(config[`${prefix}_uploading`]);

    // O preview SO aparece se houver algo sendo carregado ou ja pronto.
    // Nao mostramos o "box de carregar" vazio por padrao.
    if (!ready && !isUploading) return null;

    return (
      <div className="border-t border-b border-slate-200/80 bg-white px-4 py-4">
        {isUploading ? (
          <div className="rounded-2xl bg-slate-50 px-5 py-12 text-center border border-slate-100 animate-pulse">
            <div className="mx-auto h-8 w-8 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
            <div className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Enviando...</div>
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 relative group/media">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visualização</span>
              <button 
                type="button" 
                onClick={(event) => { 
                  event.stopPropagation(); 
                  updateConfig({ [`${prefix}_ready`]: false, [`${prefix}_url`]: '', [`${prefix}_name`]: '' }); 
                }} 
                className="nodrag nopan text-slate-300 hover:text-rose-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative overflow-hidden rounded-xl bg-white shadow-sm border border-slate-100 min-h-[120px] flex items-center justify-center">
              {prefix === 'image' && url ? (
                <img src={url} alt="Preview" className="max-h-[250px] w-full object-contain" />
              ) : prefix === 'video' ? (
                <div className="flex flex-col items-center gap-3 py-8 text-violet-500">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 shadow-inner">
                    <Play className="h-7 w-7 fill-current" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-tight opacity-60">Vídeo pronto</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-6 text-slate-400">
                  <FileIcon className="h-10 w-10" />
                  <span className="text-[10px] font-bold uppercase">{name || 'Arquivo pronto'}</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="nodrag nopan w-full rounded-xl bg-violet-600 py-2.5 text-xs font-black text-white shadow-md shadow-violet-500/20 hover:bg-violet-500 transition-all active:scale-95"
              >
                Editar Arquivo
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  updateConfig({ show_link_input: !config.show_link_input });
                }}
                className="nodrag nopan text-[10px] font-bold text-violet-400 underline uppercase tracking-wider text-center"
              >
                Editar por link
              </button>
            </div>
          </div>
        )}

        {config.show_link_input && (
          <div className="mt-3 relative">
            <input
              value={config[`${prefix}_link`] || ''}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => updateConfig({ [`${prefix}_link`]: event.target.value, [`${prefix}_ready`]: Boolean(event.target.value.trim()), [`${prefix}_source`]: 'url' })}
              placeholder="Cole o link do arquivo"
              className="nodrag nopan h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-violet-300 shadow-sm"
            />
          </div>
        )}
      </div>
    );
  };

  const renderOptions = () => (
    <>
      {/* Se houver midia anexada no bloco de opcoes, mostramos o preview no topo */}
      {(config.image_ready || config.video_ready || config.image_uploading || config.video_uploading) && (
        <div className="bg-white">
          {renderMediaPreview()}
        </div>
      )}
      {renderMessageInput({ withAttach: true })}
      <div className="border-b border-slate-200/80 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold italic text-slate-500">Formato:</span>
          <select
            value={optionFormat}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              const nextFormat = event.target.value;
              updateConfig({
                format: nextFormat,
                options: nextFormat === 'botoes' ? options.slice(0, 3).join('\n') : options.join('\n')
              });
            }}
            className="nodrag nopan rounded-md border border-transparent bg-white text-xs font-bold text-slate-700 outline-none hover:border-slate-200"
          >
            <option value="botoes">Botoes</option>
            <option value="lista">Lista</option>
            <option value="texto">Texto</option>
          </select>
          <CircleHelp className="h-3.5 w-3.5 text-slate-400" />
        </div>
      </div>
      <div className="border-b border-slate-200/80 px-5 py-2">
        <input
          value={config.list_title || ''}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => updateConfig({ list_title: event.target.value })}
          placeholder="Selecione as opcoes abaixo:"
          className="nodrag nopan h-8 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold outline-none focus:border-slate-400"
        />
      </div>
      <div className="space-y-1.5 border-b border-slate-200/80 px-5 py-3">
        <div className="flex items-center justify-between mb-0.5">
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Opcoes:</div>
          <button
            type="button"
            disabled={optionFormat === 'botoes' && options.length >= 3}
            onClick={(event) => { event.stopPropagation(); addOption(); }}
            className="nodrag nopan text-[10px] font-bold text-slate-400 underline hover:text-primary disabled:text-slate-200"
          >
            Novo botao
          </button>
        </div>
        {options.map((option, index) => {
          const optionId = `option_${index + 1}`; // Usando 1-indexed para compatibilidade com edges existentes
          return (
            <div key={`${id}-option-${index}`} className="group/option flex items-center gap-3 relative">
              <div className="relative flex-1">
                <input
                  value={option || ''}
                  maxLength={20}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => updateOption(index, event.target.value)}
                  className="nodrag nopan h-8 w-full rounded-lg border border-slate-100 bg-slate-50/50 pl-3 pr-10 text-[13px] font-semibold text-slate-700 outline-none focus:border-slate-300 focus:bg-white"
                />
                <div className="absolute right-7 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-300 tracking-tighter">
                  {(option || '').length}/20
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeOption(index);
                  }}
                  className="nodrag nopan absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-md text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
              <div className="min-w-[45px] text-[9px] font-black text-slate-400 uppercase tracking-tight">
                CTR <span className="text-slate-600">0,0%</span>
              </div>
              <NodeHandle id={optionId} className="!-right-7 !h-3.5 !w-3.5" />
            </div>
          );
        })}
      </div>
      <div className="relative border-b border-slate-200/80 px-5 py-2.5 text-[11px] font-semibold italic text-slate-400">
        Se nao responder em
        <input
          value={config.timeout_seconds ?? '0'}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => updateConfig({ timeout_seconds: event.target.value })}
          className="nodrag nopan mx-2 h-6 w-9 rounded-md border border-slate-300 bg-slate-400 text-center text-[11px] font-black text-white outline-none"
        />
        Segundos
        <NodeHandle id="timeout" tone="rose" className="!-right-2" />
      </div>
      <div className="relative px-5 py-3 text-[11px] font-semibold italic text-slate-400">
        Caso a resposta seja invalida
        <NodeHandle id="invalid" tone="amber" className="!-right-2" />
      </div>
    </>
  );

  const renderDelay = () => (
    <div className="border-t border-b border-slate-200/80 bg-white/90 px-5 py-5">
      <div className="mb-4 text-center text-[11px] font-black uppercase tracking-widest text-slate-400">
        Tempo de espera
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={config.duration || '1'}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => updateConfig({ duration: event.target.value })}
          className="nodrag nopan h-11 w-20 rounded-xl border border-slate-200 bg-white text-center text-lg font-black text-slate-800 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50"
        />
        <select
          value={config.unit || 'minutes'}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => updateConfig({ unit: event.target.value })}
          className="nodrag nopan h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-amber-400"
        >
          <option value="minutes">Minuto(s)</option>
          <option value="hours">Hora(s)</option>
          <option value="days">Dia(s)</option>
        </select>
      </div>
      <p className="mt-4 rounded-xl bg-amber-50 p-3 text-center text-[11px] font-semibold text-amber-700">
        A automacao ficara pausada por este periodo antes de prosseguir.
      </p>
    </div>
  );

  const renderCopyCode = () => (
    <>
      {renderMessageInput({ placeholder: 'Digite @ p/ utilizar os campos' })}
      <div className="border-b border-slate-200/80 px-5 py-4">
        <div className="grid grid-cols-[70px,minmax(0,1fr)] items-center gap-2">
          <input value={config.code_label || 'Codigo:'} onClick={(event) => event.stopPropagation()} onChange={(event) => updateConfig({ code_label: event.target.value })} className="nodrag nopan h-10 rounded-md border border-transparent bg-white px-1 text-sm font-semibold outline-none hover:border-slate-200" />
          <input value={config.code || ''} onClick={(event) => event.stopPropagation()} onChange={(event) => updateConfig({ code: event.target.value })} placeholder="Chave pix, cupom, codigo..." className="nodrag nopan h-10 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-cyan-300" />
        </div>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold text-slate-500">{config.message || 'Copie o codigo abaixo.'}</div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white">
            <span className="truncate text-sm font-bold">{config.code || '123456'}</span>
            <span className="inline-flex items-center gap-2 text-xs font-black text-emerald-300"><Copy className="h-4 w-4" />{config.button_label || 'Copiar codigo'}</span>
          </div>
        </div>
      </div>
      <FooterStatus value={config.typing_seconds} onChange={(value) => updateConfig({ typing_seconds: value })} />
    </>
  );

  const renderActionButtons = () => (
    <>
      {/* Preview de midia para Botoes de Acao */}
      {(config.image_ready || config.video_ready || config.image_uploading || config.video_uploading) && (
        <div className="bg-white">
          {renderMediaPreview()}
        </div>
      )}
      <div className="border-t border-b border-slate-200/80 bg-white/90 px-5 py-4">
        <div className="mb-4 text-center text-[12px] font-semibold italic tracking-wide text-slate-300">
          Digite sua mensagem abaixo
        </div>
        {!textActivated ? (
          <div className="grid grid-cols-[28px,minmax(0,1fr),40px] items-center gap-2">
            <button type="button" onClick={(event) => event.stopPropagation()} className="nodrag nopan flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
              <MessageCircle className="h-4 w-4" />
            </button>
            <div className="space-y-2">
              <input value={config.title || ''} onClick={(event) => event.stopPropagation()} onChange={(event) => updateConfig({ title: event.target.value, text_activated: false })} placeholder="Digite o titulo (Opcional)" className="nodrag nopan h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-cyan-300" />
              <input value={config.description || ''} onClick={(event) => event.stopPropagation()} onChange={(event) => updateConfig({ description: event.target.value, text_activated: false })} placeholder="Digite @ p/ utilizar os campos" className="nodrag nopan h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-cyan-300" />
              <input value={config.footer || ''} onClick={(event) => event.stopPropagation()} onChange={(event) => updateConfig({ footer: event.target.value, text_activated: false })} placeholder="Digite o rodape (Opcional)" className="nodrag nopan h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-cyan-300" />
            </div>
            <button type="button" onClick={(event) => { event.stopPropagation(); activateActionsText(); }} className={cn('nodrag nopan flex h-10 w-10 items-center justify-center rounded-full border', hasActionText ? 'border-cyan-300 bg-cyan-100 text-cyan-600' : 'border-slate-200 bg-slate-100 text-slate-300')}>
              <SendHorizontal className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <ActivatedText>
              {config.title && <span className="block font-black">{config.title}</span>}
              <span className="block">{config.description || 'Mensagem vazia'}</span>
              {config.footer && <span className="block text-xs text-slate-500">{config.footer}</span>}
            </ActivatedText>
            {renderActivationRow({ actionMode: true })}
          </div>
        )}
      </div>
      <div className="space-y-3 border-b border-slate-200/80 px-5 py-4">
        {actions.map((action, index) => (
          <div key={`${id}-action-${index}`} className="relative rounded-xl border border-slate-200 bg-white p-3">
            <button type="button" onClick={(event) => { event.stopPropagation(); removeAction(index); }} className="nodrag nopan absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500">
              <X className="h-3 w-3" />
            </button>
            <div className="grid grid-cols-2 gap-2">
              <select value={action.type || 'link'} onClick={(event) => event.stopPropagation()} onChange={(event) => updateAction(index, { type: event.target.value, value: '' })} className="nodrag nopan h-9 rounded-md border border-slate-200 px-2 text-xs font-semibold outline-none">
                <option value="link">Link</option>
                <option value="phone">Ligacao</option>
              </select>
              <input value={action.title || ''} onClick={(event) => event.stopPropagation()} onChange={(event) => updateAction(index, { title: event.target.value })} placeholder={action.type === 'phone' ? 'Telefone' : 'Site'} className="nodrag nopan h-9 rounded-md border border-slate-200 px-2 text-xs font-semibold outline-none" />
            </div>
            <input value={action.value || ''} onClick={(event) => event.stopPropagation()} onChange={(event) => updateAction(index, { value: event.target.value })} placeholder={action.type === 'phone' ? '81981428495' : 'https://www.dominio.com.br'} className="nodrag nopan mt-2 h-9 w-full rounded-md border border-slate-200 px-2 text-xs font-semibold outline-none" />
          </div>
        ))}
        <button type="button" onClick={(event) => { event.stopPropagation(); addAction(); }} className="nodrag nopan ml-auto block text-xs font-semibold text-slate-400 underline hover:text-cyan-600">
          Novo botao de acao
        </button>
      </div>
      <FooterStatus value={config.typing_seconds} onChange={(value) => updateConfig({ typing_seconds: value })} />
    </>
  );

  const renderExternalCall = () => (
    <>
      <div className="border-t border-b border-slate-200/80 px-5 py-6 text-center">
        <button type="button" onClick={(event) => { event.stopPropagation(); setRequestModalOpen(true); }} className="nodrag nopan text-sm font-semibold text-blue-600 hover:text-blue-700">
          Configurar etapa do fluxo
        </button>
      </div>
      {requestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-6">
          <div className="nodrag nopan w-full max-w-4xl rounded-xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-2xl font-black text-slate-950">Requisicao</h3>
            <div className="mt-6 grid grid-cols-[110px,minmax(0,1fr),86px] gap-3">
              <select value={config.method || 'GET'} onChange={(event) => updateConfig({ method: event.target.value })} className="h-11 rounded-md border border-slate-200 px-3 font-semibold outline-none">
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => <option key={method}>{method}</option>)}
              </select>
              <input value={config.url || ''} onChange={(event) => updateConfig({ url: event.target.value })} placeholder="Informe a URL" className="h-11 rounded-md border border-slate-200 px-3 font-semibold outline-none" />
              <button type="button" className="rounded-md bg-teal-500 text-sm font-black text-white">Testar</button>
            </div>
            <div className="mt-6 flex gap-8 border-b border-slate-200">
              {['headers', 'body', 'resposta', 'mapear'].map((tab) => (
                <button key={tab} type="button" onClick={() => setRequestTab(tab)} className={cn('pb-3 text-sm font-semibold capitalize', requestTab === tab ? 'border-b-2 border-teal-400 text-teal-500' : 'text-slate-600')}>
                  {tab === 'mapear' ? 'Mapear campos' : tab}
                </button>
              ))}
            </div>
            <div className="min-h-[150px] py-5">
              {requestTab === 'headers' && <button type="button" className="text-sm font-semibold text-blue-500">+ Adicionar header</button>}
              {requestTab === 'body' && <textarea value={config.body || ''} onChange={(event) => updateConfig({ body: event.target.value })} className="h-40 w-full rounded-md border border-slate-200 p-3 outline-none" />}
              {(requestTab === 'resposta' || requestTab === 'mapear') && <div className="py-8 text-center font-bold text-slate-400">Execute o teste para obter a resposta</div>}
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <button type="button" onClick={() => setRequestModalOpen(false)} className="rounded-md bg-slate-100 px-6 py-3 font-semibold text-slate-600">Cancelar</button>
              <button type="button" onClick={() => setRequestModalOpen(false)} className="rounded-md bg-violet-600 px-8 py-3 font-black text-white">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderSimpleConfig = () => {
    if (isCondition) {
      if (isValidationCondition) {
        const maxRetries = config.max_retries === '' || config.max_retries === '0' ? 'infinito' : (config.max_retries || '3');

        return (
          <div className="space-y-3 border-t border-b border-slate-200/80 px-5 py-4">
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-600">Regra</div>
              <div className="mt-1 flex items-center gap-2 text-xs font-bold text-slate-600">
                {config.validation_type === 'email'
                  ? 'E-mail'
                  : config.validation_type === 'number'
                    ? 'Apenas numeros'
                    : config.validation_type === 'number_length'
                      ? `Numero com ${config.exact_length || '?'} digitos`
                      : 'CPF ou CNPJ'}
                <span className="text-slate-300">·</span>
                <input
                  type="number"
                  min="0"
                  value={config.max_retries ?? '3'}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => updateConfig({ max_retries: event.target.value })}
                  className="nodrag nopan h-7 w-12 rounded-md border border-amber-200 bg-white text-center text-xs font-black text-amber-700 outline-none focus:border-amber-400"
                  title="Limite de tentativas. Use 0 para infinito."
                />
                <span className="text-slate-400">{maxRetries === 'infinito' ? 'tentativas' : 'tent.'}</span>
              </div>
            </div>
            <div className="relative flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
              {config.true_label || 'Valido'}
              <NodeHandle id="true" tone="emerald" className="!right-[-28px]" />
            </div>
            <div className="relative flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
              {config.retry_label || 'Tentar novamente'}
              <NodeHandle id="retry" tone="amber" className="!right-[-28px]" />
            </div>
            <div className="relative flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
              {config.false_label || 'Falha'}
              <NodeHandle id="false" tone="rose" className="!right-[-28px]" />
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-3 border-t border-b border-slate-200/80 px-5 py-4">
          <input value={config.field || ''} onClick={(event) => event.stopPropagation()} onChange={(event) => updateConfig({ field: event.target.value })} placeholder="Campo" className="nodrag nopan h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none" />
          <input value={config.value || config.tag || ''} onClick={(event) => event.stopPropagation()} onChange={(event) => updateConfig(node.type === 'condition_contact_has_tag' ? { tag: event.target.value } : { value: event.target.value })} placeholder="Valor esperado" className="nodrag nopan h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none" />
          <div className="relative flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
            Verdadeiro
            <NodeHandle id="true" tone="emerald" className="!right-[-28px]" />
          </div>
          <div className="relative flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
            Falso
            <NodeHandle id="false" tone="rose" className="!right-[-28px]" />
          </div>
        </div>
      );
    }
    return (
      <div className="border-t border-b border-slate-200/80 px-5 py-4">
        <input value={config.value || config.tag || config.title || ''} onClick={(event) => event.stopPropagation()} onChange={(event) => updateConfig({ value: event.target.value, tag: event.target.value, title: event.target.value })} placeholder="Configure este bloco" className="nodrag nopan h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none" />
      </div>
    );
  };

  const renderBody = () => {
    if (node.type === 'trigger_start') {
      const triggerLabel = localTriggerType === 'keyword'
        ? `Dispara com a palavra: "${localKeyword || '...'}"` 
        : 'Dispara com Qualquer Interacao.';

      return (
        <div className="border-t border-slate-200/80 px-5 py-4 space-y-3">
          {!isTriggerEditing ? (
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
              <div className="text-[10px] font-black uppercase text-emerald-600 mb-1">Gatilho Configurado</div>
              <div className="text-xs font-semibold text-slate-600">{triggerLabel}</div>
              {localWorkingHours && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                  <Clock3 className="h-3 w-3" /> Horario comercial ativo
                </div>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsTriggerEditing(true); }}
                className="mt-3 nodrag nopan h-8 w-full rounded-lg border border-emerald-200 bg-white text-[10px] font-black uppercase text-emerald-600 hover:bg-emerald-50 transition-all"
              >
                Editar Gatilho
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Tipo de Gatilho</label>
                <select
                  value={localTriggerType}
                  onChange={(e) => { e.stopPropagation(); setLocalTriggerType(e.target.value); }}
                  onClick={(e) => e.stopPropagation()}
                  className="nodrag nopan w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="any_interaction">Qualquer Interacao</option>
                  <option value="keyword">Palavra-chave</option>
                </select>
              </div>

              {localTriggerType === 'keyword' && (
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Palavra-chave</label>
                  <input
                    type="text"
                    value={localKeyword}
                    onChange={(e) => { e.stopPropagation(); setLocalKeyword(e.target.value); }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Ex: oi, ajuda"
                    className="nodrag nopan w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-300 focus:bg-white"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={localWorkingHours}
                  onChange={(e) => { e.stopPropagation(); setLocalWorkingHours(e.target.checked); }}
                  onClick={(e) => e.stopPropagation()}
                  className="nodrag nopan h-3.5 w-3.5 rounded border-slate-300"
                />
                Horario Comercial
              </label>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateConfig({
                    trigger_type: localTriggerType,
                    keyword: localKeyword,
                    use_working_hours: localWorkingHours
                  });
                  setIsTriggerEditing(false);
                }}
                className="nodrag nopan h-9 w-full rounded-lg bg-emerald-600 text-[10px] font-black uppercase text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all"
              >
                Confirmar
              </button>
            </div>
          )}
        </div>
      );
    }

    if (isLink) return renderLink();
    if (isMedia) {
      return (
        <>
          {renderMediaPreview()}
          {renderMessageInput({ placeholder: 'Legenda da mídia (opcional)' })}
          <label className="flex items-center gap-2 border-b border-slate-200/80 px-5 py-3 text-xs font-semibold italic text-slate-500">
            <input type="checkbox" checked={Boolean(config.mark_as_forwarded)} onClick={(event) => event.stopPropagation()} onChange={(event) => updateConfig({ mark_as_forwarded: event.target.checked })} className="nodrag nopan h-4 w-4 rounded border-slate-300" />
            Marcar como encaminhada
          </label>
          <FooterStatus
            accent="violet"
            label={node.type === 'send_audio' ? 'Status gravando' : 'Status digitando'}
            value={node.type === 'send_audio' ? config.recording_seconds : config.typing_seconds}
            onChange={(val) => updateConfig(node.type === 'send_audio' ? { recording_seconds: val } : { typing_seconds: val })}
          />
        </>
      );
    }
    if (isOptions) return renderOptions();
    if (isDelay) return renderDelay();
    if (isCopyCode) return renderCopyCode();
    if (isActionButtons) return renderActionButtons();
    if (isExternalCall) return renderExternalCall();
    if (isMessageLike) {
      return (
        <>
          {renderMessageInput()}
          <label className="flex items-center gap-2 border-b border-slate-200/80 px-5 py-3 text-xs font-semibold italic text-slate-500">
            <input type="checkbox" checked={Boolean(config.mark_as_forwarded)} onClick={(event) => event.stopPropagation()} onChange={(event) => updateConfig({ mark_as_forwarded: event.target.checked })} className="nodrag nopan h-4 w-4 rounded border-slate-300" />
            Marcar como encaminhada
          </label>
          <FooterStatus value={config.typing_seconds} onChange={(value) => updateConfig({ typing_seconds: value })} />
        </>
      );
    }

    return renderSimpleConfig();
  };

  return (
    <div
      onClick={() => onSelect(id)}
      className={cn(
        'group relative w-[320px] rounded-lg border bg-white shadow-[0_14px_35px_rgba(15,23,42,0.12)] transition-all',
        selected ? 'border-cyan-400 ring-2 ring-cyan-200' : 'border-cyan-300'
      )}
    >
      {selected && !isStart && (
        <div className="absolute -top-14 left-1/2 z-20 flex -translate-x-1/2 items-center gap-5 rounded-md bg-slate-800 px-5 py-3 text-sm font-semibold text-white shadow-xl">
          <button type="button" onClick={(event) => { event.stopPropagation(); onDuplicate(id); }} className="nodrag nopan inline-flex items-center gap-2">
            <Copy className="h-4 w-4" />Duplicar
          </button>
          <button type="button" onClick={(event) => { event.stopPropagation(); onRemove(id); }} className="nodrag nopan inline-flex items-center gap-2">
            <Trash2 className="h-4 w-4" />Remover
          </button>
        </div>
      )}

      <NodeHandle type="target" position={Position.Left} className="!left-[-9px]" />
      <NodeHandle type="target" position={Position.Top} className="!top-[-9px]" />

      <div className={cn('rounded-t-lg px-4 py-2', isMedia ? 'bg-violet-500' : isExternalCall ? 'bg-sky-500' : 'bg-[#4a7285]')}>
        <div className="flex gap-1.5">
          <Stat label="Exec." value={node.metrics?.running ?? 0} />
          <Stat label="Env." value={node.metrics?.sent ?? 0} />
          {(isOptions || isActionButtons) && <Stat label="Clic." value={`${node.metrics?.clicked ?? 0}%`} />}
        </div>
      </div>

      {renderBody()}

      {!isCondition && (
        <NodeHandle id="next" type="source" position={Position.Right} className="!right-[-9px]" />
      )}
      <NodeHandle id="bottom" type="source" position={Position.Bottom} className="!bottom-[-9px] !left-1/2" />

      <div className="border-t border-slate-200/80 px-4 py-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onQuickAdd(id);
          }}
          className="nodrag nopan w-full rounded-lg border border-dashed border-cyan-300 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-500 hover:bg-cyan-50"
        >
          + Adicionar proximo bloco
        </button>
      </div>

      {/* Sensor de arquivos global */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={chooseFile}
        className="hidden"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
