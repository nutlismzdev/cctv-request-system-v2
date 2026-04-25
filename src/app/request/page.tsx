'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  FileBadge2,
  FileText,
  Loader2,
  MessageCircle,
  ShieldCheck,
  UploadCloud,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import type { LiffSDK, LiffUserProfile } from '@/types/liff'

const PREFIXES = ['นาย', 'นาง', 'นางสาว'] as const
const ROLES = ['ผู้เสียหาย', 'ญาติ', 'ผู้เกี่ยวข้อง', 'เจ้าหน้าที่รัฐ', 'ประกัน'] as const
const REQUEST_TYPES = ['ขอสำเนาข้อมูลภาพ', 'ขอดูข้อมูลรูปภาพ'] as const
const STEPS = ['ข้อมูลผู้ยื่นคำร้อง', 'ยื่นเอกสารประกอบ', 'รายละเอียดเหตุการณ์', 'ตรวจสอบก่อนส่ง'] as const

const formSchema = z.object({
  prefix: z.enum(PREFIXES, { message: 'กรุณาเลือกคำนำหน้า' }),
  full_name: z.string().min(1, 'กรุณากรอกชื่อ-นามสกุล'),
  age: z.string()
    .min(1, 'กรุณาระบุอายุ')
    .refine((v) => /^[0-9]+$/.test(v), 'อายุต้องเป็นตัวเลขเท่านั้น')
    .refine((v) => Number(v) >= 1 && Number(v) <= 120, 'อายุต้องอยู่ระหว่าง 1-120 ปี'),
  phone_number: z.string()
    .min(9, 'กรุณากรอกเบอร์โทรศัพท์')
    .refine((v) => /^0\d{8,9}$/.test(v.replace(/\s|-/g, '')), 'รูปแบบเบอร์โทรไม่ถูกต้อง'),
  id_or_passport_number: z.string()
    .min(6, 'อย่างน้อย 6 ตัวอักษร')
    .refine((v) => /^[0-9A-Za-z-]{6,}$/.test(v), 'ใช้ได้เฉพาะตัวเลข ตัวอักษร และขีดกลาง'),
  line_user_id_str: z.string().min(1, 'ไม่พบข้อมูล LINE กรุณาเข้าใหม่ผ่าน LINE'),
  house_number: z.string().optional(),
  village_number: z.string().optional(),
  alley: z.string().optional(),
  road: z.string().optional(),
  sub_district: z.string().min(1, 'กรุณาระบุตำบล/แขวง'),
  district: z.string().min(1, 'กรุณาระบุอำเภอ/เขต'),
  province: z.string().min(1, 'กรุณาระบุจังหวัด'),
  postal_code: z.string()
    .min(5, 'รหัสไปรษณีย์ 5 หลัก')
    .refine((v) => /^[0-9]{5}$/.test(v), 'รูปแบบรหัสไปรษณีย์ไม่ถูกต้อง'),
  involvement_role: z.enum(ROLES, { message: 'กรุณาเลือกสถานะการเกี่ยวข้อง' }),
  involvement_explain: z.string().optional(),
  category_id: z.number().min(1, 'กรุณาเลือกหมวดหมู่เหตุการณ์'),
  request_type: z.enum(REQUEST_TYPES, { message: 'กรุณาเลือกประเภทคำร้อง' }),
  incident_date: z.string().min(1, 'กรุณาระบุวันที่เกิดเหตุ'),
  incident_time: z.string().min(1, 'กรุณาระบุเวลาที่เกิดเหตุ'),
  incident_location: z.string().min(1, 'กรุณาระบุสถานที่เกิดเหตุ'),
  request_details: z.string().optional(),
  supporting_documents: z.object({
    id_card_copy: z.boolean(),
    police_report_copy: z.boolean(),
    other: z.boolean(),
    other_details: z.string().optional(),
  }).refine((docs) => docs.id_card_copy && docs.police_report_copy && docs.other, {
    message: 'กรุณาอัปโหลดเอกสารให้ครบทั้ง 3 รายการ',
    path: ['other'],
  }),
  consent: z.boolean().refine((v) => v, 'ต้องยอมรับเงื่อนไขก่อนส่งคำร้อง'),
}).superRefine((data, ctx) => {
  if ((data.involvement_role === 'ญาติ' || data.involvement_role === 'ผู้เกี่ยวข้อง') && !data.involvement_explain?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['involvement_explain'],
      message: 'กรุณาระบุความเกี่ยวข้องเพิ่มเติม',
    })
  }
})

