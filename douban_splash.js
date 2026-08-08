let body = $response.body;

try {

    let obj = JSON.parse(body);

    obj.ads = [];

    obj.preload_ids = null;

    $done({
        body: JSON.stringify(obj)
    });

} catch(e) {

    $done({});
}