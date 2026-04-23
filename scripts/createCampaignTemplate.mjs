import ExcelJS from 'exceljs';
import { mkdir } from 'node:fs/promises';

const outputDir = 'public/templates';
const outputPath = `${outputDir}/campanha-whatsapp-modelo.xlsx`;

const headers = [
  'nome',
  'telefone',
  'empresa',
  'email',
  'cidade',
  'observacao',
  'tag',
  'origem',
  'opt_in',
  'ultima_interacao'
];

const examples = [
  [
    'Maria Exemplo',
    '+5581999999999',
    'Empresa Exemplo',
    'maria@exemplo.com',
    'Recife',
    'Lead pediu proposta',
    'reativacao',
    'planilha',
    'sim',
    '2026-04-20'
  ],
  [
    'Joao Exemplo',
    '+5581888888888',
    'Cliente Modelo',
    'joao@exemplo.com',
    'Olinda',
    'Contato autorizou WhatsApp',
    'pos-venda',
    'planilha',
    'sim',
    '2026-04-18'
  ]
];

const workbook = new ExcelJS.Workbook();
workbook.creator = 'Decision Center CRM';
workbook.created = new Date();

const sheet = workbook.addWorksheet('Contatos Campanha', {
  views: [{ state: 'frozen', ySplit: 1 }]
});

sheet.addRow(headers);
examples.forEach((row) => sheet.addRow(row));

sheet.columns = [
  { width: 28 },
  { width: 20 },
  { width: 28 },
  { width: 30 },
  { width: 18 },
  { width: 36 },
  { width: 18 },
  { width: 18 },
  { width: 12 },
  { width: 18 }
];

const headerRow = sheet.getRow(1);
headerRow.height = 24;
headerRow.eachCell((cell) => {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0346D8' } };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  cell.border = {
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };
});

sheet.eachRow((row, rowNumber) => {
  if (rowNumber === 1) return;
  row.height = 22;
  row.eachCell((cell) => {
    cell.alignment = { vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } }
    };
  });
});

sheet.getColumn(2).numFmt = '@';
sheet.getColumn(10).numFmt = 'yyyy-mm-dd';

const instructions = workbook.addWorksheet('Instrucoes');
instructions.columns = [{ width: 26 }, { width: 90 }];
instructions.addRows([
  ['Campo', 'Como preencher'],
  ['nome', 'Nome do contato. Obrigatorio.'],
  ['telefone', 'Telefone com DDI e DDD. Exemplo: +5581999999999. Obrigatorio.'],
  ['empresa', 'Empresa associada ao contato, se houver.'],
  ['email', 'Email opcional.'],
  ['cidade', 'Cidade opcional para personalizacao da mensagem.'],
  ['observacao', 'Contexto interno. Nao sera enviado automaticamente.'],
  ['tag', 'Etiqueta opcional para segmentacao.'],
  ['origem', 'Fonte do contato. Exemplo: planilha, evento, campanha antiga.'],
  ['opt_in', 'Use sim para contatos autorizados. O modo seguro bloqueia contatos sem opt-in.'],
  ['ultima_interacao', 'Data no formato AAAA-MM-DD, quando souber.']
]);

instructions.getRow(1).eachCell((cell) => {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
});

await mkdir(outputDir, { recursive: true });
await workbook.xlsx.writeFile(outputPath);
console.log(outputPath);