type FormValues = z.infer<typeof formSchema>
type StepIndex = 0 | 1 | 2 | 3
type GateState = 'booting' | 'need-friend' | 'ready' | 'error'
type CategoryItem = { id: number; name: string }
type UploadKind = 'police' | 'idcopy' | 'selfie'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-sm font-medium text-red-600">{message}</p>
}

function fileLabel(file: File | null) {
  if (!file) return 'ยังไม่ได้เลือกไฟล์'
  return `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`
}

function DocumentPicker(props: {
  title: string
  description: string
  accept: string
  icon: ReactNode
  file: File | null
  onPick: (file: File | null) => void
  error?: string
}) {
  const { title, description, accept, icon, file, onPick, error } = props
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <Card className="border border-slate-200 shadow-none">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-sky-50 p-3 text-sky-700">{icon}</div>
          <div className="space-y-1">
            <h3 className="font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600">{description}</p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => {
            const nextFile = event.target.files?.[0] ?? null
            onPick(nextFile)
            event.target.value = ''
          }}
        />

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-900">{file ? 'อัปโหลดแล้ว' : 'เลือกไฟล์เอกสาร'}</p>
              <p className="text-sm text-slate-600">{fileLabel(file)}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                <UploadCloud className="mr-2 h-4 w-4" />
                {file ? 'เปลี่ยนไฟล์' : 'เลือกไฟล์'}
              </Button>
              {file && (
                <Button type="button" variant="ghost" onClick={() => onPick(null)}>
                  ล้างไฟล์
                </Button>
              )}
            </div>
          </div>
        </div>

        <FieldError message={error} />
      </CardContent>
    </Card>
  )
}

