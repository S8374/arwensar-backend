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
exports.TrialExpiryChecker = void 0;
// src/cron/trialExpiryChecker.ts
const node_cron_1 = __importDefault(require("node-cron"));
const notification_service_1 = require("../modules/notification/notification.service");
const prisma_1 = require("../shared/prisma");
class TrialExpiryChecker {
    static start() {
        // Run every day at 9 AM
        node_cron_1.default.schedule('0 9 * * *', () => __awaiter(this, void 0, void 0, function* () {
            console.log('🔄 Running trial expiry checks...');
            try {
                yield SubscriptionService.checkTrialExpiry();
                // Also check for expired subscriptions
                yield this.handleExpiredSubscriptions();
                console.log('✅ Trial expiry checks completed');
            }
            catch (error) {
                console.error('❌ Error running trial expiry checks:', error);
            }
        }));
        console.log('🚀 Trial expiry checker started');
    }
    static handleExpiredSubscriptions() {
        return __awaiter(this, void 0, void 0, function* () {
            const expiredSubscriptions = yield prisma_1.prisma.subscription.findMany({
                where: {
                    status: 'PAST_DUE',
                    currentPeriodEnd: {
                        lt: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days past due
                    }
                },
                include: {
                    user: true,
                    plan: true
                }
            });
            for (const subscription of expiredSubscriptions) {
                // Downgrade to free plan
                const freePlan = yield prisma_1.prisma.plan.findFirst({
                    where: { type: 'FREE' }
                });
                if (freePlan) {
                    yield prisma_1.prisma.subscription.update({
                        where: { id: subscription.id },
                        data: {
                            planId: freePlan.id,
                            status: 'ACTIVE'
                        }
                    });
                    // Send notification
                    yield notification_service_1.NotificationService.createNotification({
                        userId: subscription.userId,
                        title: "Subscription Downgraded",
                        message: "Your subscription was downgraded to the free plan due to non-payment.",
                        type: 'SYSTEM_ALERT',
                        metadata: {
                            oldPlan: subscription.plan.name,
                            newPlan: freePlan.name
                        }
                    });
                }
            }
        });
    }
}
exports.TrialExpiryChecker = TrialExpiryChecker;
