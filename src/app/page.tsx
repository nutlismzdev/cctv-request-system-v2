import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect ไปหน้า request เป็นหน้าแรก
  redirect('/request')
}