function GateScreen(props: {
  gateState: GateState
  profile: LiffUserProfile | null
  errorMessage: string
  onRetryFriendship: () => void
}) {
  const { gateState, profile, errorMessage, onRetryFriendship } = props

  if (gateState === 'booting') {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-md">
          <Card className="border-0 shadow-xl shadow-slate-200/60">
            <CardContent className="space-y-5 p-8 text-center">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-sky-600" />
              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-slate-900">กำลังเตรียมระบบยื่นคำร้องออนไลน์</h1>
                <p className="text-sm text-slate-600">
                  ระบบจะตรวจสอบบัญชี LINE และสิทธิ์การใช้งานก่อนเปิดแบบฟอร์ม
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (gateState === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-md">
          <Card className="border-0 shadow-xl shadow-slate-200/60">
            <CardContent className="space-y-5 p-8 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-red-600" />
              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-slate-900">ไม่สามารถเปิดระบบได้</h1>
                <p className="text-sm text-slate-600">{errorMessage}</p>
              </div>
              <Button type="button" onClick={() => window.location.reload()} className="w-full">
                ลองใหม่อีกครั้ง
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md">
        <Card className="border-0 shadow-xl shadow-slate-200/60">
          <CardContent className="space-y-6 p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <MessageCircle className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-slate-900">กรุณาเพิ่มเพื่อน LINE OA ก่อนใช้งาน</h1>
              <p className="text-sm text-slate-600">
                ระบบยื่นคำร้องออนไลน์จะส่งผลการพิจารณาและลิงก์ดาวน์โหลดผ่าน LINE โดยตรง จึงต้องเป็นเพื่อนกับ LINE OA ก่อน
              </p>
              {profile && (
                <p className="text-xs text-slate-500">
                  เข้าสู่ระบบแล้วในชื่อ <span className="font-semibold">{profile.displayName}</span>
                </p>
              )}
            </div>
            <div className="space-y-3">
              <Button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={() => window.open('https://line.me/R/ti/p/@huahin', '_blank', 'noopener,noreferrer')}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                เพิ่มเพื่อน LINE OA
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={onRetryFriendship}>
                ตรวจสอบอีกครั้ง
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Stepper({ current }: { current: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {STEPS.map((label, index) => (
          <div key={label} className="flex min-w-0 flex-1 items-center gap-2">
            <div
              className={[
                'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold',
                index <= current ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-500',
              ].join(' ')}
            >
              {index + 1}
            </div>
            <span className={['hidden text-sm md:block', index === current ? 'text-slate-900 font-semibold' : 'text-slate-500'].join(' ')}>
              {label}
            </span>
            {index < STEPS.length - 1 && <div className="hidden h-px flex-1 bg-slate-200 md:block" />}
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-600">
        ขั้นตอนที่ {current + 1} จาก {STEPS.length}: <span className="font-semibold text-slate-900">{STEPS[current]}</span>
      </p>
    </div>
  )
}

function SuccessState(props: {
  reportId: number
  attachmentIssue: boolean
  onClose: () => void
}) {
  const { reportId, attachmentIssue, onClose } = props

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] px-4 py-10">
      <div className="mx-auto max-w-xl">
        <Card className="border-0 shadow-2xl shadow-sky-100/80">
          <CardContent className="space-y-6 p-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-slate-900">ยื่นคำร้องออนไลน์สำเร็จ</h1>
              <p className="text-sm text-slate-600">
                หมายเลขคำร้องของคุณคือ <span className="font-semibold text-slate-900">#{reportId}</span>
              </p>
              <p className="text-sm text-slate-600">
                ระบบจะส่งผลการพิจารณาและลิงก์เอกสารผ่าน LINE OA อัตโนมัติ ไม่ต้องสแกน QR หรือพิมพ์ข้อความในแชตอีก
              </p>
            </div>

            <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-left text-sm text-sky-900">
              <p className="font-semibold">สิ่งที่จะเกิดขึ้นต่อจากนี้</p>
              <ul className="mt-2 space-y-1 text-sky-800">
                <li>เจ้าหน้าที่จะตรวจสอบคำร้องและเอกสารประกอบ</li>
                <li>เมื่ออนุมัติแล้ว ระบบจะส่งข้อมูลผ่าน LINE ไปยังบัญชีของคุณโดยตรง</li>
                <li>สามารถติดตามสถานะย้อนหลังได้ที่หน้าเช็กสถานะคำร้อง</li>
              </ul>
            </div>

            {attachmentIssue && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-900">
                ระบบบันทึกคำร้องแล้ว แต่มีบางเอกสารอัปโหลดไม่สำเร็จ กรุณาติดต่อเจ้าหน้าที่พร้อมแจ้งหมายเลขคำร้องนี้เพื่อให้ช่วยตรวจสอบ
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/request/status" className="flex-1">
                <Button type="button" variant="outline" className="w-full">
                  ตรวจสอบสถานะคำร้อง
                </Button>
              </Link>
              <Button type="button" className="flex-1" onClick={onClose}>
                ปิดหน้านี้
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

async function ensureLiffSdk() {
  if (typeof window === 'undefined') return null
  if (window.liff) return window.liff

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('โหลด LINE LIFF SDK ไม่สำเร็จ'))
    document.head.appendChild(script)
  })

  return window.liff ?? null
}

async function uploadAttachment(reportId: number, file: File, category: UploadKind) {
  const formData = new FormData()
  formData.append('files', file)
  formData.append('category', category)

  const res = await fetch(`/api/reports/${reportId}/attachments`, {
    method: 'POST',
    body: formData,
  })

  const json = await res.json()
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || 'อัปโหลดเอกสารไม่สำเร็จ')
  }
}

export default function RequestPage() {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID || process.env.NEXT_PUBLIC_LINE_LIFF_ID || ''
  const [gateState, setGateState] = useState<GateState>('booting')
  const [gateError, setGateError] = useState('')
  const [profile, setProfile] = useState<LiffUserProfile | null>(null)
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [step, setStep] = useState<StepIndex>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [doneReportId, setDoneReportId] = useState<number | null>(null)
  const [attachmentIssue, setAttachmentIssue] = useState(false)
  const [policeReportFile, setPoliceReportFile] = useState<File | null>(null)
  const [idCardFile, setIdCardFile] = useState<File | null>(null)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [docsError, setDocsError] = useState('')
  const liffRef = useRef<LiffSDK | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: {
      prefix: 'นาย',
      full_name: '',
      age: '',
      phone_number: '',
      id_or_passport_number: '',
      line_user_id_str: '',
      house_number: '',
      village_number: '',
      alley: '',
      road: '',
      sub_district: '',
      district: '',
      province: '',
      postal_code: '',
      involvement_role: 'ผู้เสียหาย',
      involvement_explain: '',
      category_id: 0,
      request_type: 'ขอสำเนาข้อมูลภาพ',
      incident_date: '',
      incident_time: '',
      incident_location: '',
      request_details: '',
      supporting_documents: {
        id_card_copy: false,
        police_report_copy: false,
        other: false,
        other_details: '',
      },
      consent: false,
    },
  })

  const { register, setValue, getValues, trigger, watch, formState: { errors } } = form

  const docsReady = Boolean(policeReportFile && idCardFile && selfieFile)

  useEffect(() => {
    setValue(
      'supporting_documents',
      {
        id_card_copy: Boolean(idCardFile),
        police_report_copy: Boolean(policeReportFile),
        other: Boolean(selfieFile),
        other_details: selfieFile ? 'รูปถ่ายใบหน้ายืนยันตัวตน' : '',
      },
      { shouldValidate: step === 1 },
    )
  }, [idCardFile, policeReportFile, selfieFile, setValue, step])

  const initGate = useCallback(async () => {
    try {
      setGateState('booting')
      setGateError('')

      if (!liffId) {
        throw new Error('ยังไม่ได้ตั้งค่า LIFF ID ในระบบ')
      }

      const liff = await ensureLiffSdk()
      if (!liff) {
        throw new Error('ไม่พบ LIFF SDK')
      }

      liffRef.current = liff
      await liff.init({ liffId })

      if (!liff.isLoggedIn()) {
        liff.login()
        return
      }

      if (!liff.isInClient()) {
        window.location.replace(`https://liff.line.me/${liffId}`)
        return
      }

      const [friendship, nextProfile] = await Promise.all([
        liff.getFriendship(),
        liff.getProfile(),
      ])

      setProfile(nextProfile)
      setValue('line_user_id_str', nextProfile.userId, { shouldValidate: true })

      if (!getValues('full_name')) {
        setValue('full_name', nextProfile.displayName)
      }

      if (!friendship.friendFlag) {
        setGateState('need-friend')
        return
      }

      setGateState('ready')
    } catch (error) {
      setGateError(error instanceof Error ? error.message : 'ไม่สามารถตรวจสอบ LINE ได้')
      setGateState('error')
    }
  }, [getValues, liffId, setValue])

  useEffect(() => {
    void initGate()
  }, [initGate])

  useEffect(() => {
    if (gateState !== 'ready') return

    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/categories?lang=th')
        const json = await res.json()
        if (!mounted) return
        setCategories(Array.isArray(json?.items) ? json.items : [])
      } catch {
        if (mounted) toast.error('ไม่สามารถโหลดหมวดหมู่เหตุการณ์ได้')
      }
    })()

    return () => {
      mounted = false
    }
  }, [gateState])

  const summary = useMemo(() => {
    const values = getValues()
    const categoryName = categories.find((item) => item.id === Number(values.category_id))?.name || '-'
    return {
      applicant: `${values.prefix}${values.full_name}`,
      address: [
        values.house_number && `บ้านเลขที่ ${values.house_number}`,
        values.village_number && `หมู่ ${values.village_number}`,
        values.alley && `ซอย ${values.alley}`,
        values.road && `ถนน ${values.road}`,
        values.sub_district,
        values.district,
        values.province,
        values.postal_code,
      ].filter(Boolean).join(' '),
      involvement: values.involvement_role + (values.involvement_explain ? ` (${values.involvement_explain})` : ''),
      categoryName,
      docs: [
        policeReportFile?.name && 'สำเนาบันทึกประจำวัน',
        idCardFile?.name && 'สำเนาบัตรประชาชน',
        selfieFile?.name && 'รูปถ่ายใบหน้ายืนยันตัวตน',
      ].filter(Boolean).join(', '),
    }
  }, [categories, getValues, idCardFile, policeReportFile, selfieFile])

  const validateDocumentStep = useCallback(() => {
    if (!docsReady) {
      setDocsError('กรุณาอัปโหลดเอกสารให้ครบทั้ง 3 รายการก่อนดำเนินการต่อ')
      return false
    }
    setDocsError('')
    return true
  }, [docsReady])

  const nextStep = useCallback(async () => {
    if (step === 0) {
      const ok = await trigger([
        'prefix',
        'full_name',
        'age',
        'phone_number',
        'id_or_passport_number',
        'line_user_id_str',
        'house_number',
        'sub_district',
        'district',
        'province',
        'postal_code',
        'involvement_role',
        'involvement_explain',
      ], { shouldFocus: true })
      if (!ok) {
        toast.error('กรุณากรอกข้อมูลผู้ยื่นคำร้องให้ครบ')
        return
      }
      setStep(1)
      return
    }

    if (step === 1) {
      if (!validateDocumentStep()) {
        toast.error('กรุณาแนบเอกสารให้ครบ')
        return
      }
      setStep(2)
      return
    }

    if (step === 2) {
      const ok = await trigger([
        'category_id',
        'request_type',
        'incident_date',
        'incident_time',
        'incident_location',
      ], { shouldFocus: true })
      if (!ok) {
        toast.error('กรุณากรอกรายละเอียดเหตุการณ์ให้ครบ')
        return
      }
      setStep(3)
    }
  }, [step, trigger, validateDocumentStep])

  const submitOnlineRequest = useCallback(async () => {
    const ok = await trigger(undefined, { shouldFocus: true })
    if (!ok) {
      toast.error('กรุณาตรวจสอบข้อมูลก่อนส่งคำร้อง')
      return
    }
    if (!validateDocumentStep()) {
      setStep(1)
      toast.error('เอกสารประกอบยังไม่ครบ')
      return
    }
    if (!policeReportFile || !idCardFile || !selfieFile) return

    setIsSubmitting(true)
    setAttachmentIssue(false)

    try {
      const payload = {
        ...getValues(),
        category_id: Number(getValues('category_id')),
        language: 'th' as const,
      }

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || 'ไม่สามารถบันทึกคำร้องได้')
      }

      const reportId = Number(json.data.report_id)

      try {
        await uploadAttachment(reportId, policeReportFile, 'police')
        await uploadAttachment(reportId, idCardFile, 'idcopy')
        await uploadAttachment(reportId, selfieFile, 'selfie')
      } catch (error) {
        console.error('Attachment upload error:', error)
        setAttachmentIssue(true)
      }

      setDoneReportId(reportId)
      toast.success('บันทึกคำร้องเรียบร้อยแล้ว')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการส่งคำร้อง')
    } finally {
      setIsSubmitting(false)
    }
  }, [getValues, idCardFile, policeReportFile, selfieFile, trigger, validateDocumentStep])

  const closeWindow = useCallback(() => {
    const liff = liffRef.current
    if (liff?.isInClient()) {
      liff.closeWindow()
      return
    }
    window.close()
  }, [])

  if (doneReportId) {
    return <SuccessState reportId={doneReportId} attachmentIssue={attachmentIssue} onClose={closeWindow} />
  }

  if (gateState !== 'ready') {
    return <GateScreen gateState={gateState} profile={profile} errorMessage={gateError} onRetryFriendship={() => void initGate()} />
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eff6ff_0%,#f8fafc_45%,#ffffff_100%)]">
      <section className="relative overflow-hidden border-b border-sky-100 bg-slate-950 text-white">
        <div className="absolute inset-0 opacity-25">
          <Image src="/hero/hero.png" alt="CCTV" fill priority className="object-cover" sizes="100vw" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(2,132,199,0.85),rgba(15,23,42,0.92))]" />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-sky-50">
                ยื่นคำร้องออนไลน์ผ่าน LINE Official Account
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  ระบบยื่นคำร้องออนไลน์เชื่อม LINE อัตโนมัติ
                </h1>
                <p className="text-sm leading-6 text-sky-50/90 sm:text-base">
                  ผู้ยื่นต้องเข้าสู่ระบบผ่าน LINE และเป็นเพื่อนกับ LINE OA ก่อน จึงจะสามารถส่งคำร้องและรับผลผ่าน LINE ได้โดยตรง
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-sky-50/90">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                  <ShieldCheck className="h-4 w-4" />
                  ได้ LINE mapping ก่อน submit
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                  <FileText className="h-4 w-4" />
                  แนบเอกสารครบในขั้นตอนที่ 2
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                  <MessageCircle className="h-4 w-4" />
                  ไม่ต้องสแกน QR หรือพิมพ์ข้อความหา OA
                </span>
              </div>
            </div>

            <Card className="border-white/10 bg-white/10 text-white shadow-none backdrop-blur">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="overflow-hidden rounded-full border border-white/15 bg-white/10">
                  {profile?.pictureUrl ? (
                    <Image src={profile.pictureUrl} alt={profile.displayName} width={52} height={52} className="h-13 w-13 object-cover" />
                  ) : (
                    <div className="flex h-13 w-13 items-center justify-center text-white">
                      <UserRound className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-sky-100/70">Signed in with LINE</p>
                  <p className="font-semibold">{profile?.displayName}</p>
                  <p className="text-xs text-sky-50/80">LINE User ID ถูกผูกไว้กับคำร้องนี้อัตโนมัติ</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            <Card className="border-0 shadow-xl shadow-slate-200/60">
              <CardHeader className="space-y-4">
                <Stepper current={step} />
              </CardHeader>
              <CardContent className="space-y-6">
                {step === 0 && (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div className="space-y-2">
                        <Label>คำนำหน้า</Label>
                        <Select value={watch('prefix')} onValueChange={(value) => setValue('prefix', value as FormValues['prefix'], { shouldValidate: true })}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="เลือกคำนำหน้า" />
                          </SelectTrigger>
                          <SelectContent>
                            {PREFIXES.map((item) => (
                              <SelectItem key={item} value={item}>{item}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError message={errors.prefix?.message} />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="full_name">ชื่อ-นามสกุล</Label>
                        <Input id="full_name" {...register('full_name')} />
                        <FieldError message={errors.full_name?.message} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="age">อายุ</Label>
                        <Input id="age" inputMode="numeric" {...register('age')} />
                        <FieldError message={errors.age?.message} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone_number">เบอร์โทรศัพท์</Label>
                        <Input id="phone_number" inputMode="tel" {...register('phone_number')} />
                        <FieldError message={errors.phone_number?.message} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="id_or_passport_number">เลขบัตรประชาชน/หนังสือเดินทาง</Label>
                        <Input id="id_or_passport_number" {...register('id_or_passport_number')} />
                        <FieldError message={errors.id_or_passport_number?.message} />
                      </div>

                      <div className="space-y-2">
                        <Label>สถานะการเกี่ยวข้อง</Label>
                        <Select value={watch('involvement_role')} onValueChange={(value) => setValue('involvement_role', value as FormValues['involvement_role'], { shouldValidate: true })}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="เลือกสถานะการเกี่ยวข้อง" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((item) => (
                              <SelectItem key={item} value={item}>{item}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError message={errors.involvement_role?.message} />
                      </div>

                      {(watch('involvement_role') === 'ญาติ' || watch('involvement_role') === 'ผู้เกี่ยวข้อง') && (
                        <div className="space-y-2 md:col-span-2 xl:col-span-2">
                          <Label htmlFor="involvement_explain">ระบุความเกี่ยวข้องเพิ่มเติม</Label>
                          <Input id="involvement_explain" {...register('involvement_explain')} />
                          <FieldError message={errors.involvement_explain?.message} />
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div>
                        <h2 className="font-semibold text-slate-900">ที่อยู่ผู้ยื่นคำร้อง</h2>
                        <p className="text-sm text-slate-600">กรอกข้อมูลที่อยู่เพื่อให้เจ้าหน้าที่ใช้ประกอบการพิจารณา</p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-2">
                          <Label htmlFor="house_number">บ้านเลขที่</Label>
                          <Input id="house_number" {...register('house_number')} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="village_number">หมู่</Label>
                          <Input id="village_number" {...register('village_number')} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="alley">ซอย</Label>
                          <Input id="alley" {...register('alley')} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="road">ถนน</Label>
                          <Input id="road" {...register('road')} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sub_district">ตำบล/แขวง</Label>
                          <Input id="sub_district" {...register('sub_district')} />
                          <FieldError message={errors.sub_district?.message} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="district">อำเภอ/เขต</Label>
                          <Input id="district" {...register('district')} />
                          <FieldError message={errors.district?.message} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="province">จังหวัด</Label>
                          <Input id="province" {...register('province')} />
                          <FieldError message={errors.province?.message} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="postal_code">รหัสไปรษณีย์</Label>
                          <Input id="postal_code" inputMode="numeric" {...register('postal_code')} />
                          <FieldError message={errors.postal_code?.message} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
                      ขั้นตอนนี้ต้องแนบเอกสารให้ครบทั้ง 3 รายการก่อนจึงจะส่งคำร้องออนไลน์ได้
                    </div>

                    <DocumentPicker
                      title="สำเนาบันทึกประจำวัน"
                      description="รองรับไฟล์ PDF, JPG, PNG หรือ HEIC ขนาดไม่เกิน 10MB"
                      accept=".pdf,image/*"
                      icon={<FileText className="h-5 w-5" />}
                      file={policeReportFile}
                      onPick={(file) => setPoliceReportFile(file)}
                      error={!policeReportFile && docsError ? 'ยังไม่ได้แนบสำเนาบันทึกประจำวัน' : undefined}
                    />

                    <DocumentPicker
                      title="สำเนาบัตรประชาชน"
                      description="ใช้สำหรับยืนยันตัวตนผู้ยื่นคำร้อง รองรับ PDF หรือรูปภาพ"
                      accept=".pdf,image/*"
                      icon={<FileBadge2 className="h-5 w-5" />}
                      file={idCardFile}
                      onPick={(file) => setIdCardFile(file)}
                      error={!idCardFile && docsError ? 'ยังไม่ได้แนบสำเนาบัตรประชาชน' : undefined}
                    />

                    <DocumentPicker
                      title="รูปถ่ายใบหน้ายืนยันตัวตน"
                      description="กรุณาถ่ายใบหน้าปัจจุบันให้เห็นชัดเจน รองรับไฟล์รูปภาพเท่านั้น"
                      accept="image/*"
                      icon={<Camera className="h-5 w-5" />}
                      file={selfieFile}
                      onPick={(file) => setSelfieFile(file)}
                      error={!selfieFile && docsError ? 'ยังไม่ได้แนบรูปถ่ายใบหน้า' : undefined}
                    />
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>หมวดหมู่เหตุการณ์</Label>
                        <Select
                          value={watch('category_id') ? String(watch('category_id')) : ''}
                          onValueChange={(value) => setValue('category_id', Number(value), { shouldValidate: true })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="เลือกหมวดหมู่เหตุการณ์" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((item) => (
                              <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError message={errors.category_id?.message} />
                      </div>

                      <div className="space-y-2">
                        <Label>ประเภทคำร้อง</Label>
                        <Select value={watch('request_type')} onValueChange={(value) => setValue('request_type', value as FormValues['request_type'], { shouldValidate: true })}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="เลือกประเภทคำร้อง" />
                          </SelectTrigger>
                          <SelectContent>
                            {REQUEST_TYPES.map((item) => (
                              <SelectItem key={item} value={item}>{item}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError message={errors.request_type?.message} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="incident_date">วันที่เกิดเหตุ</Label>
                        <Input id="incident_date" type="date" {...register('incident_date')} />
                        <FieldError message={errors.incident_date?.message} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="incident_time">เวลาที่เกิดเหตุ</Label>
                        <Input id="incident_time" type="time" {...register('incident_time')} />
                        <FieldError message={errors.incident_time?.message} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="incident_location">สถานที่เกิดเหตุ</Label>
                      <Textarea id="incident_location" rows={3} {...register('incident_location')} />
                      <FieldError message={errors.incident_location?.message} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="request_details">รายละเอียดเพิ่มเติม</Label>
                      <Textarea id="request_details" rows={5} {...register('request_details')} />
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card className="border border-slate-200 shadow-none">
                        <CardContent className="space-y-3 p-5 text-sm">
                          <h3 className="font-semibold text-slate-900">ข้อมูลผู้ยื่นคำร้อง</h3>
                          <p><span className="text-slate-500">ชื่อ:</span> {summary.applicant}</p>
                          <p><span className="text-slate-500">เบอร์โทร:</span> {watch('phone_number')}</p>
                          <p><span className="text-slate-500">สถานะ:</span> {summary.involvement}</p>
                          <p><span className="text-slate-500">ที่อยู่:</span> {summary.address || '-'}</p>
                        </CardContent>
                      </Card>

                      <Card className="border border-slate-200 shadow-none">
                        <CardContent className="space-y-3 p-5 text-sm">
                          <h3 className="font-semibold text-slate-900">ข้อมูลเหตุการณ์และเอกสาร</h3>
                          <p><span className="text-slate-500">หมวดหมู่:</span> {summary.categoryName}</p>
                          <p><span className="text-slate-500">ประเภทคำร้อง:</span> {watch('request_type')}</p>
                          <p><span className="text-slate-500">วันที่/เวลา:</span> {watch('incident_date')} {watch('incident_time')}</p>
                          <p><span className="text-slate-500">เอกสาร:</span> {summary.docs}</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="border border-slate-200 shadow-none">
                      <CardContent className="space-y-4 p-5">
                        <div className="space-y-2">
                          <h3 className="font-semibold text-slate-900">ยืนยันก่อนส่งคำร้อง</h3>
                          <p className="text-sm text-slate-600">
                            ระบบจะผูกคำร้องนี้กับบัญชี LINE ของคุณโดยอัตโนมัติ และใช้ LINE OA เป็นช่องทางแจ้งผลภายหลัง
                          </p>
                        </div>
                        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <Checkbox
                            id="consent"
                            checked={watch('consent')}
                            onCheckedChange={(checked) => setValue('consent', Boolean(checked), { shouldValidate: true })}
                          />
                          <div className="space-y-1">
                            <Label htmlFor="consent" className="cursor-pointer">
                              ข้าพเจ้ายืนยันว่าข้อมูลและเอกสารที่แนบมาถูกต้อง และยินยอมให้ระบบใช้ LINE เพื่อแจ้งผลคำร้อง
                            </Label>
                            <FieldError message={errors.consent?.message} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-between">
                  <Button type="button" variant="outline" disabled={step === 0 || isSubmitting} onClick={() => setStep((prev) => Math.max(0, prev - 1) as StepIndex)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    ย้อนกลับ
                  </Button>

                  {step < 3 ? (
                    <Button type="button" onClick={() => void nextStep()} disabled={isSubmitting}>
                      ถัดไป
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="button" onClick={() => void submitOnlineRequest()} disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          กำลังส่งคำร้อง...
                        </>
                      ) : (
                        <>
                          ส่งคำร้องออนไลน์
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6">
            <Card className="border-0 shadow-xl shadow-slate-200/60">
              <CardHeader>
                <CardTitle>ข้อกำหนดของการยื่นออนไลน์</CardTitle>
                <CardDescription>ระบบนี้ออกแบบให้เชื่อม LINE ตั้งแต่ต้นเพื่อลดงานค้างและไม่ต้องให้ผู้ใช้ทักหา OA เอง</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-700">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="font-semibold text-emerald-900">ผ่านแล้ว</p>
                  <p className="mt-1 text-emerald-800">เข้าสู่ระบบผ่าน LINE และเพิ่มเพื่อนกับ OA เรียบร้อย</p>
                </div>
                <div className="space-y-2">
                  <p className="font-semibold text-slate-900">เอกสารที่ต้องใช้</p>
                  <ul className="space-y-2 text-slate-600">
                    <li>1. สำเนาบันทึกประจำวัน</li>
                    <li>2. สำเนาบัตรประชาชน</li>
                    <li>3. รูปถ่ายใบหน้ายืนยันตัวตน</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-slate-900 text-white shadow-xl shadow-slate-300/30">
              <CardHeader>
                <CardTitle>ช่องทางอื่น</CardTitle>
                <CardDescription className="text-slate-300">
                  หากต้องยื่นคำร้องที่หน้างานจริง ให้ใช้ flow เดิมที่แยกออกไว้ต่างหาก
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/request-onsite" className="block">
                  <Button type="button" variant="outline" className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10">
                    ไปที่ระบบหน้างานจริง
                  </Button>
                </Link>
                <Link href="/request/status" className="block">
                  <Button type="button" variant="ghost" className="w-full text-white hover:bg-white/10">
                    ตรวจสอบสถานะคำร้อง
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  )
}
