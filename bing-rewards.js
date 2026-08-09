// ============================================================
// Microsoft Rewards 自动任务（Surge cron 版）
// 由油猴脚本 "Get Microsoft Rewards v1.0.1.2" 转换
// 功能：签到 / 阅读 / 活动 / PC+移动搜索
//
// v1.2 修复（对照官方文档 manual.nssurge.com 逐条核实）：
//   - $httpClient 请求显式设置 auto-cookie:false（文档默认开启自动 Cookie 管理，
//     会干扰搜索时手动构造的设备 Cookie）
//
// v1.1 修复：
//   - $httpClient.request() → 官方文档列出的 per-method API
//   - timeout 单位修正为「秒」（Surge 约定）
//   - OAuth token 端点改为 POST + application/x-www-form-urlencoded
//   - 暂停时长按剩余预算自适应截断，不再与脚本超时冲突
//   - Cookie 按域名分键存储，读取时带 fallback 链
//   - updateData 失败时清空旧 dashboard
//   - 最终通知区分 成功/部分/失败
// ============================================================

// ========== 配置 ==========
const CONFIG = {
  pc: { minDelay: 15000, maxDelay: 30000 },
  mobile: { minDelay: 20000, maxDelay: 35000 },
  ua: {
    pc: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.2420.81',
    mobile: 'Mozilla/5.0 (Linux; Android 16; MCE16 Build/BP3A.250905.014) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36 EdgA/123.0.2420.102'
  },
  // 多个热搜 API 备用源（搜索关键词）
  hotApis: [
    { url: 'https://hot.baiwumm.com/api/', sources: ['weibo', 'douyin', 'baidu', 'zhihu', 'toutiao'] },
    { url: 'https://hotapi.nntool.cc/', sources: ['weibo', 'douyin', 'baidu', 'toutiao', 'zhihu'] },
    { url: 'https://cnxiaobai.com/DailyHotApi/', sources: ['weibo', 'douyin', 'baidu', 'toutiao'] }
  ],
  keywords: ["天气预报", "今日新闻", "体育赛事", "股票行情", "电影推荐", "科技资讯", "美食食谱", "旅游攻略"],
  pause: {
    enabled: true,           // 暂停机制（降低风控风险）
    interval: 10,            // 每 N 次搜索后暂停
    duration: 3 * 60 * 1000  // 目标暂停时长；实际按剩余预算截断
  },
  timeBudget: 8 * 60 * 1000  // 单次运行时间预算（配合模块 timeout=600 秒，预留余量）
};

// ========== 存储（GM_setValue/GM_getValue 替代）==========
const store = {
  get: k => $persistentStore.read(k) || '',
  set: (k, v) => $persistentStore.write(String(v), k)
};

// ========== 工具函数 ==========
const sleep = ms => new Promise(r => setTimeout(r, ms));
const randomPick = arr => arr[Math.floor(Math.random() * arr.length)];
const randomRange = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getDateStr = () => {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
};
const getDateHyphen = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0;
  const v = c === 'x' ? r : (r & 0x3 | 0x8);
  return v.toString(16);
});

const log = msg => console.log(`[${new Date().toLocaleTimeString().slice(0, 8)}] ${msg}`);

// ========== HTTP 封装（GM_xmlhttpRequest 替代）==========
// Surge 的 $httpClient 只有 get/post/put/delete/head/options/patch，
// 没有通用的 .request()；timeout 单位为「秒」（默认 5 秒）。
const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'head', 'options', 'patch'];

