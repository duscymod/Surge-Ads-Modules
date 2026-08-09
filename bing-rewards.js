const CONFIG = {
  pc: {
    minDelay: 15,
    maxDelay: 30
  },

  mobile: {
    minDelay: 20,
    maxDelay: 35
  },

  ua: {
    pc:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/123.0.0.0 Safari/537.36 ' +
      'Edg/123.0.2420.81',

    mobile:
      'Mozilla/5.0 (Linux; Android 16; MCE16 Build/BP3A.250905.014) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/123.0.0.0 Mobile Safari/537.36 ' +
      'EdgA/123.0.2420.102'
  },

  hotApis: [
    {
      url: 'https://hot.baiwumm.com/api/',
      sources: [
        'weibo',
        'douyin',
        'baidu',
        'zhihu',
        'toutiao'
      ]
    },

    {
      url: 'https://hotapi.nntool.cc/',
      sources: [
        'weibo',
        'douyin',
        'baidu',
        'toutiao',
        'zhihu'
      ]
    },

    {
      url: 'https://cnxiaobai.com/DailyHotApi/',
      sources: [
        'weibo',
        'douyin',
        'baidu',
        'toutiao'
      ]
    }
  ],

  keywords: [
    '天气预报',
    '今日新闻',
    '体育赛事',
    '股票行情',
    '电影推荐',
    '科技资讯',
    '美食食谱',
    '旅游攻略'
  ],

  timeBudget: 8 * 60 * 1000,

  requestTimeout: 20,

  retries: 2
};


// ============================================================
// Persistent Store
// ============================================================

const store = {

  get(key) {
    return $persistentStore.read(key) || '';
  },

  set(key, value) {
    return $persistentStore.write(
      String(value),
      key
    );
  }

};



function log(message) {
  console.log(
    `[${new Date()
      .toLocaleTimeString()
      .slice(0, 8)}] ${message}`
  );
}


function sleep(seconds) {
  return new Promise(resolve => {
    setTimeout(
      resolve,
      seconds * 1000
    );
  });
}


function randomPick(array) {
  return array[
    Math.floor(
      Math.random() * array.length
    )
  ];
}


function randomRange(min, max) {
  return (
    Math.floor(
      Math.random() *
      (max - min + 1)
    ) + min
  );
}


function getDateStr() {
  const d = new Date();

  return (
    `${d.getMonth() + 1}/` +
    `${d.getDate()}/` +
    `${d.getFullYear()}`
  );
}


function getDateHyphen() {
  const d = new Date();

  return (
    `${d.getFullYear()}-` +
    `${String(
      d.getMonth() + 1
    ).padStart(2, '0')}-` +
    `${String(
      d.getDate()
    ).padStart(2, '0')}`
  );
}


function uuid() {
  return (
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
  ).replace(/[xy]/g, c => {

    const r =
      Math.random() * 16 | 0;

    const v =
      c === 'x'
        ? r
        : (r & 0x3 | 0x8);

    return v.toString(16);

  });
}


function formEncode(object) {
  return Object.keys(object)
    .filter(
      key =>
        object[key] !== undefined &&
        object[key] !== null
    )
    .map(
      key =>
        encodeURIComponent(key) +
        '=' +
        encodeURIComponent(
          String(object[key])
        )
    )
    .join('&');
}



function getCookie(host) {

  if (host === 'rewards.bing.com') {
    return (
      store.get(
        'bing_cookie_rewards'
      ) ||
      store.get(
        'bing_cookie_www'
      ) ||
      store.get(
        'bing_cookie'
      )
    );
  }

  if (host === 'cn.bing.com') {
    return (
      store.get(
        'bing_cookie_cn'
      ) ||
      store.get(
        'bing_cookie_www'
      ) ||
      store.get(
        'bing_cookie'
      )
    );
  }

  return (
    store.get(
      'bing_cookie_www'
    ) ||
    store.get(
      'bing_cookie'
    )
  );
}



