'use client'

import { useCallback, useState } from 'react'

export type ServerFileCategory = 'idcopy' | 'operation'

export interface UseServerFileBrowserReturn {
  open: boolean
  category: ServerFileCategory
  setOpen: (open: boolean) => void
  openFor: (category: ServerFileCategory) => void
  close: () => void
}

export function useServerFileBrowser(initialCategory: ServerFileCategory = 'idcopy'): UseServerFileBrowserReturn {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<ServerFileCategory>(initialCategory)

  const openFor = useCallback((next: ServerFileCategory) => {
    setCategory(next)
    setOpen(true)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  return { open, category, setOpen, openFor, close }
}