function httpRequest(options) {
  const method = (options.method || 'GET').toLowerCase();
  const retries = options.retries ?? 2;
  const retryDelay = options.retryDelay ?? 1000;
  let attempt = 0;

  const shouldRetry = err => {
    const status = err && err.status ? err.status : 0;
    return status === 0 || status === 429 || status >= 500 || /timeout/i.test(String(err && err.message));
  };

  const doOnce = () => new Promise((resolve, reject) => {
    if (HTTP_METHODS.indexOf(method) < 0) {
      return reject(new Error('unsupported method: ' + method));
    }
    const opts = {
      url: options.url,
      headers: options.headers || {},
      timeout: Math.ceil((options.timeout || 20000) / 1000), // 毫秒 → 秒
      // 显式关闭自动 Cookie 管理（文档默认开启）：本脚本的 Cookie 全部手动构造
      // （搜索时需要精确控制设备 Cookie _Rwho），不能被 Surge 自动追加/覆盖
      'auto-cookie': false
    };
    if (options.data || options.body) opts.body = options.data || options.body;

    $httpClient[method](opts, (err, resp, data) => {
      if (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        e.status = 0;
        return reject(e);
      }
      const status = resp && resp.status ? resp.status : 0;
      if (status >= 200 && status < 300) {
        resolve(options.returnUrl ? (resp.finalUrl || resp.url || opts.url) : data);
      } else if (status >= 300 && status < 400) {
        const loc = (resp.headers && (resp.headers.Location || resp.headers.location)) || '';
        resolve(loc || data);
      } else {
        const e = new Error(`HTTP ${status}`);
        e.status = status;
        e.responseText = data;
        reject(e);
      }
    });
  });

  return (async () => {
    while (true) {
      try {
        return await doOnce();
      } catch (e) {
        if (attempt >= retries || !shouldRetry(e)) throw e;
        const delay = retryDelay * Math.pow(2, attempt);
        attempt++;
        await sleep(delay + randomRange(0, 250));
      }
    }
  })();
}

// ========== Cookie 按域名读取（fallback 链）==========
// 捕获端（bing-cookie.js）按域名分键存储，读取时按优先级回退，
// 避免"最后访问哪个域名就覆盖谁"的问题。
const COOKIE_KEYS = {
  rewards: ['bing_cookie_rewards', 'bing_cookie', 'bing_cookie_www', 'bing_cookie_cn'],
  www: ['bing_cookie_www', 'bing_cookie', 'bing_cookie_cn', 'bing_cookie_rewards'],
  cn: ['bing_cookie_cn', 'bing_cookie', 'bing_cookie_www', 'bing_cookie_rewards']
};

function getCookieFor(domain) {
  const keys = COOKIE_KEYS[domain] || ['bing_cookie'];
  for (const k of keys) {
    const v = store.get(k);
    if (v) return v;
  }
  return '';
}

// ========== 热搜词（多源自动切换）==========
async function getHotQuery() {
  const apis = [...CONFIG.hotApis].sort(() => Math.random() - 0.5);
  for (const api of apis) {
    try {
      const src = randomPick(api.sources);
      const res = await httpRequest({ method: 'GET', url: api.url + src, timeout: 8000 });
      const data = JSON.parse(res);
      if (data.code === 200 && data.data && data.data.length) {
        const title = randomPick(data.data).title || '';
        const len = randomRange(8, 25);
        return title.substring(0, len);
      }
    } catch (e) { /* 尝试下一个 API */ }
  }
  return `${randomPick(CONFIG.keywords)} ${Math.random().toString(36).slice(2, 6)}`;
}

// ========== 状态 ==========
let state = {
  level: 1, points: 0,
  pcCur: 0, pcMax: 0,
  mobileCur: 0, mobileMax: 0,
  readCur: 0, readMax: 0,
  searchCount: 0
};
let dashboard = null; // 失败时会被清空，防止旧数据被误用

// ========== 搜索进度保存/恢复 ==========
function saveProgress() {
  store.set('bing_search_progress', JSON.stringify({ date: getDateHyphen(), searchCount: state.searchCount }));
}
function loadProgress() {
  try {
    const saved = JSON.parse(store.get('bing_search_progress'));
    if (saved && saved.date === getDateHyphen()) {
      state.searchCount = saved.searchCount || 0;
    }
  } catch (e) { }
}