function httpRequest(options) {

  const method =
    String(
      options.method || 'GET'
    ).toUpperCase();

  const retries =
    options.retries ??
    CONFIG.retries;

  let attempt = 0;


  function requestOnce() {

    return new Promise(
      (resolve, reject) => {

        const request = {

          url: options.url,

          headers:
            options.headers || {},

          timeout:
            options.timeout ||
            CONFIG.requestTimeout,

          'auto-cookie': false

        };


        if (
          options.body !== undefined
        ) {

          request.body =
            options.body;

        }


        const callback =
          (error, response, data) => {

            if (error) {

              const err =
                new Error(
                  String(error)
                );

              err.status = 0;

              reject(err);

              return;
            }


            const status =
              response &&
              response.status
                ? response.status
                : 0;


            if (
              status >= 200 &&
              status < 300
            ) {

              resolve({
                status,
                headers:
                  response.headers || {},
                body:
                  data || '',
                url:
                  response.url ||
                  options.url
              });

              return;
            }


            const err =
              new Error(
                `HTTP ${status}`
              );

            err.status =
              status;

            err.responseText =
              data || '';

            reject(err);
          };


        switch (method) {

          case 'GET':
            $httpClient.get(
              request,
              callback
            );
            break;

          case 'POST':
            $httpClient.post(
              request,
              callback
            );
            break;

          case 'PUT':
            $httpClient.put(
              request,
              callback
            );
            break;

          case 'DELETE':
            $httpClient.delete(
              request,
              callback
            );
            break;

          case 'PATCH':
            $httpClient.patch(
              request,
              callback
            );
            break;

          case 'HEAD':
            $httpClient.head(
              request,
              callback
            );
            break;

          default:

            reject(
              new Error(
                `Unsupported HTTP method: ${method}`
              )
            );
        }

      }
    );
  }


  function shouldRetry(error) {

    const status =
      error &&
      error.status
        ? error.status
        : 0;

    return (
      status === 0 ||
      status === 429 ||
      status >= 500
    );
  }


  return (async () => {

    while (true) {

      try {

        return await requestOnce();

      } catch (error) {

        if (
          attempt >= retries ||
          !shouldRetry(error)
        ) {

          throw error;
        }


        const delay =
          Math.pow(
            2,
            attempt
          );

        attempt++;

        log(
          `HTTP 重试 ${attempt}/${retries}`
        );

        await sleep(
          delay
        );
      }

    }

  })();
}



async function getHotQuery() {

  const apis =
    CONFIG.hotApis.slice();

  apis.sort(
    () =>
      Math.random() - 0.5
  );


  for (const api of apis) {

    try {

      const source =
        randomPick(
          api.sources
        );

      const response =
        await httpRequest({

          url:
            api.url +
            source,

          timeout: 8

        });


      const data =
        JSON.parse(
          response.body
        );


      if (
        data.code === 200 &&
        Array.isArray(
          data.data
        ) &&
        data.data.length
      ) {

        const item =
          randomPick(
            data.data
          );

        const title =
          String(
            item.title || ''
          );

        if (title) {

          return title.substring(
            0,
            randomRange(
              8,
              25
            )
          );
        }
      }

    } catch (_) {
      // next source
    }

  }


  return (
    randomPick(
      CONFIG.keywords
    ) +
    ' ' +
    Math.random()
      .toString(36)
      .slice(2, 6)
  );
}



let state = {

  level: 1,

  points: 0,

  pcCur: 0,
  pcMax: 0,

  mobileCur: 0,
  mobileMax: 0,

  readCur: 0,
  readMax: 0,

  searchCount: 0

};


let dashboard = null;



function saveProgress() {

  store.set(

    'bing_search_progress',

    JSON.stringify({

      date:
        getDateHyphen(),

      searchCount:
        state.searchCount

    })

  );
}


function loadProgress() {

  try {

    const raw =
      store.get(
        'bing_search_progress'
      );

    if (!raw) return;


    const saved =
      JSON.parse(raw);


    if (
      saved &&
      saved.date ===
        getDateHyphen()
    ) {

      state.searchCount =
        Number(
          saved.searchCount
        ) || 0;

    } else {

      state.searchCount = 0;

    }

  } catch (_) {

    state.searchCount = 0;

  }
}


