/**
 * Theme color utilities for consistent color usage across the application
 * Uses CSS custom properties from globals.css for proper theme support
 */

export interface StatusStyle {
  bg: string;
  border: string;
  text: string;
  dot: string;
  badge: string;
}

export interface PriorityStyle {
  bg: string;
  border: string;
  text: string;
  icon: string;
}

/**
 * Status color mapping using theme CSS custom properties
 * ออกแบบตามมาตรฐานราชการไทย - โทนสีสุภาพแต่ชัดเจน
 */
export const STATUS_STYLES: Record<string, StatusStyle> = {
  'รอดำเนินการ': {
    bg: 'bg-[var(--primary)]/8',
    border: 'border-[var(--primary)]/25',
    text: 'text-[var(--primary)]',
    dot: 'bg-[var(--primary)]',
    badge: 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/25',
  },
  'รอยื่นเอกสาร': {
    bg: 'bg-violet-50',                              /* Violet - แยกจากสถานะอื่น */
    border: 'border-violet-200',
    text: 'text-violet-700',
    dot: 'bg-violet-500',
    badge: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  'รอเอกสารอนุมัติ': {
    bg: 'bg-amber-50',                              /* Amber - ชัดเจน */
    border: 'border-amber-200',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  'เอกสารอนุมัติเรียบร้อย': {
    bg: 'bg-emerald-50',                            /* Emerald - ชัดเจน */
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  'ปฏิเสธคำร้อง': {
    bg: 'bg-rose-50',                               /* Rose - ชัดเจน */
    border: 'border-rose-200',
    text: 'text-rose-700',
    dot: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-700 border-rose-200',
  },
  'ด่วน': {
    bg: 'bg-orange-50',                            /* Orange - ชัดเจน */
    border: 'border-orange-200',
    text: 'text-orange-700',
    dot: 'bg-orange-500',
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  'ร่าง': {
    bg: 'bg-gray-50',                              /* Gray - ชัดเจน */
    border: 'border-gray-200',
    text: 'text-gray-700',
    dot: 'bg-gray-500',
    badge: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  'กำลังดำเนินการ': {
    bg: 'bg-[var(--primary)]/8',
    border: 'border-[var(--primary)]/25',
    text: 'text-[var(--primary)]',
    dot: 'bg-[var(--primary)]',
    badge: 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/25',
  },
  'รอการพิจารณา': {
    bg: 'bg-[var(--primary)]/6',
    border: 'border-[var(--primary)]/20',
    text: 'text-[var(--primary)]',
    dot: 'bg-[var(--primary)]',
    badge: 'bg-[var(--primary)]/8 text-[var(--primary)] border-[var(--primary)]/20',
  },
  'เสร็จสิ้น': {
    bg: 'bg-green-50',                              /* Green - ชัดเจน */
    border: 'border-green-200',
    text: 'text-green-700',
    dot: 'bg-green-500',
    badge: 'bg-green-100 text-green-700 border-green-200',
  },
};

/**
 * Priority color mapping using theme CSS custom properties
 * โทนสีที่สอดคล้องกับความสำคัญ - จากเบาไปหนัก
 */
export const PRIORITY_STYLES: Record<string, PriorityStyle> = {
  'low': {
    bg: 'bg-[var(--priority-low)]/12',           /* เทาอ่อนสบายตา */
    border: 'border-[var(--priority-low)]/50',
    text: 'text-[var(--priority-low)]',
    icon: 'text-[var(--priority-low)]',
  },
  'medium': {
    bg: 'bg-[var(--priority-medium)]/15',        /* เหลืองทองอ่อน */
    border: 'border-[var(--priority-medium)]/60',
    text: 'text-[var(--priority-medium)]',
    icon: 'text-[var(--priority-medium)]',
  },
  'high': {
    bg: 'bg-[var(--priority-high)]/18',          /* แดงราชการสุภาพ */
    border: 'border-[var(--priority-high)]/70',
    text: 'text-[var(--priority-high)]',
    icon: 'text-[var(--priority-high)]',
  },
  'critical': {
    bg: 'bg-[var(--priority-critical)]/20',      /* ม่วงแดงดุเดือด */
    border: 'border-[var(--priority-critical)]',
    text: 'text-[var(--priority-critical)]',
    icon: 'text-[var(--priority-critical)]',
  },
};

/**
 * Get status style by status key, with fallback to default
 */
export function getStatusStyle(status: string): StatusStyle {
  return STATUS_STYLES[status] || STATUS_STYLES['รอดำเนินการ'];
}

/**
 * Get all available status keys for dropdowns/selects
 */
export function getStatusKeys(): string[] {
  return Object.keys(STATUS_STYLES);
}

/**
 * Check if a status key exists in the theme
 */
export function isValidStatus(status: string): boolean {
  return status in STATUS_STYLES;
}

/**
 * Get status style with custom opacity for different use cases
 */
export function getStatusStyleWithOpacity(status: string, opacity: number = 15): StatusStyle {
  const baseStyle = getStatusStyle(status);

  // Extract base color from the class (e.g., 'bg-[var(--status-pending)]' -> 'var(--status-pending)')
  const bgMatch = baseStyle.bg.match(/bg-\[([^\/]+)\]/);
  const textMatch = baseStyle.text.match(/text-\[([^\/]+)\]/);
  const borderMatch = baseStyle.border.match(/border-\[([^\/]+)\]/);
  const dotMatch = baseStyle.dot.match(/bg-\[([^\/]+)\]/);

  if (!bgMatch) return baseStyle;

  const baseColor = bgMatch[1];

  return {
    ...baseStyle,
    bg: `bg-[${baseColor}]/${opacity}`,
    border: borderMatch ? `border-[${borderMatch[1]}]` : baseStyle.border,
    text: textMatch ? `text-[${textMatch[1]}]` : baseStyle.text,
    dot: dotMatch ? `bg-[${dotMatch[1]}]` : baseStyle.dot,
  };
}

/**
 * Get priority style by priority key, with fallback to default
 */
export function getPriorityStyle(priority: string): PriorityStyle {
  const normalizedPriority = priority.toLowerCase();
  return PRIORITY_STYLES[normalizedPriority] || PRIORITY_STYLES['medium'];
}

/**
 * Get all available priority keys
 */
export function getPriorityKeys(): string[] {
  return Object.keys(PRIORITY_STYLES);
}

/**
 * Check if a priority key exists in the theme
 */
export function isValidPriority(priority: string): boolean {
  return priority.toLowerCase() in PRIORITY_STYLES;
}

/**
 * Status variants for different UI contexts
 */
export const STATUS_VARIANTS = {
  light: (status: string) => getStatusStyleWithOpacity(status, 8),
  normal: (status: string) => getStatusStyleWithOpacity(status, 15),
  strong: (status: string) => getStatusStyleWithOpacity(status, 25),
  badge: (status: string) => getStatusStyle(status),
} as const;

/**
 * Priority variants for different UI contexts
 */
export const PRIORITY_VARIANTS = {
  subtle: (priority: string) => {
    const base = getPriorityStyle(priority);
    return {
      ...base,
      bg: base.bg.replace('/12', '/8').replace('/15', '/10').replace('/18', '/12').replace('/20', '/15'),
      border: base.border.replace('/50', '/30').replace('/60', '/40').replace('/70', '/50'),
    };
  },
  normal: (priority: string) => getPriorityStyle(priority),
  strong: (priority: string) => {
    const base = getPriorityStyle(priority);
    return {
      ...base,
      bg: base.bg.replace('/12', '/20').replace('/15', '/25').replace('/18', '/30').replace('/20', '/35'),
      border: base.border.replace('/50', '/80').replace('/60', '/90').replace('/70', '/100'),
    };
  },
} as const;

/**
 * Common theme color classes for reuse across components
 */
export const THEME_COLORS = {
  // Background colors
  background: 'bg-background',
  card: 'bg-card',
  muted: 'bg-muted',
  accent: 'bg-accent',

  // Text colors
  foreground: 'text-foreground',
  mutedForeground: 'text-muted-foreground',
  accentForeground: 'text-accent-foreground',

  // Primary colors
  primary: 'bg-primary',
  primaryHover: 'hover:bg-primary/90',
  primaryForeground: 'text-primary-foreground',

  // Secondary colors
  secondary: 'bg-secondary',
  secondaryHover: 'hover:bg-secondary/90',
  secondaryForeground: 'text-secondary-foreground',

  // Destructive colors
  destructive: 'bg-destructive',
  destructiveHover: 'hover:bg-destructive/10',
  destructiveForeground: 'text-destructive-foreground',

  // Status colors
  success: 'bg-success',
  successHover: 'hover:bg-success/90',
  successForeground: 'text-success-foreground',

  warning: 'bg-warning',
  warningHover: 'hover:bg-warning/90',
  warningForeground: 'text-warning-foreground',

  // Border colors
  border: 'border-border',
  ring: 'ring-ring',

  // Input colors
  input: 'bg-input',
  inputBorder: 'border-border',
} as const;
