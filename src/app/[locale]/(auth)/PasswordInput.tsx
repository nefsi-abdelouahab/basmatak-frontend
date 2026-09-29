'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input, type InputProps } from '@/components/ui/Input';

// Password field with a show/hide toggle. Reuses the design-system Input;
// the toggle sits inside the input box (end side, logical) without shifting
// layout. `id`, `label`, `error` and friends pass straight through.
export function PasswordInput({ id, className = '', ...rest }: InputProps) {
  const t = useTranslations('auth');
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        className={`pe-11 ${className}`}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('shared.hidePassword') : t('shared.showPassword')}
        aria-pressed={visible}
        className="absolute bottom-2 end-2 flex h-6 w-6 items-center justify-center rounded-md text-ink-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        {visible ? (
          <EyeOff aria-hidden="true" size={18} />
        ) : (
          <Eye aria-hidden="true" size={18} />
        )}
      </button>
    </div>
  );
}