async function updateData() {

  dashboard = null;

  const cookie =
    getCookie(
      'rewards.bing.com'
    );


  if (!cookie) {

    log(
      '未找到 Rewards Cookie'
    );

    return false;
  }


  try {

    const response =
      await httpRequest({

        url:
          'https://rewards.bing.com/api/getuserinfo' +
          '?type=1' +
          '&X-Requested-With=XMLHttpRequest' +
          '&_=' +
          Date.now(),

        headers: {

          Cookie:
            cookie,

          'X-Requested-With':
            'XMLHttpRequest',

          'Content-Type':
            'application/x-www-form-urlencoded; charset=UTF-8',

          Referer:
            'https://rewards.bing.com/',

          'User-Agent':
            CONFIG.ua.pc
        }

      });


    const data =
      JSON.parse(
        response.body
      );


    dashboard =
      data.dashboard ||
      data;


    if (
      !dashboard ||
      !dashboard.userStatus
    ) {

      dashboard = null;

      log(
        '未获取到用户数据，请检查 Cookie'
      );

      return false;
    }


    const user =
      dashboard.userStatus;


    const levelText =
      (
        user.levelInfo &&
        user.levelInfo.activeLevel
      ) ||
      'Level1';


    state.level =
      parseInt(
        String(
          levelText
        ).replace(
          /\D/g,
          ''
        ),
        10
      ) || 1;


    state.points =
      Number(
        user.availablePoints
      ) || 0;


    const counters =
      user.counters || {};


    let pc = 0;
    let pcMax = 0;

    let mobile = 0;
    let mobileMax = 0;


    if (
      Array.isArray(
        counters.pcSearch
      )
    ) {

      counters.pcSearch.forEach(
        item => {

          pc +=
            Number(
              item.pointProgress
            ) || 0;

          pcMax +=
            Number(
              item.pointProgressMax ??
              item.pointMax
            ) || 0;

        }
      );
    }


    if (
      Array.isArray(
        counters.mobileSearch
      )
    ) {

      counters.mobileSearch.forEach(
        item => {

          mobile +=
            Number(
              item.pointProgress
            ) || 0;

          mobileMax +=
            Number(
              item.pointProgressMax ??
              item.pointMax
            ) || 0;

        }
      );
    }


    if (
      mobileMax === 0 &&
      state.level > 1
    ) {

      mobileMax = 60;
    }


    if (pcMax === 0) {

      pcMax =
        state.level > 1
          ? 150
          : 90;
    }


    state.pcCur = pc;
    state.pcMax = pcMax;

    state.mobileCur =
      mobile;

    state.mobileMax =
      mobileMax;


    log(
      `数据更新：Lv.${state.level} ` +
      `${state.points}pts | ` +
      `PC ${pc}/${pcMax} | ` +
      `移动 ${mobile}/${mobileMax}`
    );


    return true;

  } catch (error) {

    dashboard = null;

    log(
      `获取数据失败：${error.message}`
    );

    return false;
  }
}



const CLIENT_ID =
  '0000000040170455';


const SCOPE =
  'service::prod.rewardsplatform.microsoft.com::MBI_SSL';


const REDIRECT_URI =
  'https://login.live.com/oauth20_desktop.srf';


const TOKEN_URL =
  'https://login.live.com/oauth20_token.srf';


const AUTH_URL =
  'https://login.live.com/oauth20_authorize.srf' +
  '?client_id=' +
  encodeURIComponent(
    CLIENT_ID
  ) +
  '&scope=' +
  encodeURIComponent(
    SCOPE
  ) +
  '&response_type=code' +
  '&redirect_uri=' +
  encodeURIComponent(
    REDIRECT_URI
  );


let accessToken = '';

let accessTokenExpiresAt = 0;


