import { supabase } from '@/lib/supabase';

async function invokeZapi(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('zapi-instance', {
    body: { action, ...payload }
  });

  if (error) {
    if (error.context && typeof error.context.json === 'function') {
      const body = await error.context.json().catch(() => null);
      if (body?.error) throw new Error(body.error);
    }
    throw error;
  }

  if (data?.error) throw new Error(data.error);
  return data;
}

export const getZapiStatus = () => invokeZapi('status');
export const getZapiQrCode = () => invokeZapi('qr');
export const getZapiPhoneCode = (phone) => invokeZapi('phone-code', { phone });
export const syncZapiWebhook = () => invokeZapi('sync-webhook');
export const disconnectZapi = () => invokeZapi('disconnect');
