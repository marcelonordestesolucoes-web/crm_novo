// src/services/campaigns.js
// Campaign CRUD, import persistence, queue preparation and worker controls.
// WhatsApp dispatch is executed only by the campaign-worker Edge Function.

import { supabase } from '@/lib/supabase';
import { getUserPermissions } from './auth';

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
const DEFAULT_COUNTRY_CODE = '55';

const CAMPAIGN_SELECT = `
  *,
  contacts:campaign_contacts(id, is_valid, is_duplicate, is_eligible, block_reason),
  queue:campaign_dispatch_queue(id, status),
  imports:campaign_imports(id, filename, total_rows, valid_rows, invalid_rows, duplicate_rows, created_at)
`;

export const CAMPAIGN_STATUSES = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

export const QUEUE_STATUSES = {
  PENDING: 'pending',
  SCHEDULED: 'scheduled',
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  BLOCKED_BY_RULE: 'blocked_by_rule',
  CANCELLED: 'cancelled'
};

export function normalizePhoneToE164(value, defaultCountryCode = DEFAULT_COUNTRY_CODE) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const hasPlus = raw.startsWith('+');
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  if (!hasPlus && defaultCountryCode === '55' && (digits.length === 10 || digits.length === 11)) {
    digits = `${defaultCountryCode}${digits}`;
  } else if (!hasPlus && defaultCountryCode && !digits.startsWith(defaultCountryCode) && digits.length <= 11) {
    digits = `${defaultCountryCode}${digits}`;
  }

  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

export function phoneParts(normalizedPhone) {
  const digits = String(normalizedPhone || '').replace(/\D/g, '');
  if (!digits) return { phone_country_code: null, phone_national: null };

  if (digits.startsWith('55') && digits.length > 2) {
    return {
      phone_country_code: '55',
      phone_national: digits.slice(2)
    };
  }

  return {
    phone_country_code: null,
    phone_national: digits
  };
}

export function validateCampaignContact(contact) {
  const normalizedPhone = normalizePhoneToE164(
    contact.normalized_phone || contact.phone || contact.imported_phone || contact.contact_phone
  );
  const errors = [];

  if (!normalizedPhone) errors.push('invalid_phone');

  const optIn = contact.opt_in === true || contact.opt_in === 'true' || contact.opt_in === 'sim' || contact.opt_in === 'yes';
  if (contact.require_opt_in && !optIn) errors.push('missing_opt_in');

  return {
    normalizedPhone,
    isValid: errors.length === 0,
    errors,
    blockReason: errors[0] || null
  };
}

function applyTemplateVariables(template, contact) {
  const name = contact.imported_name || contact.name || contact.contact_name || '';
  const firstName = name.trim().split(/\s+/)[0] || '';
  const company = contact.company_name || contact.company || '';
  const city = contact.city || '';

  return String(template || '')
    .replace(/\{nome\}/gi, name || 'Cliente')
    .replace(/\{primeiro_nome\}/gi, firstName || name || 'Cliente')
    .replace(/\{empresa\}/gi, company)
    .replace(/\{cidade\}/gi, city);
}

function normalizeMessageVariants(campaign) {
  const variants = Array.isArray(campaign.message_variants)
    ? campaign.message_variants
    : [];

  const cleanVariants = variants
    .map((variant) => String(variant || '').trim())
    .filter(Boolean);

  if (cleanVariants.length) return cleanVariants;
  return [campaign.message_template || ''];
}

function uniqueByNormalizedPhone(contacts) {
  const seen = new Set();
  const unique = [];
  const duplicates = [];

  contacts.forEach((contact, index) => {
    const normalizedPhone = normalizePhoneToE164(
      contact.normalized_phone || contact.phone || contact.imported_phone || contact.contact_phone
    );

    if (!normalizedPhone) {
      unique.push({ ...contact, normalized_phone: null, row_number: contact.row_number ?? index + 1 });
      return;
    }

    if (seen.has(normalizedPhone)) {
      duplicates.push({ ...contact, normalized_phone: normalizedPhone, row_number: contact.row_number ?? index + 1 });
      return;
    }

    seen.add(normalizedPhone);
    unique.push({ ...contact, normalized_phone: normalizedPhone, row_number: contact.row_number ?? index + 1 });
  });

  return { unique, duplicates };
}

