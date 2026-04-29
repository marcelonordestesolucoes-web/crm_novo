import React from 'react';
import { Card, Button, Modal, LoadingSpinner } from '@/components/ui';
import {
  Calendar,
  ChevronLeft,
  Cpu,
  Link2,
  Mail,
  MessageCircle,
  Power,
  QrCode,
  RefreshCcw,
  Shield,
  Smartphone,
  Zap
} from 'lucide-react';
import { AIAnalyticsView } from '@/components/settings/AIAnalyticsView';
import {
  disconnectZapi,
  getZapiPhoneCode,
  getZapiQrCode,
  getZapiStatus,
  syncZapiWebhook
} from '@/services/zapi';

const IntegrationCard = ({ icon: Icon, title, description, badge, color, status = 'disponivel', onConfigure }) => (
  <Card className="p-8 bg-white border-slate-100 hover:shadow-2xl hover:scale-[1.02] transition-all group overflow-hidden relative">
    <div className={`absolute top-0 right-10 w-24 h-24 rounded-full opacity-5 blur-2xl ${color}`} />

    <div className="flex justify-between items-start mb-6">
      <div className={`w-14 h-14 rounded-2xl ${color} bg-opacity-10 flex items-center justify-center text-current`}>
        <Icon className="w-7 h-7" />
      </div>
      <span className="text-[9px] font-black px-3 py-1 bg-slate-100 text-slate-500 rounded-full uppercase tracking-widest">
        {status}
      </span>
    </div>

    <h4 className="text-lg font-manrope font-black text-on-surface mb-2 tracking-tight">{title}</h4>
    <p className="text-xs text-slate-400 font-medium leading-relaxed mb-8">{description}</p>

    <div className="flex items-center justify-between pt-6 border-t border-slate-50">
      <div className="flex gap-2">
        {badge && <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-lg">{badge}</span>}
      </div>
      <Button
        onClick={onConfigure}
        variant="outline"
        size="sm"
        className="h-9 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest group-hover:bg-primary group-hover:text-white transition-all"
      >
        Configurar
      </Button>
    </div>
  </Card>
);

function statusLabel(status) {
  if (!status) return 'Verificando';
  if (status.connected) return 'Conectado';
  return 'Aguardando conexao';
}

function WhatsAppConnectionModal({ isOpen, onClose }) {
  const [status, setStatus] = React.useState(null);
  const [qrCode, setQrCode] = React.useState(null);
  const [phone, setPhone] = React.useState('');
  const [pairingCode, setPairingCode] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState('');

  const loadStatus = React.useCallback(async () => {
    try {
      setError('');
      const data = await getZapiStatus();
      setStatus(data);
      if (data.connected) setQrCode(null);
    } catch (err) {
      setError(err.message || 'Falha ao verificar a instancia.');
    }
  }, []);

  React.useEffect(() => {
    if (!isOpen) return undefined;
    loadStatus();
    const timer = window.setInterval(loadStatus, 15000);
    return () => window.clearInterval(timer);
  }, [isOpen, loadStatus]);

  const handleQr = async () => {
    try {
      setLoading(true);
      setError('');
      setPairingCode(null);
      const data = await getZapiQrCode();
      if (data.connected) {
        await loadStatus();
        return;
      }
      setQrCode(data.qrCode);
    } catch (err) {
      setError(err.message || 'Falha ao gerar QR Code.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneCode = async () => {
    try {
      setLoading(true);
      setError('');
      setQrCode(null);
      const data = await getZapiPhoneCode(phone);
      setPairingCode(data.code);
    } catch (err) {
      setError(err.message || 'Falha ao gerar codigo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncWebhook = async () => {
    try {
      setSyncing(true);
      setError('');
      await syncZapiWebhook();
      await loadStatus();
    } catch (err) {
      setError(err.message || 'Falha ao sincronizar webhook.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      setError('');
      await disconnectZapi();
      setQrCode(null);
      setPairingCode(null);
      await loadStatus();
    } catch (err) {
      setError(err.message || 'Falha ao desconectar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="WhatsApp Business" className="max-w-4xl">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),320px]">
        <div className="space-y-5">
          <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/50 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">Status da conexao</p>
                <h3 className="mt-2 text-2xl font-black text-slate-950">{statusLabel(status)}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {status?.phone ? `Numero conectado: ${status.phone}` : status?.message || 'Use o QR Code ou codigo por telefone para conectar a instancia.'}
                </p>
              </div>
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${status?.connected ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400'}`}>
                <Smartphone className="h-7 w-7" />
              </div>
            </div>
          </div>

          {status?.connected && (
            <div className="grid gap-3 rounded-[1.5rem] border border-slate-100 bg-white p-5 md:grid-cols-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Perfil conectado</p>
                <p className="mt-2 text-lg font-black text-slate-900">{status.name || 'WhatsApp'}</p>
                <p className="text-sm font-semibold text-slate-500">{status.isBusiness ? 'Conta Business' : 'Conta WhatsApp'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Dispositivo</p>
                <p className="mt-2 text-lg font-black text-slate-900">{status.device?.device_model || status.device?.sessionName || 'Z-API'}</p>
                <p className="text-sm font-semibold text-slate-500">{status.smartphoneConnected ? 'Celular online' : 'Celular offline'}</p>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={handleQr}
              disabled={loading || status?.connected}
              className="flex min-h-[120px] flex-col items-start justify-between rounded-[1.5rem] border border-slate-100 bg-white p-5 text-left shadow-sm transition-all hover:border-emerald-200 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              <QrCode className="h-7 w-7 text-emerald-500" />
              <div>
                <h4 className="font-black text-slate-950">Conectar por QR Code</h4>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">Escaneie pelo WhatsApp no celular. Gere novamente se o codigo expirar.</p>
              </div>
              <span className="mt-4 rounded-xl bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white">
                Gerar QR
              </span>
            </button>

            <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
              <Link2 className="h-7 w-7 text-primary" />
              <h4 className="mt-5 font-black text-slate-950">Conectar por codigo</h4>
              <div className="mt-3 flex gap-2">
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="5581999999999"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-primary"
                />
                <Button onClick={handlePhoneCode} disabled={loading || status?.connected} className="h-10 rounded-xl px-4 text-xs">
                  Gerar
                </Button>
              </div>
              {pairingCode && (
                <div className="mt-3 rounded-xl bg-primary/5 px-4 py-3 text-center text-xl font-black tracking-[0.2em] text-primary">
                  {pairingCode}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex min-h-[320px] items-center justify-center rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
            {loading ? (
              <LoadingSpinner />
            ) : qrCode ? (
              <img src={qrCode} alt="QR Code WhatsApp" className="h-64 w-64 rounded-xl object-contain" />
            ) : (
              <div className="text-center">
                <QrCode className="mx-auto h-14 w-14 text-slate-200" />
                <p className="mt-4 text-sm font-bold text-slate-400">QR Code aparecera aqui</p>
                <button
                  type="button"
                  onClick={handleQr}
                  disabled={status?.connected}
                  className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-2 text-xs font-black uppercase tracking-widest text-emerald-600 disabled:opacity-50"
                >
                  Gerar QR Code
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {error}
            </div>
          )}

          <div className="grid gap-2">
            <Button onClick={handleSyncWebhook} disabled={syncing} className="h-11 rounded-xl">
              <RefreshCcw className="mr-2 h-4 w-4" />
              {syncing ? 'Sincronizando...' : 'Sincronizar Webhook'}
            </Button>
            <Button onClick={handleDisconnect} disabled={loading} variant="outline" className="h-11 rounded-xl text-rose-600 hover:border-rose-200 hover:bg-rose-50">
              <Power className="mr-2 h-4 w-4" />
              Desconectar instancia
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export const IntegrationsTab = () => {
  const [activeView, setActiveView] = React.useState('grid');
  const [whatsappOpen, setWhatsappOpen] = React.useState(false);

  if (activeView === 'ia-analytics') {
    return (
      <div className="space-y-8">
        <button
          onClick={() => setActiveView('grid')}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar para Integracoes
        </button>
        <AIAnalyticsView />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <div className="max-w-2xl px-2">
        <h3 className="text-2xl font-manrope font-black text-on-surface tracking-tighter mb-4">Central de Conexoes</h3>
        <p className="text-sm text-slate-400 font-medium leading-relaxed">
          Conecte o Stitch CRM as suas ferramentas favoritas para automatizar tarefas e centralizar toda a comunicacao da equipe em um so lugar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        <IntegrationCard
          icon={MessageCircle}
          title="WhatsApp Business"
          description="Sincronize mensagens, alertas de pipeline e faca disparos automaticos de propostas diretamente para seus leads."
          color="text-emerald-500 bg-emerald-500"
          badge="Oficial Meta"
          onConfigure={() => setWhatsappOpen(true)}
        />

        <IntegrationCard
          icon={Mail}
          title="Google & Outlook"
          description="Envie e receba e-mails diretamente do CRM. Rastreie aberturas, cliques e agende sequencias de follow-up."
          color="text-primary bg-primary"
          badge="OAuth 2.0"
        />

        <IntegrationCard
          icon={Calendar}
          title="Calendario"
          description="Sincronizacao bidirecional de reunioes e tarefas. Evite conflitos de agenda e agende reunioes via link."
          color="text-amber-500 bg-amber-500"
          badge="iCal / Google"
        />

        <IntegrationCard
          icon={Zap}
          title="Webhooks & API"
          description="Conecte qualquer ferramenta externa via Webhooks ou utilize nossa API robusta para automacoes avancadas."
          color="text-violet-500 bg-violet-500"
          badge="Enterprise"
        />

        <IntegrationCard
          icon={Shield}
          title="Seguranca & Backup"
          description="Logs de auditoria, backups automaticos diarios em S3 e criptografia de ponta a ponta dos seus dados."
          color="text-slate-500 bg-slate-500"
          status="ativo"
        />

        <IntegrationCard
          icon={Cpu}
          title="IA Preditiva"
          description="Analise automatica de leads e sugestao de proximas acoes baseada no historico de conversao da equipe."
          color="text-sky-500 bg-sky-500"
          badge="Enterprise"
          status="ativo"
          onConfigure={() => setActiveView('ia-analytics')}
        />
      </div>

      <WhatsAppConnectionModal isOpen={whatsappOpen} onClose={() => setWhatsappOpen(false)} />
    </div>
  );
};
