"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlanLimits = exports.checkPlanLimit = void 0;
const subscription_service_1 = require("../modules/subscription/subscription.service");
const http_status_1 = __importDefault(require("http-status"));
const ApiError_1 = __importDefault(require("../../error/ApiError"));
const checkPlanLimit = (action) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            const vendorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.vendorId;
            if (!vendorId) {
                return next(new ApiError_1.default(http_status_1.default.UNAUTHORIZED, "Vendor ID not found"));
            }
            yield subscription_service_1.SubscriptionService.enforcePlanLimits(vendorId, action, req.body);
            next();
        }
        catch (error) {
            next(error);
        }
    });
};
exports.checkPlanLimit = checkPlanLimit;
const getPlanLimits = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const vendorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.vendorId;
        if (!vendorId) {
            return next(new ApiError_1.default(http_status_1.default.UNAUTHORIZED, "Vendor ID not found"));
        }
        const result = yield subscription_service_1.SubscriptionService.checkPlanLimits(vendorId);
        // Attach plan limits to request for use in controllers
        req.planLimits = result;
        next();
    }
    catch (error) {
        next(error);
    }
});
exports.getPlanLimits = getPlanLimits;
