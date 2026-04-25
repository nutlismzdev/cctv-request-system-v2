// components/ui/switch.tsx
'use client'

import * as React from 'react'
import * as RadixSwitch from '@radix-ui/react-switch'
import { cn } from '@/lib/utils' // ถ้าไม่มี helper นี้ เปลี่ยนเป็น className ปกติได้

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof RadixSwitch.Root> {
  /** ใช้แทน onCheckedChange ของ Radix (สะดวกเวลาใช้เหมือน shadcn) */
  onCheckedChange?: (checked: boolean) => void
}

export const Switch = React.forwardRef<
  React.ElementRef<typeof RadixSwitch.Root>,
  SwitchProps
>(({ className, checked, defaultChecked, disabled, onCheckedChange, ...props }, ref) => {
  return (
    <RadixSwitch.Root
      ref={ref}
      checked={checked}
      defaultChecked={defaultChecked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors',
        'border-transparent bg-gray-300',
        'data-[state=checked]:bg-[var(--primary)] data-[state=unchecked]:bg-gray-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--primary)]/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      <RadixSwitch.Thumb
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-white shadow transition-transform',
          'translate-x-1 data-[state=checked]:translate-x-5'
        )}
      />
    </RadixSwitch.Root>
  )
})
Switch.displayName = 'Switch'
