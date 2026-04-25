'use client'

import React from 'react'
import { FileText, Image as ImageIcon, Video, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MediaPlaceholderProps {
  type: 'image' | 'video' | 'document' | 'error'
  className?: string
  size?: 'sm' | 'md' | 'lg'
  message?: string
}

export const MediaPlaceholder: React.FC<MediaPlaceholderProps> = ({
  type,
  className,
  size = 'md',
  message
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16'
  }

  const iconSize = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  }

  const getIcon = () => {
    switch (type) {
      case 'image':
        return <ImageIcon className={iconSize[size]} />
      case 'video':
        return <Video className={iconSize[size]} />
      case 'document':
        return <FileText className={iconSize[size]} />
      case 'error':
        return <AlertCircle className={iconSize[size]} />
      default:
        return <FileText className={iconSize[size]} />
    }
  }

  const getDefaultMessage = () => {
    switch (type) {
      case 'image':
        return 'ไม่สามารถโหลดรูปภาพได้'
      case 'video':
        return 'ไม่สามารถโหลดวิดีโอได้'
      case 'document':
        return 'ไม่สามารถโหลดเอกสารได้'
      case 'error':
        return 'เกิดข้อผิดพลาด'
      default:
        return 'ไม่สามารถโหลดไฟล์ได้'
    }
  }

  const displayMessage = message || getDefaultMessage()

  return (
    <div className={cn(
      "flex flex-col items-center justify-center space-y-2 p-4 bg-[var(--muted)] rounded-lg",
      className
    )}>
      <div className={cn(
        "flex items-center justify-center rounded-full bg-[var(--muted-foreground)]/10",
        sizeClasses[size]
      )}>
        {getIcon()}
      </div>
      <p className="text-xs text-[var(--muted-foreground)] text-center">
        {displayMessage}
      </p>
    </div>
  )
}
