export interface AdBlockRule {
  id: string
  type: 'domain' | 'substring'
  value: string
  resourceTypes?: string[]
}

export const BUILTIN_ADBLOCK_RULES: AdBlockRule[] = [
  { id: 'google-doubleclick', type: 'domain', value: 'doubleclick.net' },
  { id: 'google-syndication', type: 'domain', value: 'googlesyndication.com' },
  { id: 'google-analytics', type: 'domain', value: 'google-analytics.com' },
  { id: 'google-tagmanager', type: 'domain', value: 'googletagmanager.com' },
  { id: 'google-tagservices', type: 'domain', value: 'googletagservices.com' },
  { id: 'google-adservice', type: 'domain', value: 'adservice.google.com' },
  { id: 'google-pagead', type: 'domain', value: 'pagead2.googlesyndication.com' },
  { id: 'facebook-net', type: 'domain', value: 'connect.facebook.net' },
  { id: 'facebook-tr', type: 'substring', value: 'facebook.com/tr' },
  { id: 'scorecard', type: 'domain', value: 'scorecardresearch.com' },
  { id: 'quantserve', type: 'domain', value: 'quantserve.com' },
  { id: 'hotjar', type: 'domain', value: 'hotjar.com' },
  { id: 'hotjar-static', type: 'domain', value: 'static.hotjar.com' },
  { id: 'amazon-ads', type: 'domain', value: 'amazon-adsystem.com' },
  { id: 'taboola', type: 'domain', value: 'taboola.com' },
  { id: 'outbrain', type: 'domain', value: 'outbrain.com' },
  { id: 'criteo', type: 'domain', value: 'criteo.com' },
  { id: 'criteo-net', type: 'domain', value: 'criteo.net' },
  { id: 'adnxs', type: 'domain', value: 'adnxs.com' },
  { id: 'rubicon', type: 'domain', value: 'rubiconproject.com' },
  { id: 'pubmatic', type: 'domain', value: 'pubmatic.com' },
  { id: 'openx', type: 'domain', value: 'openx.net' },
  { id: 'casale', type: 'domain', value: 'casalemedia.com' },
  { id: 'indexww', type: 'domain', value: 'indexww.com' },
  { id: 'adsafeprotected', type: 'domain', value: 'adsafeprotected.com' },
  { id: 'moatads', type: 'domain', value: 'moatads.com' },
  { id: 'mopub', type: 'domain', value: 'mopub.com' },
  { id: 'admob', type: 'domain', value: 'admob.com' },
  { id: 'serving-sys', type: 'domain', value: 'serving-sys.com' },
  { id: 'adform', type: 'domain', value: 'adform.net' },
  { id: 'bidswitch', type: 'domain', value: 'bidswitch.net' },
  { id: 'sharethrough', type: 'domain', value: 'sharethrough.com' },
  { id: 'baidu-cpro', type: 'domain', value: 'cpro.baidu.com' },
  { id: 'baidu-pos', type: 'domain', value: 'pos.baidu.com' },
  { id: 'baidu-hm', type: 'domain', value: 'hm.baidu.com' },
  { id: 'cnzz', type: 'domain', value: 'cnzz.com' },
  { id: 'umeng', type: 'domain', value: 'umeng.com' },
  { id: 'tanx', type: 'domain', value: 'tanx.com' },
  { id: 'mmstat', type: 'domain', value: 'mmstat.com' },
  { id: 'alimama', type: 'domain', value: 'alimama.com' },
  { id: 'sub-ads-js', type: 'substring', value: '/ads.js' },
  { id: 'sub-ad-banner', type: 'substring', value: '/ad_banner' },
  { id: 'sub-pagead', type: 'substring', value: '/pagead/' },
  { id: 'sub-show-ads', type: 'substring', value: '/show_ads' },
  { id: 'sub-adsbygoogle', type: 'substring', value: 'adsbygoogle' }
]

export function matchesAdRule(
  url: string,
  resourceType: string | undefined,
  rules: AdBlockRule[]
): AdBlockRule | null {
  let hostname = ''
  try {
    hostname = new URL(url).hostname
  } catch {
    return null
  }

  for (const rule of rules) {
    if (rule.resourceTypes?.length && resourceType && !rule.resourceTypes.includes(resourceType)) {
      continue
    }
    if (rule.type === 'domain') {
      if (hostname === rule.value || hostname.endsWith(`.${rule.value}`)) return rule
    } else if (url.includes(rule.value)) {
      return rule
    }
  }

  return null
}
