// src/cron/trialExpiryChecker.ts
import cron from 'node-cron';
import { SubscriptionService } from '../modules/subscription/subscription.service';
import { NotificationService } from '../modules/notification/notification.service';
import { prisma } from '../shared/prisma';

export class TrialExpiryChecker {
  static start() {
    // Run every day at 9 AM
    cron.schedule('0 9 * * *', async () => {
      console.log('🔄 Running trial expiry checks...');
      
      try {
        await SubscriptionService.checkTrialExpiry();
        
        // Also check for expired subscriptions
        await this.handleExpiredSubscriptions();
        
        console.log('✅ Trial expiry checks completed');
      } catch (error) {
        console.error('❌ Error running trial expiry checks:', error);
      }
    });

    console.log('🚀 Trial expiry checker started');
  }

  static async handleExpiredSubscriptions(): Promise<void> {
    const expiredSubscriptions = await prisma.subscription.findMany({
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
      const freePlan = await prisma.plan.findFirst({
        where: { type: 'FREE' }
      });

      if (freePlan) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            planId: freePlan.id,
            status: 'ACTIVE'
          }
        });

        // Send notification
        await NotificationService.createNotification({
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
  }
}