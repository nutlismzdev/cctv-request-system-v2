// app/api/line/send-link-message/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { userId, linkCode, reportId } = await req.json()

    // Validate required parameters
    if (!userId || !linkCode || !reportId) {
      return NextResponse.json(
        { error: 'Missing required parameters: userId, linkCode, reportId' },
        { status: 400 }
      )
    }

    // Get LINE access token
    const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!ACCESS_TOKEN) {
      throw new Error('LINE_CHANNEL_ACCESS_TOKEN not configured')
    }

    // Send message with link to LINE OA (ใช้ short URL)
    const linkUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:4000'}/api/line/link-via-url?c=${linkCode}&r=${reportId}&u=${userId}`

    const message = {
      to: userId,
      messages: [
        {
          type: 'template',
          altText: `คำร้อง #${reportId} - เชื่อมต่อกับระบบ`,
          template: {
            type: 'buttons',
            text: `สวัสดีครับ!\n\nคุณได้ยื่นคำร้อง #${reportId} เรียบร้อยแล้ว\n\nเพื่อรับแจ้งเตือนเมื่อสถานะคำร้องเปลี่ยนแปลง กรุณาคลิกลิงก์ด้านล่างเพื่อเชื่อมต่อ`,
            actions: [
              {
                type: 'uri',
                label: 'เชื่อมต่อคำร้อง',
                uri: linkUrl
              }
            ]
          }
        }
      ]
    }

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      },
      body: JSON.stringify(message)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`LINE API error: ${response.status} - ${JSON.stringify(errorData)}`)
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      message: 'ส่งข้อความพร้อมปุ่มเชื่อมต่อไปยัง LINE OA เรียบร้อยแล้ว',
      data: result
    })

  } catch (error) {
    // Production: ลบ error log
    if (process.env.NODE_ENV !== 'production') {
      console.error('Send link message error:', error)
    }
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการส่งข้อความไปยัง LINE OA' },
      { status: 500 }
    )
  }
}
