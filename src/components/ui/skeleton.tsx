import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Base variants for skeleton blocks.
 * ใช้ motion-safe เพื่อให้เคารพ prefers-reduced-motion
 */
export const skeletonVariants = cva(
  "motion-safe:animate-pulse bg-muted select-none",
  {
    variants: {
      variant: {
        default: "rounded-md",
        text: "rounded h-4",
        circle: "rounded-full",
        rounded: "rounded-full",
        card: "rounded-lg",
        button: "rounded-md h-10",
        avatar: "rounded-full h-10 w-10",
        thumbnail: "rounded aspect-video",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  /**
   * Mark this skeleton as decorative (default).
   * ถ้าต้องการให้ screen reader อ่านสถานะ loading ให้ห่อด้วยคอนเทนเนอร์ที่มี role="status"
   */
  decorative?: boolean
}

/**
 * Skeleton block — composable, fast, accessible.
 */
const Skeleton = React.memo(
  React.forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
    { className, variant, decorative = true, ...props },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={cn(skeletonVariants({ variant }), className)}
        aria-hidden={decorative ? true : undefined}
        {...props}
      />
    )
  })
)
Skeleton.displayName = "Skeleton"

/* ---------------------------------- */
/* SkeletonText - บล็อกข้อความหลายบรรทัด */
/* ---------------------------------- */
export interface SkeletonTextProps
  extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number
  lineHeightClass?: string // tailwind class เช่น "h-4"
  lastLineWidthClass?: string // tailwind class เช่น "w-3/4"
  gapClass?: string // ระยะห่างระหว่างบรรทัด
}

const SkeletonText = React.memo(
  React.forwardRef<HTMLDivElement, SkeletonTextProps>(function SkeletonText(
    {
      lines = 3,
      lineHeightClass = "h-4",
      lastLineWidthClass = "w-3/4",
      gapClass = "space-y-2",
      className,
      ...props
    },
    ref
  ) {
    // การสร้างอาร์เรย์ขนาดเล็ก มีค่าใช้จ่ายน้อยกว่า over-optimizing ด้วย useMemo
    const total = Math.max(1, lines)

    return (
      <div
        ref={ref}
        className={cn(gapClass, className)}
        aria-hidden
        {...props}
      >
        {Array.from({ length: total }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            className={cn(lineHeightClass, i === total - 1 && lastLineWidthClass)}
          />
        ))}
      </div>
    )
  })
)
SkeletonText.displayName = "SkeletonText"

/* ------------------------------- */
/* SkeletonCard - การ์ดโครงโหลด   */
/* ------------------------------- */
const SkeletonCard = React.memo(
  React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    function SkeletonCard({ className, children, ...props }, ref) {
      return (
        <div
          ref={ref}
          className={cn("rounded-lg border bg-card p-4 shadow-sm", className)}
          {...props}
        >
          {children ?? (
            <div aria-hidden className="space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton variant="avatar" />
                <div className="space-y-2 w-full">
                  <Skeleton variant="text" className="h-4 w-32" />
                  <Skeleton variant="text" className="h-3 w-24" />
                </div>
              </div>
              <SkeletonText lines={2} />
            </div>
          )}
        </div>
      )
    }
  )
)
SkeletonCard.displayName = "SkeletonCard"

/* ------------------------------- */
/* SkeletonList - รายการซ้ำ ๆ      */
/* ------------------------------- */
export interface SkeletonListProps
  extends React.HTMLAttributes<HTMLDivElement> {
  count?: number
  itemHeightClass?: string // เช่น "h-16" ใช้เป็นแนวทางให้สัดส่วน
  showButton?: boolean
}

const SkeletonList = React.memo(
  React.forwardRef<HTMLDivElement, SkeletonListProps>(function SkeletonList(
    { count = 5, itemHeightClass = "h-16", showButton = true, className, ...props },
    ref
  ) {
    const items = Math.max(1, count)

    return (
      <div ref={ref} className={cn("space-y-3", className)} {...props}>
        {Array.from({ length: items }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-4 rounded-md",
              // ให้เค้าโครงสูงขึ้นตาม itemHeightClass
              itemHeightClass
            )}
            aria-hidden
          >
            {/* ปรับขนาด avatar ให้สัมพันธ์กับความสูงแถวแบบหยาบ */}
            <Skeleton
              variant="circle"
              className="h-12 w-12 shrink-0"
            />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" className="h-4 w-3/4" />
              <Skeleton variant="text" className="h-3 w-1/2" />
            </div>
            {showButton && <Skeleton variant="button" className="w-20 shrink-0" />}
          </div>
        ))}
      </div>
    )
  })
)
SkeletonList.displayName = "SkeletonList"

/* -------------------------------- */
/* SkeletonTable - โครงตาราง        */
/* -------------------------------- */
export interface SkeletonTableProps
  extends React.HTMLAttributes<HTMLDivElement> {
  rows?: number
  columns?: number
  dense?: boolean // ระยะห่างน้อยลง
}

const SkeletonTable = React.memo(
  React.forwardRef<HTMLDivElement, SkeletonTableProps>(function SkeletonTable(
    { rows = 5, columns = 4, dense = false, className, ...props },
    ref
  ) {
    const r = Math.max(1, rows)
    const c = Math.max(1, columns)

    return (
      <div ref={ref} className={cn("space-y-4", className)} {...props}>
        {/* Header */}
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${c}, minmax(0, 1fr))` }}
          aria-hidden
        >
          {Array.from({ length: c }).map((_, i) => (
            <Skeleton key={`h-${i}`} variant="text" className="h-4" />
          ))}
        </div>

        {/* Rows */}
        <div className={cn("space-y-3", dense && "space-y-2")} aria-hidden>
          {Array.from({ length: r }).map((_, ri) => (
            <div
              key={`r-${ri}`}
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${c}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: c }).map((_, ci) => (
                <Skeleton key={`c-${ri}-${ci}`} variant="text" className="h-4" />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  })
)
SkeletonTable.displayName = "SkeletonTable"

export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonList,
  SkeletonTable,
}
