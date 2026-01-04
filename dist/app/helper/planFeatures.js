"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlanFeatures = void 0;
const getPlanFeatures = (plan) => {
    var _a, _b, _c, _d, _e;
    // Parse features from JSON or use direct plan fields
    const features = typeof plan.features === 'string'
        ? JSON.parse(plan.features)
        : plan.features;
    return {
        supplierLimit: plan.supplierLimit,
        assessmentLimit: plan.assessmentLimit,
        messagesPerMonth: (_a = features === null || features === void 0 ? void 0 : features.messagesPerMonth) !== null && _a !== void 0 ? _a : null,
        documentReviewsPerMonth: (_b = features === null || features === void 0 ? void 0 : features.documentReviewsPerMonth) !== null && _b !== void 0 ? _b : null,
        reportCreate: (_c = features === null || features === void 0 ? void 0 : features.reportCreate) !== null && _c !== void 0 ? _c : null,
        reportsGeneratedPerMonth: (_d = features === null || features === void 0 ? void 0 : features.reportsGeneratedPerMonth) !== null && _d !== void 0 ? _d : null,
        notificationsSend: (_e = features === null || features === void 0 ? void 0 : features.notificationsSend) !== null && _e !== void 0 ? _e : null,
    };
};
exports.getPlanFeatures = getPlanFeatures;
