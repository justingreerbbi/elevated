(function (window) {
    "use strict";

    window.Elevated = window.Elevated || {};
    window.Elevated.utils = {
        clamp(value, min, max) {
            const number = Number(value);
            if (!Number.isFinite(number)) {
                return min;
            }
            return Math.max(min, Math.min(max, number));
        },
        confidenceLabel(confidence) {
            const value = Number(confidence);
            if (!Number.isFinite(value)) {
                return "Unknown";
            }
            if (value < 40) {
                return "Low";
            }
            if (value < 70) {
                return "Medium";
            }
            return "High";
        },
    };
})(window);