async function getAccessToken(
  forceRefresh = false
) {

  const now =
    Date.now();


  if (
    !forceRefresh &&
    accessToken &&
    accessTokenExpiresAt &&
    now <
      accessTokenExpiresAt -
      60000
  ) {

    return accessToken;
  }


  const refreshToken =
    store.get(
      'bing_refresh_token'
    );


  const authCode =
    store.get(
      'bing_auth_code'
    );


  if (
    !refreshToken &&
    !authCode
  ) {

    log(
      '没有授权码或 Refresh Token'
    );

    $notification.post(
      'Bing Rewards',
      '需要授权',
      AUTH_URL
    );

    return null;
  }


  const body =
    refreshToken

      ? {

          client_id:
            CLIENT_ID,

          refresh_token:
            refreshToken,

          scope:
            SCOPE,

          redirect_uri:
            REDIRECT_URI,

          grant_type:
            'refresh_token'

        }

      : {

          client_id:
            CLIENT_ID,

          code:
            authCode,

          scope:
            SCOPE,

          redirect_uri:
            REDIRECT_URI,

          grant_type:
            'authorization_code'

        };


  try {

    const response =
      await httpRequest({

        method: 'POST',

        url:
          TOKEN_URL,

        headers: {

          'Content-Type':
            'application/x-www-form-urlencoded'

        },

        body:
          formEncode(body),

        timeout: 20,

        retries: 1

      });


    const data =
      JSON.parse(
        response.body
      );


    if (
      !data.access_token
    ) {

      log(
        `OAuth 失败：${
          data.error ||
          'unknown error'
        }`
      );

      return null;
    }


    accessToken =
      data.access_token;


    accessTokenExpiresAt =
      Date.now() +
      (
        Number(
          data.expires_in
        ) || 3600
      ) *
      1000;


    if (
      data.refresh_token
    ) {

      store.set(
        'bing_refresh_token',
        data.refresh_token
      );
    }


    return accessToken;

  } catch (error) {

    log(
      `OAuth Error：${error.message}`
    );

    return null;
  }
}


async function withAccessTokenRequest(
  fn
) {

  let token =
    await getAccessToken(
      false
    );


  if (!token) {

    return null;
  }


  try {

    return await fn(
      token
    );

  } catch (error) {

    if (
      error &&
      error.status === 401
    ) {

      accessToken = '';

      accessTokenExpiresAt = 0;


      token =
        await getAccessToken(
          true
        );


      if (!token) {

        throw error;
      }


      return await fn(
        token
      );
    }


    throw error;
  }
}



async function runSign() {

  log(
    '开始签到'
  );


  try {

    const response =
      await withAccessTokenRequest(

        token =>
          httpRequest({

            method: 'POST',

            url:
              'https://prod.rewardsplatform.microsoft.com/dapi/me/activities',

            headers: {

              Authorization:
                `Bearer ${token}`,

              'Content-Type':
                'application/json',

              'X-Rewards-AppId':
                'SAAndroid/31.4.2110003555',

              'X-Rewards-IsMobile':
                'true',

              'X-Rewards-Country':
                'cn'

            },

            body:
              JSON.stringify({

                amount: 1,

                id:
                  uuid(),

                type: 103,

                country:
                  'cn',

                attributes: {},

                risk_context: {},

                channel:
                  'SAAndroid'

              })

          })

      );


    if (!response) {

      return;
    }


    const data =
      JSON.parse(
        response.body
      );


    if (
      data.response &&
      data.response.activity
    ) {

      log(
        `签到完成 +${
          data.response.activity.p ||
          0
        }`
      );

    } else {

      log(
        '签到无新增结果'
      );
    }

  } catch (error) {

    log(
      `签到错误：${error.message}`
    );
  }
}



