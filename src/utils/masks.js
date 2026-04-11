/**
 * Formata CNPJ ou CPF
 * 000.000.000-00 ou 00.000.000/0000-00
 */
export const formatCpfCnpj = (value) => {
  if (!value) return '';
  const digits = value.replace(/\D/g, ''); // Remove all non-digits
  
  if (digits.length <= 11) {
    // CPF
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .slice(0, 14); // Max length for CPF formatting
  } else {
    // CNPJ
    return digits
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})/, '$1-$2')
      .slice(0, 18); // Max length for CNPJ formatting
  }
};

/**
 * Formata Telefone Celular ou Fixo
 * (00) 0000-0000 ou (00) 90000-0000
 */
export const formatPhone = (value) => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  
  if (digits.length <= 10) {
    // Fixo
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 14);
  } else {
    // Celular
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .slice(0, 15);
  }
};
