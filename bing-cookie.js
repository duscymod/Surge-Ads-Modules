(function () {
  const url = $request.url || '';
  const headers = $request.headers || {};

  function log(msg) {
    console.log(`[BingRewards] ${msg}`);
  }

  function getHeader(obj, name) {
    const target = name.toLowerCase();

    for (const key in obj) {
      if (key.toLowerCase() === target) {
        return obj[key];
      }
    }

    return '';
  }

  function getHost(input) {
    const match = String(input).match(
      /^https?:\/\/([^/:?#]+)/i
    );

    return match ? match[1].toLowerCase() : '';
  }

  function parseQuery(input) {
    const result = {};

    const index = input.indexOf('?');

    if (index < 0) {
      return result;
    }

    const query = input
      .slice(index + 1)
      .split('#')[0];

    query.split('&').forEach(pair => {
      if (!pair) return;

      const pos = pair.indexOf('=');

      if (pos < 0) return;

      try {
        const key = decodeURIComponent(
          pair.slice(0, pos)
        );

        const value = decodeURIComponent(
          pair.slice(pos + 1)
        );

        result[key] = value;
      } catch (e) {
        log(`Query decode error: ${e}`);
      }
    });

    return result;
  }


  if (url.indexOf('bing.rewards.setup') >= 0) {
    const params = parseQuery(url);

    if (params.cookie) {
      $persistentStore.write(
        params.cookie,
        'bing_cookie'
      );

      $notification.post(
        'Bing Rewards',
        'Cookie 已保存',
        `长度 ${params.cookie.length}`
      );

      log(
        `Manual cookie saved, length=${params.cookie.length}`
      );
    }

    if (params.auth_code) {
      $persistentStore.write(
        params.auth_code,
        'bing_auth_code'
      );

      // 新授权码写入时清掉旧 token
      $persistentStore.write(
        '',
        'bing_refresh_token'
      );

      $notification.post(
        'Bing Rewards',
        '授权码已保存',
        '可以运行任务脚本'
      );

      log('OAuth code saved manually');
    }

    $done({
      response: {
        status: 200,
        body: 'ok'
      }
    });
    return;
  }


  if (
    url.indexOf(
      'login.live.com/oauth20_desktop.srf'
    ) >= 0
  ) {
    const match = url.match(
      /[?&]code=([^&#]+)/
    );

    if (match && match[1]) {
      try {
        const code = decodeURIComponent(
          match[1]
        );

        if (code.indexOf('M.') === 0) {
          $persistentStore.write(
            code,
            'bing_auth_code'
          );

          $persistentStore.write(
            '',
            'bing_refresh_token'
          );

          $notification.post(
            'Bing Rewards',
            '授权码已保存',
            'OAuth 授权完成'
          );

          log('OAuth authorization code saved');
        }
      } catch (e) {
        log(
          `OAuth code decode error: ${e}`
        );
      }
    }

    $done({});
    return;
  }


  const cookie = getHeader(
    headers,
    'cookie'
  );

  if (cookie && cookie.indexOf('_U=') >= 0) {
    const host = getHost(url);

    let key = '';

    switch (host) {
      case 'www.bing.com':
        key = 'bing_cookie_www';
        break;

      case 'cn.bing.com':
        key = 'bing_cookie_cn';
        break;

      case 'rewards.bing.com':
        key = 'bing_cookie_rewards';
        break;
    }

    if (key) {
      $persistentStore.write(
        cookie,
        key
      );

      log(
        `Cookie updated: ${host}, length=${cookie.length}`
      );
    }

  }

  $done({});
})();