async function runRead() {

  log(
    '检查阅读任务'
  );


  try {

    const response =
      await withAccessTokenRequest(

        token =>
          httpRequest({

            url:
              'https://prod.rewardsplatform.microsoft.com/dapi/me' +
              '?channel=SAAndroid&options=613',

            headers: {

              Authorization:
                `Bearer ${token}`,

              'X-Rewards-AppId':
                'SAAndroid/31.4.2110003555',

              'X-Rewards-IsMobile':
                'true'

            }

          })

      );


    if (!response) {

      return;
    }


    const data =
      JSON.parse(
        response.body
      );


    const promotions =
      (
        data.response &&
        data.response.promotions
      ) || [];


    const promotion =
      promotions.find(

        item =>
          item.attributes &&
          item.attributes.offerid ===
            'ENUS_readarticle3_30points'

      );


    if (!promotion) {

      log(
        '没有找到阅读任务'
      );

      return;
    }


    const current =
      Number(
        promotion.attributes.progress
      ) || 0;


    const max =
      Number(
        promotion.attributes.max
      ) || 0;


    state.readCur =
      current;

    state.readMax =
      max;


    if (
      current >= max
    ) {

      log(
        '阅读任务已经完成'
      );

      return;
    }


    for (
      let i = current;
      i < max;
      i++
    ) {

      log(
        `阅读 ${i + 1}/${max}`
      );


      await withAccessTokenRequest(

        token =>
          httpRequest({

            method: 'POST',

            url:
              'https://prod.rewardsplatform.microsoft.com/dapi/me/activities',

            headers: {

              Authorization:
                `Bearer ${token}`,

              'Content-Type':
                'application/json',

              'X-Rewards-AppId':
                'SAAndroid/31.4.2110003555',

              'X-Rewards-IsMobile':
                'true',

              'X-Rewards-Country':
                'cn'

            },

            body:
              JSON.stringify({

                amount: 1,

                country:
                  'cn',

                id:
                  uuid(),

                type: 101,

                attributes: {

                  offerid:
                    'ENUS_readarticle3_30points'

                }

              })

          })

      );


      state.readCur++;

      await sleep(
        2.5
      );
    }


    log(
      '阅读任务结束'
    );

  } catch (error) {

    log(
      `阅读任务错误：${error.message}`
    );
  }
}



async function getSearchToken() {

  try {

    const response =
      await httpRequest({

        url:
          'https://rewards.bing.com/',

        headers: {

          Cookie:
            getCookie(
              'rewards.bing.com'
            ),

          'User-Agent':
            CONFIG.ua.pc

        }

      });


    const html =
      response.body;


    const match =
      html.match(
        /RequestVerificationToken.*?value="([^"]+)"/
      ) ||
      html.match(
        /"verificationToken":\s*"([^"]+)"/
      );


    return match
      ? match[1]
      : null;

  } catch (_) {

    return null;
  }
}



async function runPromo() {

  log(
    '检查活动任务'
  );


  if (
    !(await updateData())
  ) {

    return;
  }


  const token =
    await getSearchToken();


  if (!token) {

    log(
      '未取得活动 Token'
    );

    return;
  }


  const cookie =
    getCookie(
      'rewards.bing.com'
    );


  const today =
    getDateStr();


  let tasks = [];


  if (
    dashboard.dailySetPromotions &&
    dashboard.dailySetPromotions[
      today
    ]
  ) {

    tasks.push(
      ...dashboard.dailySetPromotions[
        today
      ]
    );
  }


  if (
    Array.isArray(
      dashboard.morePromotions
    )
  ) {

    tasks.push(
      ...dashboard.morePromotions
    );
  }


  tasks =
    tasks.filter(

      task =>
        !task.complete &&
        task.priority > -2 &&
        task.exclusiveLockedFeatureStatus !==
          'locked'

    );


  if (!tasks.length) {

    log(
      '没有待处理活动'
    );

    return;
  }


  for (const task of tasks) {

    try {

      log(
        `活动：${task.title || task.offerId}`
      );


      await httpRequest({

        method: 'POST',

        url:
          'https://rewards.bing.com/api/reportactivity' +
          '?X-Requested-With=XMLHttpRequest',

        headers: {

          Cookie:
            cookie,

          'Content-Type':
            'application/x-www-form-urlencoded',

          Referer:
            'https://rewards.bing.com/',

          'User-Agent':
            CONFIG.ua.pc

        },

        body:
          formEncode({

            id:
              task.offerId,

            hash:
              task.hash,

            activityAmount:
              1,

            __RequestVerificationToken:
              token

          })

      });


      await sleep(
        randomRange(
          1,
          3
        )
      );

    } catch (error) {

      log(
        `活动失败：${error.message}`
      );
    }
  }


  await updateData();
}



