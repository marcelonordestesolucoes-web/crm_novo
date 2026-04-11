import { Card } from '@/components/ui';

// RiskCard: widget de alerta inteligente para o Dashboard.
// Props: type, title, description, items[], icon, iconColor, accentColor

export const RiskCard = ({ type, title, description, items, icon, iconColor, accentColor }) => (
  <Card variant="glass" className="p-8 relative overflow-hidden group">
    {/* Background Icon */}
    <span
      className={`material-symbols-outlined absolute top-4 right-4 ${iconColor} opacity-10 text-7xl rotate-12 group-hover:rotate-0 group-hover:opacity-20 transition-all duration-500`}
      style={{ fontVariationSettings: "'FILL' 1" }}
    >
      {icon}
    </span>

    {/* Type Badge */}
    <div className="flex items-center gap-2 mb-4">
      <div className={`w-2 h-2 ${accentColor} rounded-full animate-pulse`} />
      <span className={`${iconColor} font-extrabold text-[10px] uppercase tracking-[0.2em]`}>{type}</span>
    </div>

    <h3 className="text-xl font-extrabold font-manrope mb-2 text-on-surface tracking-tight">{title}</h3>
    <p className="text-on-surface-variant text-sm mb-6 leading-relaxed max-w-[90%] opacity-80">{description}</p>

    {/* Items */}
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between p-3.5 bg-white/40 backdrop-blur-sm rounded-2xl hover:bg-white/60 transition-colors cursor-pointer border border-white/20 hover:border-white/40 shadow-sm"
        >
          <span className="text-sm font-bold text-on-surface">{item.name}</span>
          <span className={`text-xs font-extrabold ${item.isNegative ? 'text-error' : 'text-primary'}`}>
            {item.value}
          </span>
        </div>
      ))}
    </div>

    {/* CTA */}
    <button className="mt-6 text-primary font-bold text-sm flex items-center gap-1.5 hover:gap-2.5 transition-all duration-300">
      Ação Mitigadora
      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
    </button>
  </Card>
);

