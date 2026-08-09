// ============================================================
// Bing Rewards - Cookie / 授权码 捕获脚本（http-response 类型）
// 功能：
//   1. 手动设置入口：http://bing.rewards.setup/?cookie=xxx&auth_code=xxx
//   2. 捕获 OAuth 授权码（login.live.com/oauth20_desktop.srf 重定向）
//   3. 捕获登录 Cookie（按域名分键存储，互不覆盖）
//
// 存储键：
//   bing_cookie_www       www.bing.com 捕获
//   bing_cookie_cn        cn.bing.com 捕获
//   bing_cookie_rewards   rewards.bing.com 捕获
//   bing_cookie           手动设置的主键（作为 fallback）
//   bing_auth_code        OAuth 授权码
// ============================================================

const url = $request.url || '';
const headers = $request.headers || {};

// 大小写不敏感地读取请求头
function getHeader(name) {
  const lower = name.toLowerCase();
  for (const k in headers) {
    if (k.toLowerCase() === lower) return headers[k];
  }
  return '';
}

const cookie = getHeader('cookie') || '';

// 按域名决定存储键
function cookieKey(u) {
  if (u.indexOf('rewards.bing.com') >= 0) return 'bing_cookie_rewards';
  if (u.indexOf('cn.bing.com') >= 0) return 'bing_cookie_cn';
  if (u.indexOf('www.bing.com') >= 0) return 'bing_cookie_www';
  return '';
}

// ---- 1. 手动设置入口（备用方案）----
if (url.indexOf('bing.rewards.setup') >= 0) {
  const params = {};
  (url.split('?')[1] || '').split('&').forEach(kv => {
    const i = kv.indexOf('=');
    if (i > 0) {
      params[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
    }
  });
  if (params.cookie) {
    $persistentStore.write(params.cookie, 'bing_cookie');
    $notification.post('Bing Rewards', '✅ 主 Cookie 已保存', '长度: ' + params.cookie.length);
  }
  ['www', 'cn', 'rewards'].forEach(dom => {
    const k = 'cookie_' + dom;
    if (params[k]) {
      $persistentStore.write(params[k], 'bing_cookie_' + dom);
    }
  });
  if (params.auth_code) {
    $persistentStore.write(params.auth_code, 'bing_auth_code');
    $notification.post('Bing Rewards', '✅ 授权码已保存', '可以运行自动任务了');
  }
  $done({});
  return; // 每个执行周期只调用一次 $done()
}

// ---- 2. 捕获 OAuth 授权码 ----
if (url.indexOf('oauth20_desktop.srf') >= 0 && url.indexOf('code=') >= 0) {
  const m = url.match(/[?&]code=([^&]+)/);
  if (m && m[1]) {
    const code = decodeURIComponent(m[1]);
    if (code.indexOf('M.') === 0) {
      $persistentStore.write(code, 'bing_auth_code');
      $notification.post('Bing Rewards', '✅ 授权码已保存', '可前往运行自动任务');
    }
  }
}

// ---- 3. 捕获登录 Cookie（按域名分键，避免互相覆盖）----
const key = cookieKey(url);
if (cookie && key) {
  $persistentStore.write(cookie, key);
}

$done({});