// ========== 数据刷新（失败返回 false 并清空旧数据）==========
async function updateData() {
  dashboard = null; // 先清空，失败时不残留旧状态
  try {
    const res = await httpRequest({
      url: `https://rewards.bing.com/api/getuserinfo?type=1&X-Requested-With=XMLHttpRequest&_=${Date.now()}`,
      headers: {
        'Cookie': getCookieFor('rewards'),
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': 'https://rewards.bing.com/',
        'User-Agent': CONFIG.ua.pc
      }
    });
    const data = JSON.parse(res);
    dashboard = data.dashboard || data;
    if (!dashboard || !dashboard.userStatus) {
      log('⚠️ 未获取到用户数据，请确认 Cookie 是否有效/已登录');
      return false;
    }
    const user = dashboard.userStatus || {};
    const rawLevel = (user.levelInfo && user.levelInfo.activeLevel) || 'Level1';
    state.level = parseInt(String(rawLevel).replace(/\D/g, '')) || 1;
    state.points = user.availablePoints || 0;

    const c = user.counters || {};
    let pc = 0, pcM = 0, mob = 0, mobM = 0;
    if (c.pcSearch) c.pcSearch.forEach(i => { pc += i.pointProgress || 0; pcM += i.pointProgressMax || i.pointMax || 0; });
    if (c.mobileSearch) c.mobileSearch.forEach(i => { mob += i.pointProgress || 0; mobM += i.pointProgressMax || i.pointMax || 0; });
    if (mobM === 0 && state.level > 1) mobM = 60;
    if (pcM === 0) pcM = state.level > 1 ? 150 : 90;

    state.pcCur = pc; state.pcMax = pcM;
    state.mobileCur = mob; state.mobileMax = mobM;
    log(`✓ 数据已更新: Lv.${state.level} ${state.points}pts | PC ${pc}/${pcM} 移动 ${mob}/${mobM}`);
    return true;
  } catch (e) {
    log(`⚠️ 获取数据出错: ${e.message}`);
    return false;
  }
}

// ========== OAuth Token（活动/签到/阅读用）==========
// 官方端点要求 POST + application/x-www-form-urlencoded
const AUTH_URL = 'https://login.live.com/oauth20_authorize.srf?client_id=0000000040170455&scope=service::prod.rewardsplatform.microsoft.com::MBI_SSL&response_type=code&redirect_uri=https://login.live.com/oauth20_desktop.srf';
const TOKEN_URL = 'https://login.live.com/oauth20_token.srf';
const TOKEN_SCOPE = 'service%3A%2F%2Fprod.rewardsplatform.microsoft.com%3A%3AMBI_SSL';

let accessToken = null;
let accessTokenExpiresAt = 0;

async function getAccessToken(forceRefresh) {
  const now = Date.now();
  if (!forceRefresh && accessToken && accessTokenExpiresAt && now < accessTokenExpiresAt - 60000) {
    return accessToken;
  }
  if (forceRefresh) { accessToken = null; accessTokenExpiresAt = 0; }

  const code = store.get('bing_auth_code');
  if (!code) {
    log('⚠️ 未找到授权码，请先完成授权（打开下方链接并登录）');
    $notification.post('Bing Rewards', '⚠️ 需要授权', AUTH_URL);
    return null;
  }

  const refreshToken = store.get('bing_refresh_token');
  const body = refreshToken
    ? `grant_type=refresh_token&client_id=0000000040170455&scope=${TOKEN_SCOPE}&refresh_token=${encodeURIComponent(refreshToken)}`
    : `grant_type=authorization_code&client_id=0000000040170455&scope=${TOKEN_SCOPE}&code=${encodeURIComponent(code)}&redirect_uri=https%3A%2F%2Flogin.live.com%2Foauth20_desktop.srf`;

  try {
    const res = await httpRequest({
      method: 'POST',
      url: TOKEN_URL,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': CONFIG.ua.pc
      },
      data: body
    });
    const data = JSON.parse(res);
    if (data.access_token) {
      accessToken = data.access_token;
      accessTokenExpiresAt = data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : 0;
      if (data.refresh_token) store.set('bing_refresh_token', data.refresh_token);
      return data.access_token;
    } else if (data.error) {
      log(`Token 失效（${data.error}），请重新授权`);
      store.set('bing_refresh_token', '');
      store.set('bing_auth_code', '');
      accessToken = null;
      accessTokenExpiresAt = 0;
      $notification.post('Bing Rewards', '⚠️ Token 失效', '请重新授权');
    }
  } catch (e) {
    log('Auth Error: ' + e.message);
  }
  return null;
}

async function withAccessTokenRequest(requestFn) {
  let token = await getAccessToken(false);
  if (!token) return null;
  try {
    return await requestFn(token);
  } catch (e) {
    if (e && e.status === 401) {
      accessToken = null;
      accessTokenExpiresAt = 0;
      token = await getAccessToken(true);
      if (!token) throw e;
      return await requestFn(token);
    }
    throw e;
  }
}

