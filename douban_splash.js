let body = $response.body;

try {
    let obj = JSON.parse(body);

    // 清空豆瓣开屏广告列表
    obj.ads = [];

    // 清空预加载广告 ID
    obj.preload_ids = null;

    $done({
        body: JSON.stringify(obj)
    });

} catch (e) {
    console.log("Douban splash filter error: " + e);
    $done({});
}
