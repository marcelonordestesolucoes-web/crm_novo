// src/services/whatsappSender.js

// CONFIGURAÇÕES Z-API (ELITE)
const INSTANCE_ID = '3F1C97713DB441CDA799AAE399BC1248';
const INSTANCE_TOKEN = 'A9CC72CBA1D787189E111426';

// ⚠️ ATENÇÃO: Se o envio falhar com erro "client-token is not configured", 
// coloque o seu Client-Token abaixo ou desative a exigência no painel da Z-API.
const CLIENT_TOKEN = 'Fa88c3fc2b8394d7fac7c4b4042408ed5S'; 

const ZAPI_URL = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/send-text`;

/**
 * [ELITE SENDER] Envia uma mensagem real via Z-API.
 * @param {string} phone - Telefone do destinatário (ex: 5581999999999)
 * @param {string} message - Conteúdo textual da mensagem
 */
export async function sendWhatsAppMessage(phone, message) {
  try {
    const headers = {
      "Content-Type": "application/json"
    };

    // Só adiciona o Client-Token se ele estiver preenchido
    if (CLIENT_TOKEN) {
      headers["Client-Token"] = CLIENT_TOKEN;
    }

    const response = await fetch(ZAPI_URL, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        phone: phone,
        message: message
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || data.error || 'Erro na Z-API');
    }

    console.log("📤 Mensagem disparada com sucesso:", data);
    return data;
  } catch (error) {
    console.error("❌ Falha crítica no disparo WhatsApp:", error.message);
    throw error;
  }
}

/**
 * [ELITE MEDIA SENDER] Envia mídias (Imagem, Áudio, Vídeo) via Z-API.
 * @param {string} phone - JID do destinatário.
 * @param {string} mediaUrl - URL pública do arquivo (Supabase Storage).
 * @param {string} type - 'image' | 'audio' | 'video' | 'document'.
 * @param {string} caption - Legenda opcional (apenas p/ imagem e vídeo).
 */
export async function sendWhatsAppMedia(phone, mediaUrl, type, caption = "") {
  try {
    const headers = { 
        "Content-Type": "application/json",
        "Client-Token": CLIENT_TOKEN 
    };

    // Mapeamento de endpoints por tipo
    const endpointMap = {
      image: 'send-image',
      audio: 'send-audio',
      video: 'send-video',
      document: 'send-document'
    };

    const endpoint = endpointMap[type] || 'send-document';
    const url = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/${endpoint}`;

    // Montagem do payload variável
    const payload = { phone };
    if (type === 'image') {
        payload.image = mediaUrl;
        payload.caption = caption;
    } else if (type === 'audio') {
        payload.audio = mediaUrl;
    } else if (type === 'video') {
        payload.video = mediaUrl;
        payload.caption = caption;
    } else {
        payload.document = mediaUrl;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Erro no envio de mídia');

    return data;
  } catch (error) {
    console.error(`❌ Falha no envio de ${type}:`, error.message);
    throw error;
  }
}
