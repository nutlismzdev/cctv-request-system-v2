import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import Link from "next/link";
import { ComponentProps } from "react";
import { THEME_COLORS } from "@/lib/theme-colors";
import { useTranslations } from "next-intl";

export const NavMenu = (props: ComponentProps<typeof NavigationMenu>) => {
  const t = useTranslations('navbar')

  return (
    <NavigationMenu {...props}>
      <NavigationMenuList className="gap-6 space-x-0 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-start data-[orientation=vertical]:justify-start">
        <NavigationMenuItem>
          <NavigationMenuLink asChild>

          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild>
            <Link href="/request" className={`${THEME_COLORS.foreground} hover:text-[var(--primary)] font-medium px-3 py-2 rounded-md hover:bg-[var(--muted)] transition-colors`}>
              {t('submitRequest')}
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild>
            <Link href="/request/status" className="text-[var(--primary)] font-semibold px-3 py-2 rounded-md bg-[var(--muted)] border border-[var(--border)]">
              {t('checkStatus')}
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild>
            <Link href="/contract" className={`${THEME_COLORS.foreground} hover:text-[var(--primary)] font-medium px-3 py-2 rounded-md hover:bg-[var(--muted)] transition-colors`}>
              {t('contact')}
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}