async function logCampaignEvent(campaignId, event, message, payload = {}, level = 'info') {
  try {
    const { orgId, userId } = await getUserPermissions();
    if (!orgId || !campaignId) return null;

    const { data, error } = await supabase
      .from('campaign_logs')
      .insert({
        org_id: orgId,
        campaign_id: campaignId,
        level,
        event,
        message,
        payload,
        created_by: userId
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.warn('[Campaigns] Failed to write campaign log:', error);
    return null;
  }
}

export async function createCampaignDraft(data) {
  const { orgId, userId } = await getUserPermissions();
  if (!orgId) throw new Error('Usuario sem organizacao ativa.');
  if (!data?.name?.trim()) throw new Error('Nome da campanha e obrigatorio.');
  if (!data?.message_template?.trim()) throw new Error('Template da mensagem e obrigatorio.');

  const minDelay = Number(data.min_delay_seconds ?? data.min_delay ?? 30);
  const maxDelay = Number(data.max_delay_seconds ?? data.max_delay ?? 90);
  if (minDelay < 1 || maxDelay < minDelay) {
    throw new Error('Intervalo de envio invalido.');
  }

  const payload = {
    org_id: orgId,
    name: data.name.trim(),
    description: data.description || null,
    status: CAMPAIGN_STATUSES.DRAFT,
    source_type: data.source_type || 'crm',
    whatsapp_instance_id: data.whatsapp_instance_id || null,
    message_template: data.message_template,
    message_variants: data.message_variants || [],
    schedule_at: data.schedule_at || null,
    start_time: data.start_time || null,
    end_time: data.end_time || null,
    timezone: data.timezone || DEFAULT_TIMEZONE,
    min_delay_seconds: minDelay,
    max_delay_seconds: maxDelay,
    min_delay: minDelay,
    max_delay: maxDelay,
    per_minute_limit: Number(data.per_minute_limit ?? 5),
    per_hour_limit: Number(data.per_hour_limit ?? 60),
    campaign_limit: data.campaign_limit ?? null,
    cooldown_hours: Number(data.cooldown_hours ?? 72),
    safe_mode_enabled: data.safe_mode_enabled ?? true,
    require_opt_in: data.require_opt_in ?? true,
    block_recent_interactions: data.block_recent_interactions ?? true,
    recent_interaction_hours: Number(data.recent_interaction_hours ?? 24),
    auto_pause_after_count: data.auto_pause_after_count ?? null,
    resume_mode: data.resume_mode || 'manual',
    safety_policy: data.safety_policy || {},
    created_by: userId
  };

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert(payload)
    .select(CAMPAIGN_SELECT)
    .single();

  if (error) throw error;

  await logCampaignEvent(campaign.id, 'campaign.created', 'Campanha criada em rascunho.', {
    source_type: campaign.source_type
  });

  return campaign;
}

export async function getCampaigns() {
  const { orgId } = await getUserPermissions();
  if (!orgId) return [];

  const { data, error } = await supabase
    .from('campaigns')
    .select(CAMPAIGN_SELECT)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(enrichCampaignStats);
}

export async function getCampaignById(id) {
  const { orgId } = await getUserPermissions();
  if (!orgId) return null;

  const { data, error } = await supabase
    .from('campaigns')
    .select(`
      ${CAMPAIGN_SELECT},
      campaign_contacts(*),
      campaign_dispatch_queue(*),
      campaign_logs(*)
    `)
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? enrichCampaignStats(data) : null;
}

export async function updateCampaignDraft(id, data) {
  const { orgId } = await getUserPermissions();
  if (!orgId) throw new Error('Usuario sem organizacao ativa.');
  if (!id) throw new Error('campaignId e obrigatorio.');
  if (!data?.name?.trim()) throw new Error('Nome da campanha e obrigatorio.');
  if (!data?.message_template?.trim()) throw new Error('Template da mensagem e obrigatorio.');

  const { data: existing, error: existingError } = await supabase
    .from('campaigns')
    .select('id, status')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing) throw new Error('Campanha nao encontrada.');
  if (!['draft', 'paused', 'scheduled', 'failed', 'cancelled'].includes(existing.status)) {
    throw new Error('Campanhas em execucao ou finalizadas nao podem ser editadas.');
  }

  const minDelay = Number(data.min_delay_seconds ?? data.min_delay ?? 30);
  const maxDelay = Number(data.max_delay_seconds ?? data.max_delay ?? 90);
  if (minDelay < 1 || maxDelay < minDelay) {
    throw new Error('Intervalo de envio invalido.');
  }

  const payload = {
    name: data.name.trim(),
    description: data.description || null,
    source_type: data.source_type || 'crm',
    whatsapp_instance_id: data.whatsapp_instance_id || null,
    message_template: data.message_template,
    message_variants: data.message_variants || [],
    schedule_at: data.schedule_at || null,
    start_time: data.start_time || null,
    end_time: data.end_time || null,
    timezone: data.timezone || DEFAULT_TIMEZONE,
    min_delay_seconds: minDelay,
    max_delay_seconds: maxDelay,
    min_delay: minDelay,
    max_delay: maxDelay,
    per_minute_limit: Number(data.per_minute_limit ?? 5),
    per_hour_limit: Number(data.per_hour_limit ?? 60),
    campaign_limit: data.campaign_limit ?? null,
    cooldown_hours: Number(data.cooldown_hours ?? 72),
    safe_mode_enabled: data.safe_mode_enabled ?? true,
    require_opt_in: data.require_opt_in ?? true,
    block_recent_interactions: data.block_recent_interactions ?? true,
    recent_interaction_hours: Number(data.recent_interaction_hours ?? 24),
    auto_pause_after_count: data.auto_pause_after_count ?? null,
    resume_mode: data.resume_mode || 'manual',
    safety_policy: data.safety_policy || {},
    updated_at: new Date().toISOString()
  };

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .update(payload)
    .eq('org_id', orgId)
    .eq('id', id)
    .select(CAMPAIGN_SELECT)
    .single();

  if (error) throw error;

  await logCampaignEvent(id, 'campaign.updated', 'Campanha atualizada.', {
    status: existing.status
  });

  return campaign;
}

export async function deleteCampaign(id) {
  const { orgId } = await getUserPermissions();
  if (!orgId) throw new Error('Usuario sem organizacao ativa.');
  if (!id) throw new Error('campaignId e obrigatorio.');

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('id, name, status')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (campaignError) throw campaignError;
  if (!campaign) throw new Error('Campanha nao encontrada.');
  if (campaign.status === 'running') {
    throw new Error('Pause a campanha antes de excluir.');
  }

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('org_id', orgId)
    .eq('id', id);

  if (error) throw error;
  return true;
}

export async function cancelCampaign(id) {
  const { orgId } = await getUserPermissions();
  if (!orgId) throw new Error('Usuario sem organizacao ativa.');
  if (!id) throw new Error('campaignId e obrigatorio.');

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('id, name, status')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (campaignError) throw campaignError;
  if (!campaign) throw new Error('Campanha nao encontrada.');
  if (['completed', 'cancelled'].includes(campaign.status)) return campaign;

  const now = new Date().toISOString();

  const { error: queueError } = await supabase
    .from('campaign_dispatch_queue')
    .update({
      status: QUEUE_STATUSES.CANCELLED,
      cancelled_at: now,
      locked_at: null,
      locked_by: null,
      updated_at: now
    })
    .eq('org_id', orgId)
    .eq('campaign_id', id)
    .in('status', [
      QUEUE_STATUSES.PENDING,
      QUEUE_STATUSES.SCHEDULED,
      QUEUE_STATUSES.SENDING
    ]);

  if (queueError) throw queueError;

  const { data: updated, error } = await supabase
    .from('campaigns')
    .update({
      status: CAMPAIGN_STATUSES.CANCELLED,
      paused_at: now,
      pause_reason: 'Cancelada manualmente.',
      next_dispatch_at: null,
      worker_lock_until: null,
      worker_lock_by: null,
      updated_at: now
    })
    .eq('org_id', orgId)
    .eq('id', id)
    .select(CAMPAIGN_SELECT)
    .single();

  if (error) throw error;

  await logCampaignEvent(id, 'campaign.cancelled', 'Campanha cancelada manualmente.', {
    previous_status: campaign.status
  }, 'warning');

  return updated;
}

export async function createCampaignImport(importData) {
  const { orgId, userId } = await getUserPermissions();
  if (!orgId) throw new Error('Usuario sem organizacao ativa.');
  if (!importData?.filename) throw new Error('Nome do arquivo e obrigatorio.');

  const payload = {
    org_id: orgId,
    campaign_id: importData.campaign_id || null,
    filename: importData.filename,
    file_type: importData.file_type || null,
    file_size_bytes: importData.file_size_bytes || null,
    source_type: importData.source_type || 'excel',
    total_rows: Number(importData.total_rows || 0),
    valid_rows: Number(importData.valid_rows || 0),
    invalid_rows: Number(importData.invalid_rows || 0),
    duplicate_rows: Number(importData.duplicate_rows || 0),
    imported_rows: Number(importData.imported_rows || 0),
    mapping: importData.mapping || {},
    error_report: importData.error_report || [],
    status: importData.status || 'processed',
    processed_at: importData.processed_at || new Date().toISOString(),
    created_by: userId
  };

  const { data, error } = await supabase
    .from('campaign_imports')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  if (payload.campaign_id) {
    await logCampaignEvent(payload.campaign_id, 'campaign.import.created', 'Importacao de contatos processada.', {
      filename: payload.filename,
      total_rows: payload.total_rows,
      valid_rows: payload.valid_rows,
      invalid_rows: payload.invalid_rows,
      duplicate_rows: payload.duplicate_rows
    });
  }

  return data;
}

export async function createCampaignContacts(campaignId, contacts) {
  const { orgId } = await getUserPermissions();
  if (!orgId) throw new Error('Usuario sem organizacao ativa.');
  if (!campaignId) throw new Error('campaignId e obrigatorio.');
  if (!Array.isArray(contacts)) throw new Error('contacts deve ser uma lista.');

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('id, org_id, require_opt_in')
    .eq('org_id', orgId)
    .eq('id', campaignId)
    .maybeSingle();

  if (campaignError) throw campaignError;
  if (!campaign) throw new Error('Campanha nao encontrada.');

  const { unique, duplicates } = uniqueByNormalizedPhone(contacts);
  const rows = unique.map((contact) => {
    const validation = validateCampaignContact({
      ...contact,
      require_opt_in: campaign.require_opt_in
    });
    const normalizedPhone = validation.normalizedPhone;
    const parts = phoneParts(normalizedPhone);
    const isDuplicate = Boolean(contact.is_duplicate);
    const isEligible = validation.isValid && !isDuplicate && !contact.is_blacklisted && !contact.is_recently_contacted;

    return {
      org_id: orgId,
      campaign_id: campaignId,
      import_id: contact.import_id || null,
      contact_id: contact.contact_id || contact.id || null,
      deal_id: contact.deal_id || null,
      source: contact.source || (contact.contact_id || contact.id ? 'crm' : 'excel'),
      row_number: contact.row_number || null,
      imported_name: contact.imported_name || contact.name || contact.contact_name || null,
      imported_phone: contact.imported_phone || contact.phone || contact.contact_phone || null,
      normalized_phone: normalizedPhone,
      phone_country_code: parts.phone_country_code,
      phone_national: parts.phone_national,
      whatsapp_jid: contact.whatsapp_jid || null,
      company_name: contact.company_name || contact.company || null,
      email: contact.email || null,
      city: contact.city || null,
      notes: contact.notes || contact.observation || contact.observacao || null,
      tag: contact.tag || null,
      origin: contact.origin || contact.origem || null,
      opt_in: contact.opt_in === true || contact.opt_in === 'true' || contact.opt_in === 'sim' || contact.opt_in === 'yes',
      opt_in_source: contact.opt_in_source || null,
      last_interaction_at: contact.last_interaction_at || null,
      is_valid: validation.isValid,
      is_duplicate: isDuplicate,
      is_blacklisted: Boolean(contact.is_blacklisted),
      is_recently_contacted: Boolean(contact.is_recently_contacted),
      is_eligible: isEligible,
      block_reason: !isEligible
        ? (validation.blockReason || (isDuplicate ? 'duplicate_phone' : contact.block_reason || null))
        : null,
      validation_errors: validation.errors,
      metadata: contact.metadata || {}
    };
  });

  if (!rows.length) {
    return { inserted: [], duplicates, totals: await refreshCampaignTotals(campaignId) };
  }

  const { data: existingContacts, error: existingError } = await supabase
    .from('campaign_contacts')
    .select('contact_id, normalized_phone')
    .eq('org_id', orgId)
    .eq('campaign_id', campaignId);

  if (existingError) throw existingError;

  const existingContactIds = new Set((existingContacts || []).map((item) => item.contact_id).filter(Boolean));
  const existingPhones = new Set((existingContacts || []).map((item) => item.normalized_phone).filter(Boolean));
  const insertRows = rows.filter((row) => {
    if (row.contact_id && existingContactIds.has(row.contact_id)) return false;
    if (row.normalized_phone && existingPhones.has(row.normalized_phone)) return false;
    return true;
  });

  if (!insertRows.length) {
    return { inserted: [], duplicates, totals: await refreshCampaignTotals(campaignId) };
  }

  const { data: inserted, error } = await supabase
    .from('campaign_contacts')
    .insert(insertRows)
    .select();

  if (error) throw error;

  await createCampaignContactIdentities(campaignId, inserted || []);
  const totals = await refreshCampaignTotals(campaignId);

  await logCampaignEvent(campaignId, 'campaign.contacts.created', 'Contatos preparados para a campanha.', {
    received: contacts.length,
    inserted: inserted?.length || 0,
    duplicates: duplicates.length,
    eligible: totals.total_eligible
  });

  return { inserted: inserted || [], duplicates, totals };
}

async function createCampaignContactIdentities(campaignId, contacts) {
  const { orgId } = await getUserPermissions();
  const identityRows = [];

  contacts.forEach((contact) => {
    if (contact.normalized_phone) {
      identityRows.push({
        org_id: orgId,
        campaign_id: campaignId,
        campaign_contact_id: contact.id,
        identity_type: 'phone',
        identity_value: contact.imported_phone || contact.normalized_phone,
        normalized_value: contact.normalized_phone
      });
    }

    if (contact.whatsapp_jid) {
      identityRows.push({
        org_id: orgId,
        campaign_id: campaignId,
        campaign_contact_id: contact.id,
        identity_type: 'whatsapp_jid',
        identity_value: contact.whatsapp_jid,
        normalized_value: contact.whatsapp_jid
      });
    }

    if (contact.email) {
      identityRows.push({
        org_id: orgId,
        campaign_id: campaignId,
        campaign_contact_id: contact.id,
        identity_type: 'email',
        identity_value: contact.email,
        normalized_value: String(contact.email).trim().toLowerCase()
      });
    }

    if (contact.contact_id) {
      identityRows.push({
        org_id: orgId,
        campaign_id: campaignId,
        campaign_contact_id: contact.id,
        identity_type: 'crm_contact_id',
        identity_value: contact.contact_id,
        normalized_value: contact.contact_id
      });
    }
  });

  if (!identityRows.length) return [];

  const { data, error } = await supabase
    .from('campaign_contact_identity')
    .upsert(identityRows, {
      onConflict: 'campaign_id,identity_type,normalized_value',
      ignoreDuplicates: false
    })
    .select();

  if (error) throw error;
  return data || [];
}

export async function buildDispatchQueue(campaignId) {
  const { orgId } = await getUserPermissions();
  if (!orgId) throw new Error('Usuario sem organizacao ativa.');
  if (!campaignId) throw new Error('campaignId e obrigatorio.');

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', campaignId)
    .maybeSingle();

  if (campaignError) throw campaignError;
  if (!campaign) throw new Error('Campanha nao encontrada.');

  const { data: contacts, error: contactsError } = await supabase
    .from('campaign_contacts')
    .select('*')
    .eq('org_id', orgId)
    .eq('campaign_id', campaignId)
    .eq('is_eligible', true)
    .eq('is_valid', true)
    .not('normalized_phone', 'is', null)
    .order('created_at', { ascending: true });

  if (contactsError) throw contactsError;
  if (!contacts?.length) {
    await refreshCampaignTotals(campaignId);
    return { inserted: [], skipped: 0 };
  }

  const { data: existingQueue, error: existingError } = await supabase
    .from('campaign_dispatch_queue')
    .select('campaign_contact_id, normalized_phone')
    .eq('org_id', orgId)
    .eq('campaign_id', campaignId);

  if (existingError) throw existingError;

  const existingContactIds = new Set((existingQueue || []).map((item) => item.campaign_contact_id));
  const existingPhones = new Set((existingQueue || []).map((item) => item.normalized_phone));
  const variants = normalizeMessageVariants(campaign);

  const queueRows = contacts
    .filter((contact) => !existingContactIds.has(contact.id) && !existingPhones.has(contact.normalized_phone))
    .map((contact, index) => {
      const variantIndex = index % variants.length;
      const template = variants[variantIndex] || campaign.message_template;

      return {
        org_id: orgId,
        campaign_id: campaignId,
        campaign_contact_id: contact.id,
        contact_id: contact.contact_id || null,
        deal_id: contact.deal_id || null,
        phone: contact.normalized_phone,
        normalized_phone: contact.normalized_phone,
        whatsapp_jid: contact.whatsapp_jid || null,
        final_message: applyTemplateVariables(template, contact),
        variant_used: variantIndex,
        template_variables: {
          nome: contact.imported_name || '',
          primeiro_nome: String(contact.imported_name || '').trim().split(/\s+/)[0] || '',
          empresa: contact.company_name || '',
          cidade: contact.city || ''
        },
        status: QUEUE_STATUSES.PENDING,
        scheduled_for: campaign.schedule_at || null,
        retry_count: 0,
        max_retries: 0
      };
    });

  if (!queueRows.length) {
    return { inserted: [], skipped: contacts.length };
  }

  const { data: inserted, error } = await supabase
    .from('campaign_dispatch_queue')
    .upsert(queueRows, {
      onConflict: 'campaign_id,campaign_contact_id',
      ignoreDuplicates: true
    })
    .select();

  if (error) throw error;

  await logCampaignEvent(campaignId, 'campaign.queue.prepared', 'Fila preparada em modo rascunho.', {
    inserted: inserted?.length || 0,
    skipped: contacts.length - (inserted?.length || 0)
  });

  return { inserted: inserted || [], skipped: contacts.length - (inserted?.length || 0) };
}

async function invokeCampaignWorker(action, campaignId) {
  if (!campaignId) throw new Error('campaignId e obrigatorio.');

  const { data, error } = await supabase.functions.invoke('campaign-worker', {
    body: {
      action,
      campaign_id: campaignId
    }
  });

  if (error) {
    if (error.context && typeof error.context.json === 'function') {
      const payload = await error.context.json().catch(() => null);
      if (payload?.error) throw new Error(payload.error);
    }
    throw error;
  }

  if (data?.error) throw new Error(data.error);
  return data;
}

export async function startCampaignWorker(campaignId) {
  return invokeCampaignWorker('start', campaignId);
}

export async function resumeCampaignWorker(campaignId) {
  return invokeCampaignWorker('resume', campaignId);
}

export async function pauseCampaignWorker(campaignId) {
  return invokeCampaignWorker('pause', campaignId);
}

export async function processCampaignQueue(campaignId) {
  return invokeCampaignWorker('process', campaignId);
}

async function refreshCampaignTotals(campaignId) {
  const { orgId } = await getUserPermissions();

  const { data: contacts, error } = await supabase
    .from('campaign_contacts')
    .select('is_eligible, is_valid, is_duplicate, block_reason')
    .eq('org_id', orgId)
    .eq('campaign_id', campaignId);

  if (error) throw error;

  const total_contacts = contacts?.length || 0;
  const total_eligible = (contacts || []).filter((contact) => contact.is_eligible).length;
  const total_blocked_by_rule = (contacts || []).filter((contact) => contact.block_reason).length;
  const total_skipped = (contacts || []).filter((contact) => !contact.is_valid || contact.is_duplicate).length;

  const totals = {
    total_contacts,
    total_eligible,
    total_blocked_by_rule,
    total_skipped
  };

  const { error: updateError } = await supabase
    .from('campaigns')
    .update(totals)
    .eq('org_id', orgId)
    .eq('id', campaignId);

  if (updateError) throw updateError;
  return totals;
}

function enrichCampaignStats(campaign) {
  const contacts = campaign.contacts || campaign.campaign_contacts || [];
  const queue = campaign.queue || campaign.campaign_dispatch_queue || [];
  const sent = queue.filter((item) => ['sent', 'delivered'].includes(item.status)).length;
  const failed = queue.filter((item) => item.status === 'failed').length;
  const delivered = queue.filter((item) => item.status === 'delivered').length;
  const pending = queue.filter((item) => item.status === 'pending').length;

  return {
    ...campaign,
    computed: {
      total_contacts: campaign.total_contacts ?? contacts.length,
      total_eligible: campaign.total_eligible ?? contacts.filter((item) => item.is_eligible).length,
      total_queue: queue.length,
      pending,
      sent,
      delivered,
      failed,
      success_rate: sent + failed > 0 ? Math.round((sent / (sent + failed)) * 100) : 0
    }
  };
}

// Backward-compatible wrapper for the current UI while CampaignWizard is refactored.
export async function createCampaign(campaignData, contacts = []) {
  const campaign = await createCampaignDraft({
    ...campaignData,
    min_delay_seconds: campaignData.min_delay_seconds ?? campaignData.min_delay,
    max_delay_seconds: campaignData.max_delay_seconds ?? campaignData.max_delay
  });

  if (contacts.length > 0) {
    const contactIds = contacts.filter((contact) => typeof contact === 'string');
    const objectContacts = contacts.filter((contact) => typeof contact !== 'string');
    let crmContacts = [];

    if (contactIds.length > 0) {
      const { orgId } = await getUserPermissions();
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, phone, email, company, city, role, is_blocked')
        .eq('org_id', orgId)
        .in('id', contactIds);

      if (error) throw error;
      crmContacts = (data || []).map((contact) => ({
        contact_id: contact.id,
        imported_name: contact.name,
        imported_phone: contact.phone,
        email: contact.email,
        company_name: contact.company,
        city: contact.city,
        source: 'crm',
        opt_in: true,
        is_blacklisted: Boolean(contact.is_blocked)
      }));
    }

    const normalizedContacts = [...crmContacts, ...objectContacts];

    await createCampaignContacts(campaign.id, normalizedContacts);
    await buildDispatchQueue(campaign.id);
  }

  return getCampaignById(campaign.id);
}

export async function processCampaignStep() {
  throw new Error('Disparo direto pelo navegador esta desativado. Use o campaign-worker.');
}
