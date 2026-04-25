'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      // Simple password check - no database required
      if (password === '77110') {
        // Create a simple session token
        const token = `admin_session_${Date.now()}`
        const user = {
          id: 1,
          username: 'admin',
          role: 'administrator',
          name: 'ผู้ดูแลระบบ'
        }

        // Store auth data in localStorage
        localStorage.setItem('admin_token', token)
        localStorage.setItem('admin_user', JSON.stringify(user))

        toast.success('เข้าสู่ระบบสำเร็จ')
        router.push('/admin/request')
      } else {
        throw new Error('รหัสผ่านไม่ถูกต้อง')
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12">
            <Image
              src="/logo/1_0.ico"
              alt="เทศบาลนครหัวหิน"
              width={48}
              height={48}
              className="mx-auto"
            />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            เข้าสู่ระบบผู้ดูแลระบบ
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            เทศบาลนครหัวหิน - ระบบจัดการคำร้องขอข้อมูลภาพจากกล้อง
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">เข้าสู่ระบบผู้ดูแลระบบ</CardTitle>
            <CardDescription className="text-center">
              กรุณาป้อนรหัสผ่านเพื่อเข้าสู่ระบบจัดการคำร้อง
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Message */}
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Password Field */}
              <div>
                <Label htmlFor="password">รหัสผ่าน</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    placeholder="กรุณาป้อนรหัสผ่าน"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !password}
                >
                  {isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
                </Button>
              </div>
            </form>

          
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>© 2024 เทศบาลนครหัวหิน. สงวนลิขสิทธิ์.</p>
        </div>
      </div>
    </div>
  )
}
