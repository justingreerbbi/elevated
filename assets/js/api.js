(function (window, $) {
    "use strict";

    window.Elevated = window.Elevated || {};
    window.Elevated.api = {
        request(method, resource, data, query) {
            const url = new URL("api.php", window.location.href);
            url.searchParams.set("resource", resource);
            if (query) {
                Object.keys(query).forEach((key) => {
                    if (query[key] !== undefined && query[key] !== null && query[key] !== "") {
                        url.searchParams.set(key, query[key]);
                    }
                });
            }

            return $.ajax({
                url: url.toString(),
                method,
                data: data ? JSON.stringify(data) : undefined,
                contentType: "application/json; charset=utf-8",
                dataType: "json",
            }).then((response) => response.data);
        },
    };
})(window, jQuery);
