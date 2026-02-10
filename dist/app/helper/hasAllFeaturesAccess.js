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
exports.hasAllFeaturesAccess = hasAllFeaturesAccess;
exports.ensureAccessAllowed = ensureAccessAllowed;
const ApiError_1 = __importDefault(require("../../error/ApiError"));
const prisma_1 = require("../shared/prisma");
const http_status_1 = __importDefault(require("http-status"));
function hasAllFeaturesAccess(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { allFeaturesAccess: true },
        });
        if (!user) {
            throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
        }
        return user.allFeaturesAccess === true;
    });
}
;
function ensureAccessAllowed(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const hasFullAccess = yield hasAllFeaturesAccess(userId);
        if (hasFullAccess) {
            return; // full bypass — no further checks needed
        }
        // Normal subscription path
        const subscription = yield prisma_1.prisma.subscription.findUnique({
            where: { userId },
            include: { plan: true }
        });
        if (!subscription) {
            throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "No active subscription found");
        }
        if (!['ACTIVE', 'TRIALING'].includes(subscription.status)) {
            throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Your subscription is not active");
        }
        if (subscription.status === 'TRIALING' && subscription.trialEnd && subscription.trialEnd < new Date()) {
            throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Your trial period has ended");
        }
        if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < new Date()) {
            throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Your subscription has expired");
        }
    });
}