// ========== 任务结果统计（用于最终通知）==========
const results = {};
const statusIcon = s => ({ ok: '✅', partial: '⚠️', skip: '⏭️', fail: '❌' }[s] || '❓');

// ========== 签到 ==========
async function runSign() {
  log('⏳ 签到中...');
  try {
    const res = await withAccessTokenRequest(token => httpRequest({
      method: 'POST',
      url: 'https://prod.rewardsplatform.microsoft.com/dapi/me/activities',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Rewards-AppId': 'SAAndroid/31.4.2110003555',
        'X-Rewards-IsMobile': 'true',
        'X-Rewards-Country': 'cn'
      },
      data: JSON.stringify({
        amount: 1, id: uuid(), type: 103, country: 'cn',
        attributes: {}, risk_context: {}, channel: 'SAAndroid'
      })
    }));
    if (!res) { results.sign = 'skip'; return; }
    const d = JSON.parse(res);
    if (d.response && d.response.activity) {
      log(`✅ 签到成功 +${d.response.activity.p}分`);
      results.sign = 'ok';
    } else {
      log('⚠️ 已签到或签到失败');
      results.sign = 'partial';
    }
  } catch (e) {
    log(`❌ 签到出错: ${e.message}`);
    results.sign = 'fail';
  }
}

// ========== 阅读任务 ==========
async function runRead() {
  log('⏳ 开始阅读任务...');
  try {
    const info = await withAccessTokenRequest(token => httpRequest({
      url: 'https://prod.rewardsplatform.microsoft.com/dapi/me?channel=SAAndroid&options=613',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Rewards-AppId': 'SAAndroid/31.4.2110003555',
        'X-Rewards-IsMobile': 'true'
      }
    }));
    if (!info) { results.read = 'skip'; return; }
    const d = JSON.parse(info);
    const p = d.response && d.response.promotions && d.response.promotions.find(x => x.attributes && x.attributes.offerid === 'ENUS_readarticle3_30points');
    if (!p) { log('ℹ️ 未找到阅读任务'); results.read = 'skip'; return; }
    const cur = +p.attributes.progress, max = +p.attributes.max;
    state.readCur = cur; state.readMax = max;
    if (cur >= max) { log('✅ 阅读任务已完成'); results.read = 'ok'; return; }
    for (let i = cur; i < max; i++) {
      log(`📖 阅读文章 ${i + 1}/${max}`);
      await withAccessTokenRequest(token => httpRequest({
        method: 'POST',
        url: 'https://prod.rewardsplatform.microsoft.com/dapi/me/activities',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Rewards-AppId': 'SAAndroid/31.4.2110003555',
          'X-Rewards-IsMobile': 'true',
          'X-Rewards-Country': 'cn'
        },
        data: JSON.stringify({
          amount: 1, country: 'cn', id: uuid(), type: 101,
          attributes: { offerid: 'ENUS_readarticle3_30points' }
        })
      }));
      await sleep(2500);
      state.readCur++;
    }
    log('✅ 阅读完成');
    results.read = 'ok';
  } catch (e) {
    log(`❌ 阅读出错: ${e.message}`);
    results.read = 'fail';
  }
}

// ========== 活动任务 ==========
async function getSearchToken() {
  try {
    const html = await httpRequest({
      url: 'https://rewards.bing.com/',
      headers: { 'Cookie': getCookieFor('rewards'), 'User-Agent': CONFIG.ua.pc }
    });
    const m = html.match(/RequestVerificationToken.*?value="([^"]+)"/) || html.match(/"verificationToken":\s*"([^"]+)"/);
    return m ? m[1] : null;
  } catch (e) {
    return null;
  }
}

