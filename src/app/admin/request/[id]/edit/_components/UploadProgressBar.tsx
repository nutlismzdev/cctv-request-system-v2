'use client'

import React from 'react'
import { X } from 'lucide-react'
import { humanSize } from '@/lib/upload-utils'
import type { UploadProgress } from '@/lib/use-upload'

interface UploadProgressBarProps {
  progress: UploadProgress
  onCancel: () => void
}

export function UploadProgressBar({ progress, onCancel }: UploadProgressBarProps) {
  if (!progress.uploading) return null

  return (
    <div className="mt-6 p-6 border-2 border-[var(--primary)]/20 bg-gradient-to-r from-[var(--primary)]/5 via-blue-50/50 to-indigo-50/50 rounded-2xl shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            progress.status === 'preparing' ? 'bg-yellow-500' :
            progress.status === 'uploading' ? 'bg-[var(--primary)]' :
            progress.status === 'processing' ? 'bg-purple-500' :
            progress.status === 'error' ? 'bg-red-500' :
            'bg-[var(--success)]'
          }`}>
            {progress.status === 'preparing' ? (
              <svg className="h-4 w-4 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : progress.status === 'uploading' ? (
              <svg className="h-4 w-4 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            ) : progress.status === 'processing' ? (
              <svg className="h-4 w-4 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ) : progress.status === 'error' ? (
              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--foreground)]">
              {progress.status === 'preparing' && 'เตรียมการอัปโหลด...'}
              {progress.status === 'uploading' && `กำลังอัปโหลดไฟล์ (${progress.currentFileIndex + 1}/${progress.totalFiles})`}
              {progress.status === 'processing' && 'กำลังประมวลผล...'}
              {progress.status === 'error' && 'เกิดข้อผิดพลาด'}
              {progress.status === 'completed' && 'อัปโหลดเสร็จสิ้น!'}
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">
              {progress.retryCount > 0 && `ลองใหม่ครั้งที่ ${progress.retryCount} • `}
              {progress.status === 'uploading' && progress.speed > 0 && `${progress.speed} KB/s`}
              {progress.status === 'preparing' && 'กรุณารอสักครู่...'}
              {progress.status === 'processing' && 'เกือบเสร็จแล้ว...'}
              {progress.status === 'error' && 'โปรดลองใหม่อีกครั้ง'}
              {progress.status === 'completed' && 'ไฟล์ทั้งหมดพร้อมใช้งาน'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xl font-black text-[var(--primary)]">
              {progress.progress}%
            </div>
            <div className="text-xs text-[var(--muted-foreground)] font-medium">
              {progress.estimatedTime > 0 && progress.status === 'uploading'
                ? `เหลือ ${progress.estimatedTime}s`
                : 'เสร็จสิ้น'}
            </div>
          </div>
          {(progress.status === 'uploading' || progress.status === 'preparing') && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-colors"
              title="ยกเลิกการอัปโหลด"
              aria-label="ยกเลิกการอัปโหลด"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {progress.currentFile && (
        <div className="mb-3 text-sm font-semibold text-[var(--foreground)] truncate flex items-center gap-2">
          <svg className="h-4 w-4 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {progress.currentFile}
        </div>
      )}

      <div className="w-full bg-slate-200 rounded-full h-4 mb-4 shadow-inner overflow-hidden">
        <div
          className={`h-4 rounded-full transition-all duration-700 ease-out shadow-lg relative ${
            progress.status === 'error' ? 'bg-gradient-to-r from-red-400 to-red-600' :
            progress.status === 'completed' ? 'bg-gradient-to-r from-green-400 to-green-600' :
            'bg-gradient-to-r from-[var(--primary)] via-blue-500 to-indigo-600'
          }`}
          style={{ width: `${progress.progress}%` }}
        >
          <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
        </div>
      </div>

      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-9 0V1m10 3V1m0 3l1 1v16a2 2 0 01-2 2H6a2 2 0 01-2-2V5l1-1z" />
            </svg>
            <span className="font-bold text-[var(--foreground)]">{humanSize(progress.uploadedSize)}</span>
            <span className="text-[var(--muted-foreground)]">/</span>
            <span className="font-bold text-[var(--primary)]">{humanSize(progress.totalSize)}</span>
          </div>

          {progress.speed > 0 && progress.status === 'uploading' && (
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="font-medium text-green-600">{progress.speed} KB/s</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {progress.totalFiles > 1 && (
            <div className="px-3 py-1 bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] rounded-full text-xs font-bold">
              {progress.totalFiles} ไฟล์
            </div>
          )}

          <div className="flex space-x-1">
            {Array.from({ length: Math.min(progress.totalFiles, 5) }, (_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  i < progress.currentFileIndex ? 'bg-[var(--success)]' :
                  i === progress.currentFileIndex ? 'bg-[var(--primary)] animate-pulse' :
                  'bg-slate-300'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {progress.failedFiles.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm font-medium text-red-800 mb-2">
            ไฟล์ที่ไม่สามารถอัปโหลดได้ ({progress.failedFiles.length} ไฟล์):
          </div>
          <div className="text-xs text-red-600 max-h-20 overflow-y-auto">
            {progress.failedFiles.map((file, index) => (
              <div key={index} className="mb-1">
                • {file.name}: {file.reason}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
