import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-[#0EA5E9] hover:bg-sky-600 text-white shadow-sm disabled:opacity-60',
  secondary: 'bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white disabled:opacity-60',
  outline:
    'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-[#0EA5E9] disabled:opacity-50',
  ghost: 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm disabled:opacity-60',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 min-h-[34px] text-xs rounded-xl gap-1.5',
  md: 'px-4 py-2 min-h-[40px] text-xs sm:text-sm rounded-xl gap-2',
  lg: 'px-5 py-2.5 min-h-[44px] text-sm rounded-xl gap-2',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-semibold transition-colors whitespace-nowrap ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {loading ? 'Memproses...' : children}
    </button>
  );
}

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'outline' | 'ghost' | 'danger';
}

export function IconButton({
  label,
  variant = 'outline',
  className = '',
  children,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const styles =
    variant === 'danger'
      ? 'border border-rose-200 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
      : variant === 'ghost'
      ? 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
      : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-[#0EA5E9]';
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl transition-colors ${styles} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
