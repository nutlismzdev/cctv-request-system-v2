// src/i18n/request.ts
import {cookies} from 'next/headers'
import {getRequestConfig} from 'next-intl/server'

export default getRequestConfig(async () => {
  const store = await cookies()
  const cookieLocale = store.get('locale')?.value
  const locale = cookieLocale === 'en' ? 'en' : 'th' // default 'th'

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  }
})
