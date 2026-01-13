// src/app/scripts/reset-expired-subscriptions.ts

import { usageService } from "../app/modules/usage/usage.service";
import { prisma } from "../app/shared/prisma";

export async function resetExpiredSubscriptions() {
  console.log('Checking for expired subscriptions...');
  
  const expiredSubscriptions = await prisma.subscription.findMany({
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
      await usageService.resetExpiredSubscription(sub.userId);
    } catch (error) {
      console.error(`Failed to reset subscription for user ${sub.userId}:`, error);
    }
  }

}