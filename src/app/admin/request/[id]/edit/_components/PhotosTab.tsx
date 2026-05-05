'use client'

import React from 'react'
import Image from 'next/image'
import { TabsContent } from '@/components/ui/tabs'
import { CheckCircle2, Download, Image as ImageIcon, Upload } from 'lucide-react'
import { SectionCard } from './_shared'
import { UploadProgressBar } from './UploadProgressBar'
import { MediaCard } from './MediaCard'
import { downloadFile } from '@/lib/upload-utils'
import { isVideoMedia } from '../_utils'
import type { Media } from '../_types'
import type { UploadProgress } from '@/lib/use-upload'

interface PhotosTabProps {
  cctvMedia: Media[]
  cctvUpload: {
    upload: (files: FileList) => void
    progress: UploadProgress
    cancel: () => void
  }
  deleteCctvMedia: (mediaId: string) => void
  toggleCctvPublish: (mediaId: string, next: boolean) => void
  setFullscreenMedia: React.Dispatch<React.SetStateAction<Media | null>>
}

export function PhotosTab({
  cctvMedia,
  cctvUpload,
  deleteCctvMedia,
  toggleCctvPublish,
  setFullscreenMedia,
}: PhotosTabProps) {
  return (
    <TabsContent value="photos" className="space-y-4">
      <SectionCard
        title="อัปโหลดสื่อจาก CCTV (รูปภาพ/วิดีโอ)"
        icon={<ImageIcon className="h-4 w-4" />}
        right={
          <label className="inline-flex">
            <input
              type="file"
              multiple
              accept="image/*,video/*,.heic"
              className="hidden"
              onChange={(e) => {
                cctvUpload.upload(e.target.files!)
                e.target.value = ''
              }}
            />
            <span className="inline-flex items-center px-3 py-2 rounded-md border bg-white hover:bg-slate-50 cursor-pointer">
              <Upload className="h-4 w-4 mr-2" /> อัปโหลดไฟล์
            </span>
          </label>
        }
      >
        <label className="mt-1 block w-full cursor-pointer group">
          <input
            type="file"
            multiple
            accept="image/*,video/*,.heic"
            className="hidden"
            onChange={(e) => {
              cctvUpload.upload(e.target.files!)
              e.target.value = ''
            }}
          />

          <div className="relative p-8 border-2 border-dashed border-slate-300 group-hover:border-[var(--primary)] rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 group-hover:from-[var(--primary)]/5 group-hover:to-blue-50/50 transition-all duration-300">
            <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity">
              <svg className="w-full h-full" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="upload-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                    <circle cx="10" cy="10" r="1" fill="currentColor" className="text-slate-400" />
                  </pattern>
                </defs>
                <rect width="100" height="100" fill="url(#upload-pattern)" />
              </svg>
            </div>

            <div className="relative z-10 text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-[var(--primary)] to-blue-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-800 group-hover:text-[var(--primary)] transition-colors">
                  อัปโหลดไฟล์ CCTV
                </h3>
                <p className="text-slate-600 group-hover:text-slate-700 transition-colors">
                  ลากไฟล์ (รูปภาพ/วิดีโอ) มาวางที่นี่ หรือ{' '}
                  <span className="font-semibold text-[var(--primary)] group-hover:underline">
                    คลิกเพื่อเลือกไฟล์
                  </span>
                </p>
              </div>

              <div className="mt-6 flex justify-center gap-6 text-sm">
                <div className="flex items-center gap-2 px-3 py-1 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full border border-[var(--primary)]/20">
                  <div className="w-2 h-2 bg-[var(--primary)] rounded-full"></div>
                  <span className="font-medium">รูปภาพ</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-700 rounded-full border border-red-200">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="font-medium">วิดีโอ</span>
                </div>
              </div>

              <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full text-xs font-medium text-slate-600 shadow-md">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  รองรับไฟล์ขนาดสูงสุด 500MB ต่อไฟล์
                </div>
              </div>
            </div>
          </div>
        </label>

        <UploadProgressBar progress={cctvUpload.progress} onCancel={cctvUpload.cancel} />

        <div className="mt-8">
          {cctvMedia.length === 0 ? (
            <div className="text-center text-slate-500 py-20 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border-2 border-dashed border-slate-300">
              <div className="max-w-md mx-auto">
                <div className="relative mb-6">
                  <div className="w-20 h-20 bg-[var(--primary)]/10 rounded-2xl mx-auto flex items-center justify-center">
                    <ImageIcon className="h-10 w-10 text-[var(--primary)]" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-[var(--accent)] rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">+</span>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">เริ่มต้นอัปโหลดไฟล์ CCTV</h3>
                <p className="text-slate-600 mb-6">อัปโหลดรูปภาพหรือวิดีโอเผยแพร่ให้ผู้ยื่นคำขอสำเนาภาพ</p>
                <div className="flex justify-center gap-4 text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-[var(--success)] rounded-full"></div>
                    รองรับรูปภาพ
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-[var(--warning)] rounded-full"></div>
                    รองรับวิดีโอ
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg md:text-xl font-bold text-[var(--foreground)]">Gallery สื่อ CCTV</h3>
                  <p className="text-xs sm:text-sm md:text-sm text-[var(--muted-foreground)] mt-1">
                    {cctvMedia.length} ไฟล์ • {cctvMedia.filter(m => m.published === 'true' || m.approval_status === 'พร้อมใช้งาน').length} ไฟล์พร้อมใช้งาน
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm self-start sm:self-auto">
                  <div className="flex items-center gap-1.5 px-2 sm:px-3 md:px-4 py-1 bg-[var(--success)]/10 text-[var(--success)] rounded-full">
                    <CheckCircle2 className="h-3 w-3 sm:h-3.5 md:h-4 sm:w-3.5 md:w-4" />
                    <span className="font-medium">
                      {cctvMedia.filter(m => m.published === 'true' || m.approval_status === 'พร้อมใช้งาน').length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
                {cctvMedia.map((m, index) => (
                  <MediaCard
                    key={m.id}
                    media={m}
                    index={index}
                    onOpenFullscreen={setFullscreenMedia}
                    onDelete={deleteCctvMedia}
                    onTogglePublish={toggleCctvPublish}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </SectionCard>
    </TabsContent>
  )
}

interface FullscreenMediaModalProps {
  media: Media | null
  onClose: () => void
}

export function FullscreenMediaModal({ media, onClose }: FullscreenMediaModalProps) {
  if (!media) return null

  const isVideo = isVideoMedia(media.file_type, media.file_name)

  return (
    <div className="fixed inset-0 bg-black z-50 animate-fadeIn">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          onClick={() => downloadFile(media.url, media.file_name)}
          className="bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-all duration-200 hover:scale-110"
          aria-label="ดาวน์โหลด"
          title="ดาวน์โหลด"
        >
          <Download className="h-6 w-6" />
        </button>
        <button
          onClick={onClose}
          className="bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-all duration-200 hover:scale-110"
          aria-label="ปิด"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="w-full h-full flex items-center justify-center p-4">
        {isVideo ? (
          <video
            key={media.id}
            className="max-w-full max-h-full object-contain"
            controls
            playsInline
            preload="metadata"
            disablePictureInPicture
            controlsList="nodownload noplaybackrate"
            autoPlay={false}
            onError={(e) => { console.error('Video load error:', e) }}
          >
            <source src={media.url} type={media.file_type || 'video/mp4'} />
          </video>
        ) : (
          <Image
            src={media.url}
            alt={media.file_name}
            fill
            className="object-contain"
            sizes="100vw"
            priority
          />
        )}
      </div>

      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  )
}
