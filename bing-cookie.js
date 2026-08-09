const url = $request.url || '';
const headers = $request.headers || {};

function getHeader(name) {
  const lower = name.toLowerCase();
  for (const k in headers) {
    if (k.toLowerCase() === lower) return headers[k];
  }
  return '';
}

const cookie = getHeader('cookie') || '';

function cookieKey(u) {
  if (u.indexOf('rewards.bing.com') >= 0) return 'bing_cookie_rewards';
  if (u.indexOf('cn.bing.com') >= 0) return 'bing_cookie_cn';
  if (u.indexOf('www.bing.com') >= 0) return 'bing_cookie_www';
  return '';
}

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

const key = cookieKey(url);
if (cookie && key) {
  $persistentStore.write(cookie, key);
}

$done({});
