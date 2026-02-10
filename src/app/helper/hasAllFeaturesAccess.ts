import ApiError from "../../error/ApiError";
import { prisma } from "../shared/prisma";
import httpStatus from "http-status";

export async function hasAllFeaturesAccess(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { allFeaturesAccess: true },
    });

    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    return user.allFeaturesAccess === true;
}
;


 export async function ensureAccessAllowed(userId: string) {
  const hasFullAccess = await hasAllFeaturesAccess(userId);
  if (hasFullAccess) {
    return; // full bypass — no further checks needed
  }

  // Normal subscription path
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true }
  });

  if (!subscription) {
    throw new ApiError(httpStatus.NOT_FOUND, "No active subscription found");
  }

  if (!['ACTIVE', 'TRIALING'].includes(subscription.status)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Your subscription is not active");
  }

  if (subscription.status === 'TRIALING' && subscription.trialEnd && subscription.trialEnd < new Date()) {
    throw new ApiError(httpStatus.FORBIDDEN, "Your trial period has ended");
  }

  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < new Date()) {
    throw new ApiError(httpStatus.FORBIDDEN, "Your subscription has expired");
  }
}