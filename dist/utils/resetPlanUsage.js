"use strict";
// src/app/scripts/reset-expired-subscriptions.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetExpiredSubscriptions = resetExpiredSubscriptions;
const usage_service_1 = require("../app/modules/usage/usage.service");
const prisma_1 = require("../app/shared/prisma");
function resetExpiredSubscriptions() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Checking for expired subscriptions...');
        const expiredSubscriptions = yield prisma_1.prisma.subscription.findMany({
            where: {
                OR: [
                    {
                        status: 'TRIALING',
                        trialEnd: { lt: new Date() }
                    },
                    {
                        currentPeriodEnd: { lt: new Date() },
                        status: { in: ['ACTIVE', 'PAST_DUE'] }
                    }
                ]
            },
            select: { userId: true }
        });
        for (const sub of expiredSubscriptions) {
            try {
                yield usage_service_1.usageService.resetExpiredSubscription(sub.userId);
            }
            catch (error) {
                console.error(`Failed to reset subscription for user ${sub.userId}:`, error);
            }
        }
    });
}
