export interface Link {
  name: string
  url: string
}

export interface Category {
  name: string
  links: Link[]
}

export const DEFAULT_CATEGORIES: Category[] = [
  {
    name: '生活·常用',
    links: [
      { name: '翻译', url: 'https://fanyi.baidu.com' },
      { name: '豆包AI', url: 'https://www.doubao.com' },
      { name: '地图', url: 'https://map.baidu.com' },
      { name: '淘宝', url: 'https://www.taobao.com' },
      { name: '京东', url: 'https://www.jd.com' },
      { name: '天猫', url: 'https://www.tmall.com' },
      { name: '唯品会', url: 'https://www.vip.com' },
      { name: '邮箱', url: 'https://mail.qq.com' },
      { name: 'DeepSeek', url: 'https://chat.deepseek.com' }
    ]
  },
  {
    name: '社区·互动',
    links: [
      { name: '微信', url: 'https://weixin.qq.com' },
      { name: '微博', url: 'https://weibo.com' },
      { name: '知乎', url: 'https://www.zhihu.com' },
      { name: '抖音', url: 'https://www.douyin.com' },
      { name: '贴吧', url: 'https://tieba.baidu.com' },
      { name: '小红书', url: 'https://www.xiaohongshu.com' },
      { name: '虎扑', url: 'https://www.hupu.com' },
      { name: '豆瓣', url: 'https://www.douban.com' },
      { name: 'TapTap', url: 'https://www.taptap.cn' }
    ]
  },
  {
    name: '影音·娱乐',
    links: [
      { name: '爱奇艺', url: 'https://www.iqiyi.com' },
      { name: '腾讯视频', url: 'https://v.qq.com' },
      { name: '哔哩哔哩', url: 'https://www.bilibili.com' },
      { name: '斗鱼', url: 'https://www.douyu.com' },
      { name: '咪咕体育', url: 'https://www.migusport.com' },
      { name: 'QQ音乐', url: 'https://y.qq.com' },
      { name: '电视直播', url: 'https://tv.cctv.com/live' },
      { name: '茶杯狐', url: 'https://cupfox.app' },
      { name: '低端影视', url: 'https://ddys.pro' }
    ]
  },
  {
    name: '资讯·新闻',
    links: [
      { name: '今日头条', url: 'https://www.toutiao.com' },
      { name: '凤凰新闻', url: 'https://news.ifeng.com' },
      { name: '腾讯新闻', url: 'https://news.qq.com' },
      { name: '少数派', url: 'https://sspai.com' },
      { name: '煎蛋', url: 'https://jandan.net' },
      { name: 'AI工具集', url: 'https://ai-bot.cn' },
      { name: '趣站集合', url: 'https://fuun.fun' },
      { name: '思谋学术', url: 'https://ac.scmor.com' },
      { name: 'GitHub', url: 'https://github.com' }
    ]
  },
  {
    name: '在线·工具',
    links: [
      { name: '在线PS', url: 'https://www.photopea.com' },
      { name: '文件压缩', url: 'https://docsmall.com' },
      { name: 'OCR识别', url: 'https://web.baimiaoapp.com' },
      { name: '二维码', url: 'https://cli.im' },
      { name: '文件传输', url: 'https://airportal.cn' },
      { name: 'PDF工具', url: 'https://smallpdf.com' },
      { name: '格式转换', url: 'https://convertio.co/zh' },
      { name: '视频下载', url: 'https://snapany.com' },
      { name: '音乐下载', url: 'https://tool.liumingye.cn/music' }
    ]
  },
  {
    name: '资源·发现',
    links: [
      { name: '影视资源', url: 'https://www.btnull.org' },
      { name: '电影天堂', url: 'https://www.dy2018.com' },
      { name: '免费音乐', url: 'https://tools.liumingye.cn/music' },
      { name: 'MikuTools', url: 'https://tools.miku.ac' },
      { name: '小霸王', url: 'https://www.yikm.net' },
      { name: '果壳', url: 'https://www.guokr.com' },
      { name: '电子书', url: 'https://zh.zlibrary-global.se' },
      { name: '图片素材', url: 'https://www.pexels.com/zh-cn' },
      { name: 'Bookmate', url: 'https://bookmate.org' }
    ]
  }
]
