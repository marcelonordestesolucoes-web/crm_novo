import React, { useMemo, useRef, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Check,
  CircleHelp,
  Copy,
  FileText,
  Link2,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Phone,
  Play,
  Plus,
  SendHorizontal,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <div className="grid grid-cols-[minmax(0,1fr),118px] items-center gap-2 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2', accentClass)}>
          <MoreHorizontal className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-slate-600">{label}</div>
          <div className="mt-1 flex items-center gap-1.5">
            <input
              value={value ?? '0'}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onChange(event.target.value)}
              className="nodrag nopan h-7 w-9 rounded-full border border-slate-200 bg-slate-50 text-center text-xs font-bold text-slate-700 outline-none focus:border-cyan-300"
            />
            <span className="text-xs font-semibold text-slate-500">segundos</span>
          </div>
        </div>
      </div>
      <div className="text-right text-[12px] font-semibold text-slate-700">Proximo passo</div>
    </div>
  );
}

function ActivatedText({ children }) {
  return (
    <div className="rounded-2xl bg-[#d8fbf4] px-4 py-4 text-[14px] font-semibold leading-relaxed text-slate-700">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 whitespace-pre-wrap break-words">{children}</div>
        <Check className="h-4 w-4 shrink-0 text-[#3fc9b9]" />
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

  const isStart = node.type === 'trigger_start';
  const isCondition = node.type.startsWith('condition_');
  const isOptions = node.type === 'send_options';
  const isActionButtons = node.type === 'send_action_buttons';
  const isCopyCode = node.type === 'send_copy_code';
  const isExternalCall = node.type === 'integration_external_call';
  const isLink = node.type === 'send_link';
  const mediaMeta = MEDIA_META[node.type];
  const isMedia = Boolean(mediaMeta);
  const isMessageLike = MESSAGE_TYPES.has(node.type) || isActionButtons;
  const textActivated = Boolean(config.text_activated);
  const hasMessageText = Boolean(String(config.message || '').trim());
  const hasActionText = Boolean(String(config.title || config.description || config.footer || '').trim());
  const actions = useMemo(() => {
    if (!Array.isArray(config.actions) || !config.actions.length) {
      return [{ type: 'link', title: '', value: '' }];
    }
    return config.actions;
  }, [config.actions]);
  const options = useMemo(() => String(config.options || 'Sim\nNao').split('\n'), [config.options]);
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

  const chooseFile = (event) => {
    const file = event.target.files?.[0];
    if (!file || !mediaMeta) return;
    updateConfig({
      [`${mediaMeta.prefix}_name`]: file.name,
      [`${mediaMeta.prefix}_file_size`]: file.size,
      [`${mediaMeta.prefix}_ready`]: true,
      [`${mediaMeta.prefix}_uploading`]: false,
      [`${mediaMeta.prefix}_source`]: 'file'
    });
  };

  const renderActivationRow = ({ withAttach = false, actionMode = false } = {}) => (
    <div className={cn('grid items-center gap-2', withAttach ? 'grid-cols-[28px,28px,minmax(0,1fr),40px]' : 'grid-cols-[28px,minmax(0,1fr),40px]')}>
      {withAttach && (
        <button type="button" onClick={(event) => event.stopPropagation()} className="nodrag nopan flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
          <Plus className="h-4 w-4" />
        </button>
      )}
      <button type="button" onClick={(event) => event.stopPropagation()} className="nodrag nopan flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
        <MessageCircle className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          updateConfig({ text_activated: false });
        }}
        className="nodrag nopan h-10 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 underline underline-offset-2 hover:border-cyan-300 hover:text-cyan-600"
      >
        Editar
      </button>
      <button
        type="button"
        onClick={(event) => event.stopPropagation()}
        className="nodrag nopan flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-300"
        title={actionMode ? 'Texto ativado' : 'Mensagem ativada'}
      >
        <SendHorizontal className="h-5 w-5" />
      </button>
    </div>
  );

  const renderMessageInput = ({ placeholder = 'Digite sua mensagem', withAttach = false } = {}) => (
    <div className="border-t border-b border-slate-200/80 bg-white/90 px-5 py-4">
      <div className="mb-4 text-center text-[12px] font-semibold italic tracking-wide text-slate-300">
        Digite sua mensagem abaixo
      </div>
      {!textActivated ? (
        <div className={cn('grid items-center gap-2', withAttach ? 'grid-cols-[28px,28px,minmax(0,1fr),40px]' : 'grid-cols-[28px,minmax(0,1fr),40px]')}>
          {withAttach && (
            <button type="button" onClick={(event) => event.stopPropagation()} className="nodrag nopan flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
              <Plus className="h-4 w-4" />
            </button>
          )}
          <button type="button" onClick={(event) => event.stopPropagation()} className="nodrag nopan flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <MessageCircle className="h-4 w-4" />
          </button>
          <input
            value={config.message || ''}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => updateConfig({ message: event.target.value, text_activated: false })}
            placeholder={placeholder}
            className="nodrag nopan h-10 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
          />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              activateMessage();
            }}
            className={cn(
              'nodrag nopan flex h-10 w-10 items-center justify-center rounded-full border transition-all',
              hasMessageText ? 'border-cyan-300 bg-cyan-100 text-cyan-600' : 'border-slate-200 bg-slate-100 text-slate-300'
            )}
            title="Ativar mensagem"
          >
            <SendHorizontal className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <ActivatedText>{config.message || 'Mensagem vazia'}</ActivatedText>
          {renderActivationRow({ withAttach })}
        </div>
      )}
    </div>
  );

  const renderLink = () => (
    <>
      <div className="border-t border-b border-slate-200/80 bg-white/90 px-5 py-4">
        <div className="mb-4 text-center text-[12px] font-semibold italic tracking-wide text-slate-300">
          Insira o link abaixo
        </div>
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

  const renderMedia = () => {
    const prefix = mediaMeta.prefix;
    const FileIcon = mediaMeta.icon;
    const name = config[`${prefix}_name`] || '';
    const ready = Boolean(config[`${prefix}_ready`]);

    return (
      <>
        <div className="border-t border-b border-slate-200/80 bg-white px-5 py-5">
          <div className="rounded-2xl bg-slate-100 px-5 py-7 text-center">
            <FileIcon className="mx-auto h-8 w-8 text-slate-500" />
            <div className="mt-3 text-xs font-semibold text-slate-600">Carregar {mediaMeta.label} do computador</div>
            <div className="mt-1 text-[10px] font-medium text-slate-400">Tamanho maximo de arquivo</div>
            <div className="mt-2 text-sm font-black text-violet-600">60 MB</div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="nodrag nopan mt-2 rounded-full bg-violet-600 px-7 py-2 text-sm font-black text-white shadow-lg shadow-violet-500/20 hover:bg-violet-500"
            >
              Carregar
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                updateConfig({ show_link_input: !config.show_link_input });
              }}
              className="nodrag nopan mt-2 block w-full text-xs font-semibold text-violet-500 underline"
            >
              Inserir por link
            </button>
            <input ref={fileInputRef} type="file" accept={mediaMeta.accept} onChange={chooseFile} className="hidden" />
          </div>
          {config.show_link_input && (
            <input
              value={config[`${prefix}_link`] || ''}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => updateConfig({ [`${prefix}_link`]: event.target.value, [`${prefix}_ready`]: Boolean(event.target.value.trim()) })}
              placeholder="Cole o link do arquivo"
              className="nodrag nopan mt-3 h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-violet-300"
            />
          )}
          {ready && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-600">
              <Check className="h-4 w-4 text-emerald-500" />
              <span className="min-w-0 flex-1 truncate">{name || config[`${prefix}_link`] || 'Arquivo pronto'}</span>
              <button type="button" onClick={(event) => { event.stopPropagation(); updateConfig({ [`${prefix}_ready`]: false, [`${prefix}_name`]: '', [`${prefix}_link`]: '' }); }} className="nodrag nopan text-slate-400 hover:text-rose-500">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        {renderMessageInput({ placeholder: 'Digite @ p/ utilizar os campos' })}
        <label className="flex items-center gap-2 border-b border-slate-200/80 px-5 py-3 text-xs font-semibold italic text-slate-500">
          <input
            type="checkbox"
            checked={Boolean(config.mark_as_forwarded)}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => updateConfig({ mark_as_forwarded: event.target.checked })}
            className="nodrag nopan h-4 w-4 rounded border-slate-300"
          />
          Marcar como encaminhada
        </label>
        <FooterStatus
          accent="violet"
          label={node.type === 'send_audio' ? 'Status gravando' : 'Status digitando'}
          value={node.type === 'send_audio' ? config.recording_seconds : config.typing_seconds}
          onChange={(value) => updateConfig(node.type === 'send_audio' ? { recording_seconds: value } : { typing_seconds: value })}
        />
      </>
    );
  };

  const renderOptions = () => (
    <>
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
      {optionFormat === 'lista' && (
        <div className="border-b border-slate-200/80 px-5 py-3">
          <input
            value={config.list_title || ''}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => updateConfig({ list_title: event.target.value })}
            placeholder="Selecione as opcoes abaixo:"
            className="nodrag nopan h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-cyan-300"
          />
        </div>
      )}
      <div className="space-y-2 border-b border-slate-200/80 px-5 py-4">
        <div className="text-xs font-semibold italic text-slate-500">Opcoes:</div>
        {options.map((option, index) => (
          <div key={`${id}-option-${index}`} className="relative grid grid-cols-[minmax(0,1fr),54px,24px] items-center gap-2">
            <input
              value={option}
              maxLength={20}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => updateOption(index, event.target.value)}
              className="nodrag nopan h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-cyan-300"
            />
            <span className="text-right text-[10px] font-black text-cyan-600">CTR 0,0%</span>
            <button type="button" onClick={(event) => { event.stopPropagation(); removeOption(index); }} className="nodrag nopan flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500">
              <X className="h-3 w-3" />
            </button>
            <NodeHandle id={`option_${index}`} className="!right-[-34px]" />
          </div>
        ))}
        <button
          type="button"
          disabled={optionFormat === 'botoes' && options.length >= 3}
          onClick={(event) => { event.stopPropagation(); addOption(); }}
          className="nodrag nopan ml-auto block text-xs font-semibold text-slate-400 underline hover:text-cyan-600 disabled:text-slate-300"
        >
          Novo botao
        </button>
      </div>
      <div className="relative border-b border-slate-200/80 px-5 py-3 text-xs font-semibold italic text-slate-500">
        Se nao responder em
        <input
          value={config.timeout_seconds ?? '0'}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => updateConfig({ timeout_seconds: event.target.value })}
          className="nodrag nopan mx-2 h-7 w-10 rounded-full border border-slate-200 bg-slate-500 text-center text-xs font-bold text-white outline-none"
        />
        Segundos
        <NodeHandle id="timeout" tone="rose" className="!right-[-34px]" />
      </div>
      <div className="relative px-5 py-3 text-xs font-semibold italic text-slate-500">
        Caso a resposta seja invalida
        <NodeHandle id="invalid" tone="amber" className="!right-[-34px]" />
      </div>
    </>
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
    if (isStart) {
      return (
        <div className="border-t border-b border-slate-200/80 px-5 py-4">
          <input value={config.message || 'Entrada principal da automacao.'} onClick={(event) => event.stopPropagation()} onChange={(event) => updateConfig({ message: event.target.value })} className="nodrag nopan h-10 w-full rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-600 outline-none focus:border-cyan-300" />
        </div>
      );
    }
    if (isCondition) {
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
    if (isLink) return renderLink();
    if (isMedia) return renderMedia();
    if (isOptions) return renderOptions();
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
        'group relative w-[270px] rounded-lg border bg-white shadow-[0_14px_35px_rgba(15,23,42,0.12)] transition-all',
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

      <div className={cn('rounded-t-lg px-4 py-3', isMedia ? 'bg-violet-500' : isExternalCall ? 'bg-sky-500' : isActionButtons || isCopyCode ? 'bg-slate-700' : 'bg-[#25c9bc]')}>
        <div className="flex gap-2">
          <Stat label="Executando" value={node.metrics?.running ?? 0} />
          <Stat label="Enviados" value={node.metrics?.sent ?? 0} />
          {(isOptions || isActionButtons) && <Stat label="Clicado" value={`${node.metrics?.clicked ?? 0}%`} />}
        </div>
      </div>

      <div className="flex items-center gap-3 border-b border-slate-200/80 px-5 py-4">
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', meta.iconWrapClass || 'bg-cyan-100 text-cyan-600')}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-black text-slate-600">{meta.title}</div>
          <div className="text-sm font-semibold text-cyan-500">{meta.group}</div>
        </div>
        <div className="flex flex-col gap-2 text-slate-500">
          <CircleHelp className="h-5 w-5" />
          <Play className="h-5 w-5 fill-current" />
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
    </div>
  );
}
