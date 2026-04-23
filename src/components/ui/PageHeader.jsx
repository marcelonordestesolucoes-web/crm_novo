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
    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-5 mb-10">
      <div>
        <h2 className="text-4xl font-manrope font-black text-slate-950 tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-slate-700 font-inter mt-2 text-base font-semibold leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
};
