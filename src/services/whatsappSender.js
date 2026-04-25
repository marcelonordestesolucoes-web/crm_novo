// src/services/whatsappSender.js
import { supabase } from '@/lib/supabase';

async function throwFunctionError(error) {
  if (!error) return;

  if (error.context && typeof error.context.json === 'function') {
    const payload = await error.context.json().catch(() => null);
    if (payload?.error) throw new Error(payload.error);
  }

  throw error;
}

export async function sendWhatsAppMessage(phone, message, messageId = null) {
  const { data, error } = await supabase.functions.invoke('send-whatsapp', {
    body: { phone, message, messageId, type: 'text' }
  });

  if (error) await throwFunctionError(error);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function sendWhatsAppMedia(phone, mediaUrl, type, caption = '') {
  const { data, error } = await supabase.functions.invoke('send-whatsapp', {
    body: { phone, mediaUrl, type, caption }
  });

  if (error) await throwFunctionError(error);
  if (data?.error) throw new Error(data.error);
  return data;
}
