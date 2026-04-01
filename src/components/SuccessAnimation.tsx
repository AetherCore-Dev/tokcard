import React, { useEffect, useMemo, useState } from 'react';

interface SuccessAnimationProps {
  show: boolean;
  duration?: number;
  locale?: 'zh' | 'en';
}

export default function SuccessAnimation({ show, duration = 2200, locale = 'en' }: SuccessAnimationProps) {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (!show) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), duration);
    return () => window.clearTimeout(timer);
  }, [show, duration]);

  const particles = useMemo(
    () => Array.from({ length: 16 }, (_, index) => ({
      id: index,
      left: `${12 + (index % 4) * 24}%`,
      delay: `${index * 40}ms`,
      color: ['#0071e3', '#7c3aed', '#f59e0b', '#22c55e'][index % 4],
    })),
    []
  );

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="absolute top-1/2 h-3 w-3 rounded-full animate-success-burst"
          style={{
            left: particle.left,
            background: particle.color,
            animationDelay: particle.delay,
          }}
        />
      ))}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-white text-sm font-semibold drop-shadow-lg">
        {locale === 'zh' ? '导出完成' : 'Export complete'}
      </div>
    </div>
  );
}
