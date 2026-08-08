let body = $response.body;

try {
    if (!body) {
        $done({});
    } else {
        let obj = JSON.parse(body);

        if (!obj || !Array.isArray(obj.ads)) {
            $done({});
        } else {
            obj.ads = [];

            $done({
                body: JSON.stringify(obj)
            });
        }
    }
} catch (e) {
    console.log("Douban splash filter error: " + e);
    $done({});
}
