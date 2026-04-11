// Centralized Mock Data for Stitch CRM (Localized BR)

export const mockDeals = [
  { 
    id: 1, 
    title: 'Expansão de Infraestrutura', 
    company: 'Aether Dynamics', 
    value: 1250000, 
    stage: 'discovery', 
    status: 'new', 
    ownerAvatar: 'https://i.pravatar.cc/150?u=alex',
    tags: ['Nova Oportunidade']
  },
  { 
    id: 2, 
    title: 'Cloud de Pesquisa IA', 
    company: 'Neural Systems', 
    value: 5200000, 
    stage: 'negotiation', 
    status: 'hot', 
    ownerAvatar: 'https://i.pravatar.cc/150?u=sarah',
    tags: ['Estratégico']
  },
  { 
    id: 3, 
    title: 'Suite de Cibersegurança', 
    company: 'Vanguard Defense', 
    value: 2100000, 
    stage: 'proposal', 
    status: 'hot', 
    ownerAvatar: 'https://i.pravatar.cc/150?u=michael',
    tags: ['Urgente']
  },
  { 
    id: 4, 
    title: 'Logística Global SaaS', 
    company: 'SwiftPort Int.', 
    value: 840000, 
    stage: 'discovery', 
    status: 'at-risk', 
    ownerAvatar: 'https://i.pravatar.cc/150?u=alex',
    tags: ['Risco de Churn']
  },
  { 
    id: 5, 
    title: 'Modernização ERP', 
    company: 'Ironworks Global', 
    value: 1600000, 
    stage: 'negotiation', 
    status: 'new', 
    ownerAvatar: 'https://i.pravatar.cc/150?u=clara',
    tags: ['Discovery']
  },
  { 
    id: 6, 
    title: 'Auditoria Core Fintech', 
    company: 'Capital Trust', 
    value: 450000, 
    stage: 'discovery', 
    status: 'new', 
    ownerAvatar: 'https://i.pravatar.cc/150?u=alex',
    tags: ['Lead Frio']
  }
];

export const mockCompanies = [
  {
    id: 1,
    name: 'Logística Global S.A.',
    stage: 'Cliente Ativo',
    sector: 'Transporte & Logística',
    taxId: '12.345.678/0001-90',
    score: 88,
    responsible: 'Alex Estevão',
    responsibleAvatar: 'https://i.pravatar.cc/150?u=alex',
    logo: 'https://ui-avatars.com/api/?name=LG&background=003ec7&color=fff'
  },
  {
    id: 2,
    name: 'Sistemas Neurais Ltda',
    stage: 'Negociação',
    sector: 'Tecnologia & IA',
    taxId: '98.765.432/0001-10',
    score: 94,
    responsible: 'Sarah Mendes',
    responsibleAvatar: 'https://i.pravatar.cc/150?u=sarah',
    logo: 'https://ui-avatars.com/api/?name=SN&background=620bd3&color=fff'
  },
  {
    id: 3,
    name: 'Defesa Vanguarda',
    stage: 'Contrato Assinado',
    sector: 'Segurança Digital',
    taxId: '45.678.912/0001-34',
    score: 75,
    responsible: 'Ricardo Lima',
    responsibleAvatar: 'https://i.pravatar.cc/150?u=ricardo',
    logo: 'https://ui-avatars.com/api/?name=DV&background=ba1a1a&color=fff'
  }
];

export const mockContacts = [
  {
    id: 1,
    name: 'Juliana DeMarco',
    avatar: 'https://i.pravatar.cc/150?u=juliana',
    role: 'VP de Vendas',
    company: 'Aurora Tech',
    email: 'juliana.demarco@aurora.com.br',
    phone: '(11) 98765-4321',
    owner: 'Alex Estevão',
    ownerAvatar: 'https://i.pravatar.cc/150?u=alex'
  },
  {
    id: 2,
    name: 'Marcos Thorne',
    avatar: 'https://i.pravatar.cc/150?u=marcos',
    role: 'CTO',
    company: 'NexaGrid',
    email: 'm.thorne@nexagrid.com',
    phone: '(21) 99887-7665',
    owner: 'Alex Estevão',
    ownerAvatar: 'https://i.pravatar.cc/150?u=alex'
  },
  {
    id: 3,
    name: 'Clara Silveira',
    avatar: 'https://i.pravatar.cc/150?u=clara',
    role: 'Diretora de Operações',
    company: 'GlobalLog',
    email: 'clara@globallog.com.br',
    phone: '(31) 91234-5678',
    owner: 'Sarah Mendes',
    ownerAvatar: 'https://i.pravatar.cc/150?u=sarah'
  }
];

export const mockTasks = [
  {
    id: 1,
    title: 'Preparar documentação de compliance',
    status: 'pending',
    priority: 'high',
    dueDate: '12 Out, 2023 • 14:00',
    assignedToAvatars: ['https://i.pravatar.cc/150?u=alex', 'https://i.pravatar.cc/150?u=sarah']
  },
  {
    id: 2,
    title: 'Reunião de alinhamento com CTO',
    status: 'completed',
    priority: 'medium',
    dueDate: '10 Out, 2023 • 10:00',
    assignedToAvatars: ['https://i.pravatar.cc/150?u=marcos']
  },
  {
    id: 3,
    title: 'Revisão de contrato jurídico',
    status: 'overdue',
    priority: 'high',
    dueDate: '08 Out, 2023 • 17:00',
    assignedToAvatars: ['https://i.pravatar.cc/150?u=alex']
  }
];