async function runPromo() {
  log('⏳ 开始执行活动...');
  const ok = await updateData();
  if (!ok) { results.promo = 'fail'; return; }
  if (!dashboard) { results.promo = 'fail'; return; }

  const token = await getSearchToken();
  if (!token) { log('⚠️ 未获取到活动 Token，请刷新 Cookie 后重试'); results.promo = 'fail'; return; }

  const cookie = getCookieFor('rewards');
  const today = getDateStr();
  let taskList = [];

  if (dashboard.dailySetPromotions && dashboard.dailySetPromotions[today]) {
    taskList.push(...dashboard.dailySetPromotions[today]);
    log(`📅 检测到 ${dashboard.dailySetPromotions[today].length} 个每日任务`);
  }
  if (dashboard.morePromotions) taskList.push(...dashboard.morePromotions);

  taskList = taskList.filter(p => !p.complete && p.priority > -2 && p.exclusiveLockedFeatureStatus !== 'locked');
  if (taskList.length === 0) { log('✅ 所有活动已完成！'); results.promo = 'ok'; return; }

  let count = 0, failed = 0;
  for (const p of taskList) {
    try {
      log(`▶️ 执行: ${p.title}`);
      // 请求1: 标准 ReportActivity
      await httpRequest({
        method: 'POST',
        url: 'https://rewards.bing.com/api/reportactivity?X-Requested-With=XMLHttpRequest',
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://rewards.bing.com/',
          'User-Agent': CONFIG.ua.pc
        },
        data: `id=${p.offerId}&hash=${p.hash}&activityAmount=1&__RequestVerificationToken=${token}`
      });
      // 请求2: V1 API（Quiz 类型上报，帮助触发任务完成）
      await httpRequest({
        method: 'POST',
        url: 'https://www.bing.com/msrewards/api/v1/ReportActivity?ajaxreq=1',
        headers: {
          'Cookie': getCookieFor('www'),
          'Content-Type': 'application/json',
          'User-Agent': CONFIG.ua.pc
        },
        data: JSON.stringify({
          "ActivitySubType": "quiz",
          "ActivityType": "notification",
          "OfferId": p.offerId,
          "Channel": "Bing.Com",
          "PartnerId": "BingTrivia",
          "Timezone": -480
        })
      });
      await sleep(randomRange(1500, 3000));
      count++;
    } catch (e) {
      failed++;
      log(`❌ 活动执行失败: ${e.message}`);
    }
  }
  log(`✅ 完成尝试，共执行 ${count} 个活动，失败 ${failed} 个`);
  results.promo = failed === 0 ? (count === taskList.length ? 'ok' : 'partial') : 'partial';
  await updateData();
}

// ========== 搜索任务 ==========
async function doSearch(query, isMobile) {
  const host = isMobile ? 'cn.bing.com' : 'www.bing.com';
  const ua = isMobile ? CONFIG.ua.mobile : CONFIG.ua.pc;
  const deviceCookie = `_Rwho=u=${isMobile ? 'm' : 'd'}&ts=${getDateHyphen()}`;
  const searchUrl = `https://${host}/search?q=${encodeURIComponent(query)}&form=QBLH`;

  // 基础 cookie 去掉设备相关项，注入本次设备标识（模拟原脚本的删 cookie 逻辑）
  const baseCookie = getCookieFor(isMobile ? 'cn' : 'www').replace(/_(EDGE_S|Rwho|RwBf)=[^;]*;?\s*/g, '');
  const fullCookie = (deviceCookie + '; ' + baseCookie).replace(/;\s*$/, '');

  const headers = {
    'User-Agent': ua,
    'Cookie': fullCookie,
    'Referer': `https://${host}/?form=QBLH`
  };

  try {
    // 1. 搜索
    const searchResult = await httpRequest({ url: searchUrl, headers });
    // 提取 IG 参数用于上报
    const igMatch = searchResult.match(/,IG:"([^"]+)"/);
    const ig = igMatch ? igMatch[1] : uuid().replace(/-/g, '').toUpperCase();

    // 2. ncheader（计分核心之一）
    try {
      await httpRequest({
        method: 'POST',
        url: `https://${host}/rewardsapp/ncheader?ver=88888888&IID=SERP.5047&IG=${ig}&ajaxreq=1`,
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        data: 'wb=1%3bi%3d1%3bv%3d1'
      });
    } catch (e) {
      log(`⚠️ ncheader 失败: ${e.message}`);
    }

    // 3. reportActivity
    await httpRequest({
      method: 'POST',
      url: `https://${host}/rewardsapp/reportActivity?IG=${ig}&IID=SERP.5047&q=${encodeURIComponent(query)}&ajaxreq=1`,
      headers: { ...headers, 'Referer': searchUrl, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      data: `url=${encodeURIComponent(searchUrl)}&V=web`
    });

    log(`✓ ${isMobile ? '📱' : '💻'} "${query.substring(0, 15)}..."`);
  } catch (e) {
    log(`✗ 搜索失败: ${e.message}`);
  }
}