async function doSearch(
  query,
  mobile
) {

  const host =
    mobile
      ? 'cn.bing.com'
      : 'www.bing.com';


  const ua =
    mobile
      ? CONFIG.ua.mobile
      : CONFIG.ua.pc;


  let cookie =
    getCookie(
      host
    );


  cookie =
    cookie.replace(
      /_(EDGE_S|Rwho|RwBf)=[^;]*;?\s*/g,
      ''
    );


  const deviceCookie =
    `_Rwho=u=${
      mobile ? 'm' : 'd'
    }&ts=${getDateHyphen()}`;


  cookie =
    deviceCookie +
    '; ' +
    cookie;


  const searchUrl =
    `https://${host}/search` +
    `?q=${encodeURIComponent(query)}` +
    '&form=QBLH';


  const headers = {

    'User-Agent':
      ua,

    Cookie:
      cookie,

    Referer:
      `https://${host}/?form=QBLH`

  };


  try {

    const response =
      await httpRequest({

        url:
          searchUrl,

        headers

      });


    const igMatch =
      response.body.match(
        /,IG:"([^"]+)"/
      );


    const ig =
      igMatch
        ? igMatch[1]
        : uuid()
            .replace(
              /-/g,
              ''
            )
            .toUpperCase();


    try {

      await httpRequest({

        method: 'POST',

        url:
          `https://${host}/rewardsapp/ncheader` +
          `?ver=88888888` +
          `&IID=SERP.5047` +
          `&IG=${encodeURIComponent(ig)}` +
          '&ajaxreq=1',

        headers: {

          ...headers,

          'Content-Type':
            'application/x-www-form-urlencoded; charset=UTF-8'

        },

        body:
          'wb=1%3Bi%3D1%3Bv%3D1'

      });

    } catch (error) {

      log(
        `ncheader：${error.message}`
      );
    }


    await httpRequest({

      method: 'POST',

      url:
        `https://${host}/rewardsapp/reportActivity` +
        `?IG=${encodeURIComponent(ig)}` +
        '&IID=SERP.5047' +
        `&q=${encodeURIComponent(query)}` +
        '&ajaxreq=1',

      headers: {

        ...headers,

        Referer:
          searchUrl,

        'Content-Type':
          'application/x-www-form-urlencoded; charset=UTF-8'

      },

      body:
        formEncode({

          url:
            searchUrl,

          V:
            'web'

        })

    });


    log(
      `${mobile ? '移动' : 'PC'} 搜索：` +
      query.substring(
        0,
        20
      )
    );


    return true;

  } catch (error) {

    log(
      `搜索失败：${error.message}`
    );

    return false;
  }
}


async function runSearch(
  deadline
) {

  if (
    !(await updateData())
  ) {

    return;
  }


  loadProgress();


  const pcNeed =
    Math.max(

      0,

      Math.ceil(
        (
          state.pcMax -
          state.pcCur
        ) / 3
      )

    );


  const mobileNeed =
    Math.max(

      0,

      Math.ceil(
        (
          state.mobileMax -
          state.mobileCur
        ) / 3
      )

    );


  if (
    pcNeed === 0 &&
    mobileNeed === 0
  ) {

    log(
      '今日搜索已完成'
    );

    return;
  }


  function enoughTime(
    seconds = 35
  ) {

    return (
      Date.now() +
      seconds * 1000 <
      deadline
    );
  }


  if (pcNeed > 0) {

    log(
      `需要 PC 搜索 ${pcNeed} 次`
    );


    for (
      let i = 0;
      i < pcNeed;
      i++
    ) {

      if (
        !enoughTime(
          CONFIG.pc.maxDelay + 10
        )
      ) {

        log(
          '时间预算不足，保存进度'
        );

        saveProgress();

        return;
      }


      const query =
        await getHotQuery();


      await doSearch(
        query,
        false
      );


      state.searchCount++;

      saveProgress();


      await sleep(
        randomRange(
          CONFIG.pc.minDelay,
          CONFIG.pc.maxDelay
        )
      );


      if (
        (i + 1) % 3 === 0
      ) {

        await updateData();
      }
    }
  }


  if (mobileNeed > 0) {

    log(
      `需要移动搜索 ${mobileNeed} 次`
    );


    for (
      let i = 0;
      i < mobileNeed;
      i++
    ) {

      if (
        !enoughTime(
          CONFIG.mobile.maxDelay + 10
        )
      ) {

        log(
          '时间预算不足，保存进度'
        );

        saveProgress();

        return;
      }


      const query =
        await getHotQuery();


      await doSearch(
        query,
        true
      );


      state.searchCount++;

      saveProgress();


      await sleep(
        randomRange(
          CONFIG.mobile.minDelay,
          CONFIG.mobile.maxDelay
        )
      );


      if (
        (i + 1) % 3 === 0
      ) {

        await updateData();
      }
    }
  }


  await updateData();

  saveProgress();

  log(
    '搜索阶段结束'
  );
}



