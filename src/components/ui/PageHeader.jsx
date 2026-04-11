// Componente Base: PageHeader
// Uso:
// <PageHeader
//   title="Pipeline Ativo"
//   subtitle="Gerenciando 24 negócios..."
//   actions={<Button icon="add">Novo</Button>}
// />

import React from 'react';

export const PageHeader = ({ title, subtitle, actions }) => {
  return (
    <div className="flex justify-between items-end mb-10">
      <div>
        <h2 className="text-3xl font-manrope font-extrabold text-on-surface tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-on-surface-variant font-inter mt-1 text-sm">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
};
