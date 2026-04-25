import Image from "next/image"
import { THEME_COLORS } from "@/lib/theme-colors"

export const Logo = () => (
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border-2 border-[var(--primary)] overflow-hidden">
      <Image
        src="/logo/1_0.ico"
        alt="เทศบาลนครหัวหิน"
        width={40}
        height={40}
        className="w-full h-full object-contain"
        priority
      />
    </div>
    <div className="flex flex-col">
      <span className={`font-bold text-sm sm:text-base ${THEME_COLORS.foreground} leading-tight`}>
        เทศบาลนครหัวหิน
      </span>
      <span className={`text-xs ${THEME_COLORS.mutedForeground} hidden sm:block`}>
        ระบบยื่นคำร้องขอข้อมูลจากกล้องวงจรปิด (CCTV)
      </span>
    </div>
  </div>
)
