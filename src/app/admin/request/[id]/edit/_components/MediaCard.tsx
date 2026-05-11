'use client'

import React from 'react'
import Image from 'next/image'
import { CheckCircle2, Download, Trash2, XCircle } from 'lucide-react'
import { MediaPlaceholder } from '@/components/media-placeholder'
import { humanSize, downloadFile } from '@/lib/upload-utils'
import { isVideoMedia } from '../_utils'
import type { Media } from '../_types'

interface MediaCardProps {
  media: Media
  index: number
  onOpenFullscreen: (m: Media) => void
  onDelete: (id: string) => void
  onTogglePublish: (id: string, next: boolean) => void
}

export function MediaCard({ media: m, index, onOpenFullscreen, onDelete, onTogglePublish }: MediaCardProps) {
  const isVideo = isVideoMedia(m.file_type, m.file_name)
  const isPublished = m.published === 'true' || m.approval_status === 'พร้อมใช้งาน'

  return (
    <div
      className="group relative bg-white rounded-lg sm:rounded-xl overflow-hidden shadow-sm sm:shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.01] border border-slate-200"
      style={{ animation: `fadeInUp 0.6s ease-out ${index * 100}ms forwards` }}
    >
      <div className="cursor-pointer relative overflow-hidden" onClick={() => onOpenFullscreen(m)}>
        {isVideo ? (
          <div className="relative bg-slate-900 rounded-t-lg sm:rounded-t-xl overflow-hidden h-32 sm:h-36 lg:h-40">
            <video
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              preload="metadata"
              controls
              playsInline
              muted
              poster=""
              controlsList="nodownload noplaybackrate"
              onLoadedMetadata={(e) => {
                const video = e.target as HTMLVideoElement
                video.muted = true
              }}
              onError={(e) => {
                console.error('Gallery video load error:', e)
                const video = e.target as HTMLVideoElement
                video.style.display = 'none'
                const container = video.parentElement
                if (container) {
                  const fallback = container.querySelector('.video-fallback')
                  if (fallback) (fallback as HTMLElement).style.display = 'flex'
                }
              }}
            >
              <source src={m.url} type={m.file_type || 'video/mp4'} />
            </video>
            <div className="video-fallback absolute inset-0" style={{ display: 'none' }}>
              <MediaPlaceholder type="video" className="h-full rounded-t-lg sm:rounded-t-xl" message="ไม่สามารถโหลดวิดีโอได้" />
            </div>

            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/30 via-transparent to-black/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 pointer-events-none">
              <div className="bg-[var(--primary)]/80 hover:bg-[var(--primary)] text-white rounded-full p-2 sm:p-3 shadow-lg transform scale-75 group-hover:scale-90 sm:group-hover:scale-100 transition-all duration-300 backdrop-blur-sm pointer-events-auto">
                <svg className="h-5 w-5 sm:h-6 sm:w-6 ml-0.5 sm:ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>

            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 md:top-4 md:left-4 bg-gradient-to-r from-red-500 to-pink-500 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white/80 rounded-full animate-pulse"></div>
                วิดีโอ
              </div>
            </div>
          </div>
        ) : (
          <div className="relative bg-slate-100 rounded-t-lg sm:rounded-t-xl overflow-hidden h-32 sm:h-36 lg:h-40">
            <Image
              src={m.url}
              alt={m.file_name}
              width={400}
              height={160}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              loading="lazy"
              unoptimized
            />

            <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
              <div className="bg-white/90 backdrop-blur-sm rounded-full p-1.5 sm:p-2 md:p-2.5 shadow-lg transform scale-75 group-hover:scale-90 sm:group-hover:scale-100 transition-all duration-300 pointer-events-auto">
                <svg className="h-4 w-4 sm:h-4.5 sm:w-4.5 md:h-5 md:w-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </div>
            </div>

            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 md:top-4 md:left-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <svg className="h-2.5 w-2.5 sm:h-3 sm:w-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 7v10h16V7H4zm8 2l5 4H7l5-4z" />
                </svg>
                รูปภาพ
              </div>
            </div>
          </div>
        )}

        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4">
          {isPublished ? (
            <div className="bg-[var(--success)] text-white rounded-full p-1 sm:p-1.5 md:p-2 shadow-lg">
              <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
            </div>
          ) : (
            <div className="bg-slate-500 text-white rounded-full p-1 sm:p-1.5 md:p-2 shadow-lg">
              <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
            </div>
          )}
        </div>
      </div>

      <div className="p-3 sm:p-4 md:p-5 bg-gradient-to-br from-white to-slate-50">
        <div className="flex items-start justify-between gap-2 sm:gap-3 md:gap-4 mb-2 sm:mb-3 md:mb-3.5">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-[var(--foreground)] text-xs sm:text-sm truncate mb-1 sm:mb-1.5">
              {m.file_name}
            </h4>
            <div className="flex items-center gap-1 sm:gap-2 md:gap-2.5 text-xs sm:text-xs md:text-sm text-[var(--muted-foreground)]">
              <span>{m.file_size ? humanSize(m.file_size) : 'ไม่ระบุ'}</span>
              {isVideo && (
                <>
                  <span>•</span>
                  <span className="text-[var(--warning)]">วิดีโอ</span>
                </>
              )}
            </div>
          </div>

          <div className="relative">
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
            >
              <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex justify-center">
          {isPublished ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onTogglePublish(m.id, false)
              }}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)] hover:bg-[var(--success)]/20 transition-colors text-xs font-medium"
            >
              <CheckCircle2 className="h-3 w-3 sm:h-3.5 md:h-4 sm:w-3.5 md:w-4" />
              <span className="hidden sm:inline">พร้อมใช้งาน</span>
              <span className="sm:hidden">พร้อม</span>
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onTogglePublish(m.id, true)
              }}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg bg-slate-100 border border-slate-300 text-slate-600 hover:bg-slate-200 transition-colors text-xs font-medium"
            >
              <XCircle className="h-3 w-3 sm:h-3.5 md:h-4 sm:w-3.5 md:w-4" />
              <span className="hidden sm:inline">ไม่พร้อมใช้งาน</span>
              <span className="sm:hidden">ไม่พร้อม</span>
            </button>
          )}
        </div>
      </div>

      <div className="absolute top-2 right-10 sm:top-3 sm:right-12 flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300">
        <button
          onClick={(e) => {
            e.stopPropagation()
            downloadFile(m.url, m.file_name)
          }}
          className="bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white rounded-full p-1.5 sm:p-2 shadow-lg hover:scale-110 transition-transform"
          title="ดาวน์โหลด"
          aria-label="ดาวน์โหลดไฟล์"
        >
          <Download className="h-3 w-3 sm:h-4 sm:w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(m.id)
          }}
          className="bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 sm:p-2 shadow-lg hover:scale-110 transition-transform"
          title="ลบไฟล์"
          aria-label="ลบไฟล์"
        >
          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
        </button>
      </div>
    </div>
  )
}