(async () => {

  const deadline =
    Date.now() +
    CONFIG.timeBudget;


  log(
    'Bing Rewards 脚本启动'
  );


  const hasCookie =
    !!(
      store.get(
        'bing_cookie_www'
      ) ||
      store.get(
        'bing_cookie_rewards'
      ) ||
      store.get(
        'bing_cookie'
      )
    );


  if (!hasCookie) {

    $notification.post(
      'Bing Rewards',
      '缺少 Cookie',
      '请先登录 Bing / Rewards'
    );

    log(
      '没有 Cookie'
    );

    $done();

    return;
  }


  try {

    await runSign();


    if (
      Date.now() < deadline
    ) {

      await runRead();
    }


    if (
      Date.now() < deadline
    ) {

      await runPromo();
    }


    if (
      Date.now() < deadline
    ) {

      await runSearch(
        deadline
      );
    }


    await updateData();


    const title =
      (
        state.pcCur >=
          state.pcMax &&
        state.mobileCur >=
          state.mobileMax
      )
        ? '任务执行结束'
        : '任务部分完成';


    $notification.post(

      'Bing Rewards',

      title,

      `PC ${state.pcCur}/${state.pcMax}` +
      ` | 移动 ${state.mobileCur}/${state.mobileMax}` +
      ` | ${state.points} pts`

    );


  } catch (error) {

    log(
      `主流程错误：${error.message}`
    );


    $notification.post(

      'Bing Rewards',

      '执行发生错误',

      String(
        error.message ||
        error
      )

    );

  }


  log(
    '脚本结束'
  );

  $done();

})();        const e = err instanceof Error ? err : new Error(String(err));
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

let state = {
  level: 1, points: 0,
  pcCur: 0, pcMax: 0,
  mobileCur: 0, mobileMax: 0,
  readCur: 0, readMax: 0,
  searchCount: 0
};
let dashboard = null; 

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

async function updateData() {
  dashboard = null; 
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

async function doSearch(query, isMobile) {
  const host = isMobile ? 'cn.bing.com' : 'www.bing.com';
  const ua = isMobile ? CONFIG.ua.mobile : CONFIG.ua.pc;
  const deviceCookie = `_Rwho=u=${isMobile ? 'm' : 'd'}&ts=${getDateHyphen()}`;
  const searchUrl = `https://${host}/search?q=${encodeURIComponent(query)}&form=QBLH`;

  const baseCookie = getCookieFor(isMobile ? 'cn' : 'www').replace(/_(EDGE_S|Rwho|RwBf)=[^;]*;?\s*/g, '');
  const fullCookie = (deviceCookie + '; ' + baseCookie).replace(/;\s*$/, '');

  const headers = {
    'User-Agent': ua,
    'Cookie': fullCookie,
    'Referer': `https://${host}/?form=QBLH`
  };

  try {
    const searchResult = await httpRequest({ url: searchUrl, headers });
    const igMatch = searchResult.match(/,IG:"([^"]+)"/);
    const ig = igMatch ? igMatch[1] : uuid().replace(/-/g, '').toUpperCase();

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
