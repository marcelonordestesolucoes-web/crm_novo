import React from 'react';

function SectionTitle({ children }) {
  return (
    <p className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
      {children}
    </p>
  );
}

function TextInput({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">{label}</span>
      <input
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-primary/10"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 4 }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">{label}</span>
      <textarea
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-primary/10 resize-none"
      />
    </label>
  );
}

function SelectInput({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">{label}</span>
      <select
        value={value || options?.[0]?.value || ''}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function VariablePills() {
  return (
    <div className="flex flex-wrap gap-2">
      {['{nome}', '{empresa}', '{telefone}', '{etapa}'].map((variable) => (
        <span key={variable} className="rounded-full bg-primary/8 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-primary">
          {variable}
        </span>
      ))}
    </div>
  );
}

export default function FlowSidebarEditor({
  selectedNode,
  selectedMeta,
  onUpdateNode,
  onClearSelection
}) {
  if (!selectedNode || !selectedMeta) {
    return (
      <aside className="rounded-[2rem] border border-white/70 bg-white/70 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
        <SectionTitle>Editor</SectionTitle>
        <h3 className="text-xl font-black tracking-tight text-slate-950">Selecione um bloco</h3>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-500">
          Clique em um bloco do canvas para editar seus campos. O painel lateral muda de acordo com o tipo do bloco.
        </p>
      </aside>
    );
  }

  const config = selectedNode.config || {};
  const update = (field, value) => onUpdateNode(selectedNode.id, { [field]: value });

  return (
    <aside className="rounded-[2rem] border border-white/70 bg-white/70 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <SectionTitle>Editor</SectionTitle>
          <h3 className="text-xl font-black tracking-tight text-slate-950">{selectedMeta.title}</h3>
          <p className="mt-2 text-sm font-semibold text-slate-500">{selectedMeta.description}</p>
        </div>
        <button
          onClick={onClearSelection}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 transition-all hover:border-primary/20 hover:text-primary"
        >
          Fechar
        </button>
      </div>

      <div className="space-y-5">
        {selectedNode.type === 'trigger_start' && (
          <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 text-sm font-semibold text-slate-600">
            Este bloco marca o ponto de entrada do fluxo. Ele deve permanecer como primeiro passo.
          </div>
        )}

        {selectedNode.type === 'trigger_message_received' && (
          <>
            <SelectInput
              label="Canal monitorado"
              value={config.channel || 'whatsapp'}
              onChange={(value) => update('channel', value)}
              options={[
                { value: 'whatsapp', label: 'WhatsApp' },
                { value: 'crm', label: 'CRM' }
              ]}
            />
            <TextInput
              label="Filtro opcional"
              value={config.keyword || ''}
              onChange={(value) => update('keyword', value)}
              placeholder="Ex.: orcamento, proposta"
            />
          </>
        )}

        {selectedNode.type === 'trigger_new_contact' && (
          <TextInput
            label="Origem do contato"
            value={config.source || ''}
            onChange={(value) => update('source', value)}
            placeholder="Ex.: landing page, importacao"
          />
        )}

        {selectedNode.type === 'trigger_new_lead' && (
          <TextInput
            label="Pipeline alvo"
            value={config.pipeline || ''}
            onChange={(value) => update('pipeline', value)}
            placeholder="Ex.: Comercial"
          />
        )}

        {selectedNode.type === 'send_message' && (
          <>
            <TextArea
              label="Texto da mensagem"
              value={config.message || ''}
              onChange={(value) => update('message', value)}
              placeholder="Digite sua mensagem"
              rows={6}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextInput
                label="Tempo digitando (s)"
                value={config.typing_seconds || '0'}
                onChange={(value) => update('typing_seconds', value)}
                placeholder="0"
              />
              <SelectInput
                label="Encaminhada"
                value={config.mark_as_forwarded ? 'yes' : 'no'}
                onChange={(value) => update('mark_as_forwarded', value === 'yes')}
                options={[
                  { value: 'no', label: 'Nao' },
                  { value: 'yes', label: 'Sim' }
                ]}
              />
            </div>
            <SelectInput
              label="Texto ativado"
              value={config.text_activated ? 'yes' : 'no'}
              onChange={(value) => update('text_activated', value === 'yes')}
              options={[
                { value: 'no', label: 'Nao' },
                { value: 'yes', label: 'Sim' }
              ]}
            />
            <div>
              <SectionTitle>Variaveis</SectionTitle>
              <VariablePills />
            </div>
            <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
              <SectionTitle>Preview</SectionTitle>
              <p className="text-sm font-semibold leading-relaxed text-slate-700">
                {config.message || 'Sua mensagem aparecera aqui.'}
              </p>
            </div>
          </>
        )}

        {selectedNode.type === 'send_link' && (
          <>
            <TextInput
              label="URL do link"
              value={config.link_url || ''}
              onChange={(value) => update('link_url', value)}
              placeholder="https://seulink.com"
            />
            <SelectInput
              label="Link ativado"
              value={config.link_activated ? 'yes' : 'no'}
              onChange={(value) => update('link_activated', value === 'yes')}
              options={[
                { value: 'no', label: 'Nao' },
                { value: 'yes', label: 'Sim' }
              ]}
            />
            <TextArea
              label="Texto complementar"
              value={config.message || ''}
              onChange={(value) => update('message', value)}
              placeholder="Digite o texto junto do link"
              rows={4}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextInput
                label="Tempo digitando (s)"
                value={config.typing_seconds || '0'}
                onChange={(value) => update('typing_seconds', value)}
                placeholder="0"
              />
              <SelectInput
                label="Texto ativado"
                value={config.text_activated ? 'yes' : 'no'}
                onChange={(value) => update('text_activated', value === 'yes')}
                options={[
                  { value: 'no', label: 'Nao' },
                  { value: 'yes', label: 'Sim' }
                ]}
              />
            </div>
            <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
              <SectionTitle>Preview</SectionTitle>
              <p className="text-sm font-semibold leading-relaxed text-slate-700">
                {config.link_url || 'O preview do link aparecera aqui.'}
              </p>
              {config.message ? (
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
                  {config.message}
                </p>
              ) : null}
            </div>
          </>
        )}

        {selectedNode.type === 'send_video' && (
          <>
            <SelectInput
              label="Origem do video"
              value={config.video_source || 'file'}
              onChange={(value) => update('video_source', value)}
              options={[
                { value: 'file', label: 'Upload' },
                { value: 'link', label: 'Link' }
              ]}
            />
            <TextInput
              label="Nome do video"
              value={config.video_name || ''}
              onChange={(value) => update('video_name', value)}
              placeholder="Ex.: apresentacao.mp4"
            />
            <TextInput
              label="Link do video"
              value={config.video_link || ''}
              onChange={(value) => update('video_link', value)}
              placeholder="https://meuvideo.com"
            />
            <div className="grid grid-cols-2 gap-3">
              <SelectInput
                label="Video pronto"
                value={config.video_ready ? 'yes' : 'no'}
                onChange={(value) => update('video_ready', value === 'yes')}
                options={[
                  { value: 'no', label: 'Nao' },
                  { value: 'yes', label: 'Sim' }
                ]}
              />
              <SelectInput
                label="Carregando"
                value={config.video_uploading ? 'yes' : 'no'}
                onChange={(value) => update('video_uploading', value === 'yes')}
                options={[
                  { value: 'no', label: 'Nao' },
                  { value: 'yes', label: 'Sim' }
                ]}
              />
            </div>
            <TextArea
              label="Texto complementar"
              value={config.message || ''}
              onChange={(value) => update('message', value)}
              placeholder="Digite uma legenda ou texto junto do video"
              rows={4}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextInput
                label="Tempo digitando (s)"
                value={config.typing_seconds || '0'}
                onChange={(value) => update('typing_seconds', value)}
                placeholder="0"
              />
              <SelectInput
                label="Encaminhada"
                value={config.mark_as_forwarded ? 'yes' : 'no'}
                onChange={(value) => update('mark_as_forwarded', value === 'yes')}
                options={[
                  { value: 'no', label: 'Nao' },
                  { value: 'yes', label: 'Sim' }
                ]}
              />
            </div>
            <SelectInput
              label="Texto ativado"
              value={config.text_activated ? 'yes' : 'no'}
              onChange={(value) => update('text_activated', value === 'yes')}
              options={[
                { value: 'no', label: 'Nao' },
                { value: 'yes', label: 'Sim' }
              ]}
            />
            <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
              <SectionTitle>Preview</SectionTitle>
              <p className="text-sm font-semibold leading-relaxed text-slate-700">
                {config.video_name || config.video_link || 'O preview do video aparecera aqui.'}
              </p>
              {config.message ? (
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
                  {config.message}
                </p>
              ) : null}
            </div>
          </>
        )}

        {selectedNode.type === 'send_image' && (
          <>
            <SelectInput
              label="Origem da imagem"
              value={config.image_source || 'file'}
              onChange={(value) => update('image_source', value)}
              options={[
                { value: 'file', label: 'Upload' },
                { value: 'link', label: 'Link' }
              ]}
            />
            <TextInput
              label="Nome da imagem"
              value={config.image_name || ''}
              onChange={(value) => update('image_name', value)}
              placeholder="Ex.: banner.png"
            />
            <TextInput
              label="Link da imagem"
              value={config.image_link || ''}
              onChange={(value) => update('image_link', value)}
              placeholder="https://minhaimagem.com"
            />
            <div className="grid grid-cols-2 gap-3">
              <SelectInput
                label="Imagem pronta"
                value={config.image_ready ? 'yes' : 'no'}
                onChange={(value) => update('image_ready', value === 'yes')}
                options={[
                  { value: 'no', label: 'Nao' },
                  { value: 'yes', label: 'Sim' }
                ]}
              />
              <SelectInput
                label="Carregando"
                value={config.image_uploading ? 'yes' : 'no'}
                onChange={(value) => update('image_uploading', value === 'yes')}
                options={[
                  { value: 'no', label: 'Nao' },
                  { value: 'yes', label: 'Sim' }
                ]}
              />
            </div>
            <TextArea
              label="Legenda"
              value={config.message || ''}
              onChange={(value) => update('message', value)}
              placeholder="Digite uma legenda para a imagem"
              rows={4}
            />
            <div className="grid grid-cols-2 gap-3">
              <SelectInput
                label="Texto ativado"
                value={config.text_activated ? 'yes' : 'no'}
                onChange={(value) => update('text_activated', value === 'yes')}
                options={[
                  { value: 'no', label: 'Nao' },
                  { value: 'yes', label: 'Sim' }
                ]}
              />
              <SelectInput
                label="Encaminhada"
                value={config.mark_as_forwarded ? 'yes' : 'no'}
                onChange={(value) => update('mark_as_forwarded', value === 'yes')}
                options={[
                  { value: 'no', label: 'Nao' },
                  { value: 'yes', label: 'Sim' }
                ]}
              />
            </div>
          </>
        )}

        {selectedNode.type === 'send_audio' && (
          <>
            <SelectInput
              label="Origem do audio"
              value={config.audio_source || 'file'}
              onChange={(value) => update('audio_source', value)}
              options={[
                { value: 'file', label: 'Upload' },
                { value: 'link', label: 'Link' }
              ]}
            />
            <TextInput
              label="Nome do audio"
              value={config.audio_name || ''}
              onChange={(value) => update('audio_name', value)}
              placeholder="Ex.: atendimento.mp3"
            />
            <TextInput
              label="Link do audio"
              value={config.audio_link || ''}
              onChange={(value) => update('audio_link', value)}
              placeholder="https://meuaudio.com"
            />
            <div className="grid grid-cols-2 gap-3">
              <SelectInput
                label="Audio pronto"
                value={config.audio_ready ? 'yes' : 'no'}
                onChange={(value) => update('audio_ready', value === 'yes')}
                options={[
                  { value: 'no', label: 'Nao' },
                  { value: 'yes', label: 'Sim' }
                ]}
              />
              <SelectInput
                label="Carregando"
                value={config.audio_uploading ? 'yes' : 'no'}
                onChange={(value) => update('audio_uploading', value === 'yes')}
                options={[
                  { value: 'no', label: 'Nao' },
                  { value: 'yes', label: 'Sim' }
                ]}
              />
            </div>
            <TextArea
              label="Texto complementar"
              value={config.message || ''}
              onChange={(value) => update('message', value)}
              placeholder="Digite um texto junto do audio"
              rows={4}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextInput
                label="Status gravando (s)"
                value={config.recording_seconds || '0'}
                onChange={(value) => update('recording_seconds', value)}
                placeholder="0"
              />
              <SelectInput
                label="Encaminhada"
                value={config.mark_as_forwarded ? 'yes' : 'no'}
                onChange={(value) => update('mark_as_forwarded', value === 'yes')}
                options={[
                  { value: 'no', label: 'Nao' },
                  { value: 'yes', label: 'Sim' }
                ]}
              />
            </div>
            <SelectInput
              label="Texto ativado"
              value={config.text_activated ? 'yes' : 'no'}
              onChange={(value) => update('text_activated', value === 'yes')}
              options={[
                { value: 'no', label: 'Nao' },
                { value: 'yes', label: 'Sim' }
              ]}
            />
          </>
        )}

        {selectedNode.type === 'send_document' && (
          <>
            <SelectInput
              label="Origem do documento"
              value={config.document_source || 'file'}
              onChange={(value) => update('document_source', value)}
              options={[
                { value: 'file', label: 'Upload' },
                { value: 'link', label: 'Link' }
              ]}
            />
            <TextInput
              label="Nome do documento"
              value={config.document_name || ''}
              onChange={(value) => update('document_name', value)}
              placeholder="Ex.: proposta.pdf"
            />
            <TextInput
              label="Link do documento"
              value={config.document_link || ''}
              onChange={(value) => update('document_link', value)}
              placeholder="https://meudocumento.com"
            />
            <div className="grid grid-cols-2 gap-3">
              <SelectInput
                label="Documento pronto"
                value={config.document_ready ? 'yes' : 'no'}
                onChange={(value) => update('document_ready', value === 'yes')}
                options={[
                  { value: 'no', label: 'Nao' },
                  { value: 'yes', label: 'Sim' }
                ]}
              />
              <SelectInput
                label="Carregando"
                value={config.document_uploading ? 'yes' : 'no'}
                onChange={(value) => update('document_uploading', value === 'yes')}
                options={[
                  { value: 'no', label: 'Nao' },
                  { value: 'yes', label: 'Sim' }
                ]}
              />
            </div>
            <TextArea
              label="Texto complementar"
              value={config.message || ''}
              onChange={(value) => update('message', value)}
              placeholder="Digite um texto junto do documento"
              rows={4}
            />
            <div className="grid grid-cols-2 gap-3">
              <SelectInput
                label="Texto ativado"
                value={config.text_activated ? 'yes' : 'no'}
                onChange={(value) => update('text_activated', value === 'yes')}
                options={[
                  { value: 'no', label: 'Nao' },
                  { value: 'yes', label: 'Sim' }
                ]}
              />
              <SelectInput
                label="Encaminhada"
                value={config.mark_as_forwarded ? 'yes' : 'no'}
                onChange={(value) => update('mark_as_forwarded', value === 'yes')}
                options={[
                  { value: 'no', label: 'Nao' },
                  { value: 'yes', label: 'Sim' }
                ]}
              />
            </div>
          </>
        )}

        {selectedNode.type === 'ask_question' && (
          <>
            <TextArea
              label="Pergunta"
              value={config.message || ''}
              onChange={(value) => update('message', value)}
              placeholder="Qual horario prefere para conversarmos?"
            />
            <SelectInput
              label="Tipo de resposta"
              value={config.response_type || 'texto'}
              onChange={(value) => update('response_type', value)}
              options={[
                { value: 'texto', label: 'Texto livre' },
                { value: 'numero', label: 'Numero' },
                { value: 'opcao', label: 'Escolha unica' }
              ]}
            />
            <TextInput
              label="Tempo opcional (min)"
              value={config.timeout_minutes || ''}
              onChange={(value) => update('timeout_minutes', value)}
              placeholder="30"
            />
          </>
        )}

        {selectedNode.type === 'send_options' && (
          <>
            <TextArea
              label="Mensagem"
              value={config.message || ''}
              onChange={(value) => update('message', value)}
              placeholder="Escolha uma opcao abaixo"
            />
            <TextArea
              label="Opcoes (uma por linha)"
              value={config.options || ''}
              onChange={(value) => update('options', value)}
              placeholder={'Comercial\nFinanceiro\nSuporte'}
              rows={5}
            />
          </>
        )}

        {selectedNode.type === 'condition_contains_text' && (
          <>
            <TextInput
              label="Texto procurado"
              value={config.value || ''}
              onChange={(value) => update('value', value)}
              placeholder="Ex.: proposta"
            />
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Saida verdadeiro" value={config.true_label || 'Sim'} onChange={(value) => update('true_label', value)} />
              <TextInput label="Saida falso" value={config.false_label || 'Nao'} onChange={(value) => update('false_label', value)} />
            </div>
          </>
        )}

        {selectedNode.type === 'condition_equals_value' && (
          <>
            <TextInput
              label="Campo"
              value={config.field || ''}
              onChange={(value) => update('field', value)}
              placeholder="Ex.: resposta"
            />
            <TextInput
              label="Valor esperado"
              value={config.value || ''}
              onChange={(value) => update('value', value)}
              placeholder="sim"
            />
          </>
        )}

        {selectedNode.type === 'condition_business_hours' && (
          <>
            <TextInput
              label="Inicio"
              value={config.start_time || '08:00'}
              onChange={(value) => update('start_time', value)}
              placeholder="08:00"
            />
            <TextInput
              label="Fim"
              value={config.end_time || '18:00'}
              onChange={(value) => update('end_time', value)}
              placeholder="18:00"
            />
          </>
        )}

        {selectedNode.type === 'condition_contact_has_tag' && (
          <TextInput
            label="Tag"
            value={config.tag || ''}
            onChange={(value) => update('tag', value)}
            placeholder="vip"
          />
        )}

        {selectedNode.type === 'action_add_tag' && (
          <TextInput
            label="Tag a adicionar"
            value={config.tag || ''}
            onChange={(value) => update('tag', value)}
            placeholder="lead quente"
          />
        )}

        {selectedNode.type === 'action_create_task' && (
          <>
            <TextInput
              label="Titulo da tarefa"
              value={config.title || ''}
              onChange={(value) => update('title', value)}
              placeholder="Retornar contato"
            />
            <TextArea
              label="Descricao"
              value={config.description || ''}
              onChange={(value) => update('description', value)}
              placeholder="Detalhes internos para o time"
            />
            <SelectInput
              label="Prioridade"
              value={config.priority || 'medium'}
              onChange={(value) => update('priority', value)}
              options={[
                { value: 'high', label: 'Alta' },
                { value: 'medium', label: 'Media' },
                { value: 'low', label: 'Baixa' }
              ]}
            />
          </>
        )}

        {selectedNode.type === 'action_move_stage' && (
          <>
            <TextInput
              label="Pipeline"
              value={config.pipeline || ''}
              onChange={(value) => update('pipeline', value)}
              placeholder="Comercial"
            />
            <TextInput
              label="Novo estagio"
              value={config.stage || ''}
              onChange={(value) => update('stage', value)}
              placeholder="Qualificado"
            />
          </>
        )}

        {selectedNode.type === 'action_end_flow' && (
          <TextArea
            label="Motivo de encerramento"
            value={config.reason || ''}
            onChange={(value) => update('reason', value)}
            placeholder="Fluxo concluido com sucesso"
          />
        )}
      </div>
    </aside>
  );
}