async function runSearch() {
  const ok = await updateData();
  if (!ok) { results.search = 'fail'; return; }

  const pcNeed = Math.ceil((state.pcMax - state.pcCur) / 3);
  const mobNeed = Math.ceil((state.mobileMax - state.mobileCur) / 3);
  if (pcNeed <= 0 && mobNeed <= 0) { log('✅ 今日搜索已完成'); results.search = 'ok'; return; }

  const startTime = Date.now();
  const withinBudget = () => Date.now() - startTime < CONFIG.timeBudget;

  // 暂停机制：时长按剩余预算自适应截断，避免 sleep 超过脚本超时
  const maybePause = async () => {
    if (!CONFIG.pause.enabled || state.searchCount % CONFIG.pause.interval !== 0) return;
    const remaining = CONFIG.timeBudget - (Date.now() - startTime);
    const pauseMs = Math.min(CONFIG.pause.duration, Math.max(0, remaining - 15000));
    if (pauseMs < 1000) { log('⏭️ 预算不足，跳过本轮暂停'); return; }
    log(`⏸️ 已搜索 ${state.searchCount} 次，暂停 ${Math.round((pauseMs / 60000) * 10) / 10} 分钟...`);
    await sleep(pauseMs);
  };

  loadProgress();
  log(`📊 当前搜索计数: ${state.searchCount}`);

  let truncated = false;

  // ---- PC 搜索 ----
  if (pcNeed > 0) {
    log(`💻 PC搜索 ${pcNeed} 次`);
    for (let i = 0; i < pcNeed && withinBudget(); i++) {
      const q = await getHotQuery();
      await doSearch(q, false);
      state.searchCount++;
      saveProgress();
      await maybePause();
      if (!withinBudget()) { truncated = true; break; }
      await sleep(randomRange(CONFIG.pc.minDelay, CONFIG.pc.maxDelay));
      if ((i + 1) % 3 === 0) await updateData();
    }
  }

  // ---- 移动搜索 ----
  if (mobNeed > 0 && withinBudget()) {
    log(`📱 移动搜索 ${mobNeed} 次`);
    for (let i = 0; i < mobNeed && withinBudget(); i++) {
      const q = await getHotQuery();
      await doSearch(q, true);
      state.searchCount++;
      saveProgress();
      await maybePause();
      if (!withinBudget()) { truncated = true; break; }
      await sleep(randomRange(CONFIG.mobile.minDelay, CONFIG.mobile.maxDelay));
      if ((i + 1) % 3 === 0) await updateData();
    }
  }

  await updateData();
  saveProgress();
  if (truncated) {
    log('🏁 搜索结束（到达时间预算，剩余进度下轮继续）');
    results.search = 'partial';
  } else {
    log('🏁 搜索结束');
    results.search = 'ok';
  }
}

// ========== 主流程 ==========
(async () => {
  log('🚀 Bing Rewards 自动任务开始');
  if (!getCookieFor('rewards') && !getCookieFor('www') && !getCookieFor('cn')) {
    log('⚠️ 未找到 Cookie：请先通过 Surge 访问一次 bing.com（或用手动设置 URL）');
    $notification.post('Bing Rewards', '⚠️ 未找到 Cookie', '请先登录 bing.com 并浏览一次');
    $done();
    return;
  }
  try {
    await runSign();
    await runRead();
    await runPromo();
    await runSearch();
  } catch (e) {
    log(`❌ 任务异常: ${e.message}`);
  }

  // 按实际结果区分通知级别
  const tasks = ['sign', 'read', 'promo', 'search'];
  const nFail = tasks.filter(k => results[k] === 'fail').length;
  const nOk = tasks.filter(k => results[k] === 'ok').length;
  const title = nFail > 0
    ? '❌ 部分任务失败'
    : (nOk === tasks.length ? '✅ 今日任务全部完成' : '⚠️ 任务未完全执行');
  const body =
    `签到${statusIcon(results.sign)} 阅读${statusIcon(results.read)} ` +
    `活动${statusIcon(results.promo)} 搜索${statusIcon(results.search)} | ` +
    `${state.points} pts | PC ${state.pcCur}/${state.pcMax}`;
  $notification.post('Bing Rewards', title, body);
  log(`✅ 全部任务结束（${title}）`);
  $done();
})();
