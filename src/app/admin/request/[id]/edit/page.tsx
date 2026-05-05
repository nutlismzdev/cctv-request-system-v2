'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { checkAuth as verifyAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Tabs } from '@/components/ui/tabs'
import { RefreshCw, Save } from 'lucide-react'
import { ServerFileBrowser } from '@/components/server-file-browser'
import { THEME_COLORS } from '@/lib/theme-colors'

import { useReportData } from './_hooks/useReportData'
import { useServerFileBrowser } from './_hooks/useServerFileBrowser'
import { useDocsTab } from './_hooks/useDocsTab'
import { usePhotosTab } from './_hooks/usePhotosTab'
import { ApplicantTab } from './_components/ApplicantTab'
import { OfficerTab } from './_components/OfficerTab'
import { DocsTab } from './_components/DocsTab'
import { PhotosTab, FullscreenMediaModal } from './_components/PhotosTab'
import { EditTabsList } from './_components/EditTabsList'
import { EditPageHeader } from './_components/EditPageHeader'
import { EditPageSkeleton } from './_components/EditPageSkeleton'
import type { ActiveTab, Media } from './_types'

export default function EditRequestPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const data = useReportData(id)
  const browser = useServerFileBrowser('idcopy')
  const { uploadDocsWithCategory, deleteAttachment, reloadAttachments } = useDocsTab({
    report: data.report,
    setAttachments: data.setAttachments,
  })
  const { cctvUpload, deleteCctvMedia, toggleCctvPublish } = usePhotosTab({
    report: data.report,
    cctvMedia: data.cctvMedia,
    setCctvMedia: data.setCctvMedia,
  })

  const [activeTab, setActiveTab] = useState<ActiveTab>('applicant')
  const [fullscreenMedia, setFullscreenMedia] = useState<Media | null>(null)

  useEffect(() => {
    let cancelled = false
    verifyAuth().then(user => {
      if (cancelled) return
      if (!user) router.push('/login')
    })
    return () => { cancelled = true }
  }, [router])

  if (data.loading || !data.report) return <EditPageSkeleton />

  const { report, form, officers, categories, attachments, cctvMedia, validationErrors, saving } = data

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <EditPageHeader report={report} saving={saving} onSave={data.saveAll} />

      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)} className="w-full">
          <EditTabsList />

          <div className="mt-4 space-y-4">
            <ApplicantTab
              report={report}
              form={form}
              categories={categories}
              update={data.update}
            />
            <OfficerTab
              form={form}
              officers={officers}
              validationErrors={validationErrors}
              update={data.update}
              validateField={data.validateField}
            />
            <DocsTab
              attachments={attachments}
              uploadDocsWithCategory={uploadDocsWithCategory}
              deleteAttachment={deleteAttachment}
              openServerBrowser={browser.openFor}
            />
            <PhotosTab
              cctvMedia={cctvMedia}
              cctvUpload={cctvUpload}
              deleteCctvMedia={deleteCctvMedia}
              toggleCctvPublish={toggleCctvPublish}
              setFullscreenMedia={setFullscreenMedia}
            />
          </div>
        </Tabs>
      </div>

      <div className="fixed bottom-4 right-4">
        <Button
          onClick={data.saveAll}
          disabled={saving}
          className={`shadow-lg h-11 px-5 ${THEME_COLORS.primary} hover:${THEME_COLORS.primaryHover} ${THEME_COLORS.primaryForeground}`}
        >
          {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          บันทึกทั้งหมด
        </Button>
      </div>

      <ServerFileBrowser
        open={browser.open}
        onOpenChange={browser.setOpen}
        reportId={report.report_id}
        category={browser.category}
        onSuccess={reloadAttachments}
      />

      <FullscreenMediaModal
        media={fullscreenMedia}
        onClose={() => setFullscreenMedia(null)}
      />
    </div>
  )
}
