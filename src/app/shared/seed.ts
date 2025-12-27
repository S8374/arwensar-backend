// prisma/seed.ts
import { PrismaClient, PlanType, BillingCycle } from '@prisma/client';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import { config } from '../../config';

const prisma = new PrismaClient();

const stripe = new Stripe(config.STRIPE.SECRET_KEY, {
  apiVersion: '2025-12-15.clover' // Stable version
});

// Define pricing plans
const PRICING_PLANS = {
  MONTHLY: [
    {
      id: 'starter-monthly',
      name: 'Starter',
      type: 'STARTER' as PlanType,
      billingCycle: 'MONTHLY' as BillingCycle,
      price: 199,
      features: {
        supplierLimit: 25,
        complianceDashboard: true,
        alertAndReminder: true,
        basicAssessment: true,
        emailSupport: true,
        documentUploads: 'limited',
        nis2Compliance: false,
        advancedAnalytics: false,
        apiAccess: false,
        prioritySupport: false
      },
      description: 'Perfect for small businesses starting with supplier risk management',
      trialDays: 14,
      isActive: true,
      isPopular: false
    },
    {
      id: 'business-monthly',
      name: 'Business',
      type: 'PROFESSIONAL' as PlanType,
      billingCycle: 'MONTHLY' as BillingCycle,
      price: 399,
      features: {
        supplierLimit: 100,
        complianceDashboard: true,
        alertAndReminder: true,
        basicAssessment: false,
        fullAssessment: true,
        expiryNotification: true,
        multiUserAccess: true,
        integrations: true,
        prioritySupport: true,
        emailSupport: true,
        nis2Compliance: true,
        advancedAnalytics: true,
        apiAccess: true
      },
      description: 'For growing companies with expanding supplier networks',
      trialDays: 14,
      isActive: true,
      isPopular: true
    },
    {
      id: 'enterprise-monthly',
      name: 'Enterprise',
      type: 'ENTERPRISE' as PlanType,
      billingCycle: 'MONTHLY' as BillingCycle,
      price: 699,
      features: {
        supplierLimit: 999999,
        complianceDashboard: true,
        alertAndReminder: true,
        basicAssessment: false,
        fullAssessment: true,
        expiryNotification: true,
        multiUserAccess: true,
        integrations: true,
        prioritySupport: true,
        apiAccess: true,
        performanceAnalytics: true,
        dedicatedAccount: true,
        customReporting: true,
        whiteLabel: false,
        nis2Compliance: true,
        advancedAnalytics: true
      },
      description: 'For large organizations requiring unlimited scale and dedicated support',
      trialDays: 14,
      isActive: true,
      isPopular: false
    }
  ],
  ANNUAL: [
    {
      id: 'starter-annual',
      name: 'Starter',
      type: 'STARTER' as PlanType,
      billingCycle: 'ANNUAL' as BillingCycle,
      price: 139,
      originalPrice: 199,
      features: {
        supplierLimit: 25,
        complianceDashboard: true,
        alertAndReminder: true,
        basicAssessment: true,
        emailSupport: true,
        documentUploads: 'limited',
        nis2Compliance: false,
        advancedAnalytics: false,
        apiAccess: false,
        prioritySupport: false
      },
      description: 'Perfect for small businesses starting with supplier risk management',
      trialDays: 14,
      isActive: true,
      isPopular: false
    },
    {
      id: 'business-annual',
      name: 'Business',
      type: 'PROFESSIONAL' as PlanType,
      billingCycle: 'ANNUAL' as BillingCycle,
      price: 279,
      originalPrice: 399,
      features: {
        supplierLimit: 100,
        complianceDashboard: true,
        alertAndReminder: true,
        basicAssessment: false,
        fullAssessment: true,
        expiryNotification: true,
        multiUserAccess: true,
        integrations: true,
        prioritySupport: true,
        emailSupport: true,
        nis2Compliance: true,
        advancedAnalytics: true,
        apiAccess: true
      },
      description: 'For growing companies with expanding supplier networks',
      trialDays: 14,
      isActive: true,
      isPopular: true
    },
    {
      id: 'enterprise-annual',
      name: 'Enterprise',
      type: 'ENTERPRISE' as PlanType,
      billingCycle: 'ANNUAL' as BillingCycle,
      price: 489,
      originalPrice: 699,
      features: {
        supplierLimit: 999999,
        complianceDashboard: true,
        alertAndReminder: true,
        basicAssessment: false,
        fullAssessment: true,
        expiryNotification: true,
        multiUserAccess: true,
        integrations: true,
        prioritySupport: true,
        apiAccess: true,
        performanceAnalytics: true,
        dedicatedAccount: true,
        customReporting: true,
        whiteLabel: false,
        nis2Compliance: true,
        advancedAnalytics: true
      },
      description: 'For large organizations requiring unlimited scale and dedicated support',
      trialDays: 14,
      isActive: true,
      isPopular: false
    }
  ]
};

// Free Plan — now created in Stripe with 0 EUR price
const FREE_PLAN = {
  id: 'free-plan',
  name: 'Free',
  type: 'FREE' as PlanType,
  billingCycle: 'MONTHLY' as BillingCycle,
  price: 0,
  features: {
    supplierLimit: 5,
    complianceDashboard: true,
    alertAndReminder: true,
    basicAssessment: true,
    emailSupport: true,
    documentUploads: 'very limited',
    nis2Compliance: false,
    advancedAnalytics: false,
    apiAccess: false,
    prioritySupport: false
  },
  description: 'Free forever plan with basic features',
  trialDays: 0,
  isActive: true,
  isDefault: true,
  isPopular: false
};

/**
 * Find existing Stripe product and price
 */
async function findExistingStripeData(plan: any): Promise<{ productId: string | null; priceId: string | null }> {
  try {
    const products = await stripe.products.list({
      limit: 100,
      active: true
    });

    const matchingProduct = products.data.find(p =>
      p.metadata.planId === plan.id
    );

    if (!matchingProduct) return { productId: null, priceId: null };

    const prices = await stripe.prices.list({
      product: matchingProduct.id,
      active: true,
      limit: 50
    });

    const matchingPrice = prices.data.find(p => {
      if (p.unit_amount === null) return false;
      const amount = p.unit_amount / 100;
      const interval = p.recurring?.interval || 'month';
      return (
        amount === plan.price &&
        interval === (plan.billingCycle === 'ANNUAL' ? 'year' : 'month') &&
        p.currency === 'eur'
      );
    });

    return {
      productId: matchingProduct.id,
      priceId: matchingPrice?.id || null
    };
  } catch (error) {
    console.warn(`Stripe search failed for ${plan.name}:`, (error as any).message);
    return { productId: null, priceId: null };
  }
}

/**
 * Create or reuse Stripe Product + Price (including free plan)
 */
async function ensureStripeProductAndPrice(plan: any): Promise<{ productId: string; priceId: string }> {
  console.log(`Processing Stripe for ${plan.name} (${plan.billingCycle}) - ${plan.price} EUR`);

  const existing = await findExistingStripeData(plan);

  if (existing.productId && existing.priceId) {
    console.log(`Already exists: Product ${existing.productId}, Price ${existing.priceId}`);
    return { productId: existing.productId, priceId: existing.priceId };
  }

  console.log(`Creating in Stripe: ${plan.name}...`);

  const product = await stripe.products.create({
    name: `${plan.name} Plan`,
    description: plan.description,
    metadata: {
      planId: plan.id,
      planType: plan.type,
      billingCycle: plan.billingCycle,
      isFree: plan.price === 0 ? 'true' : 'false'
    }
  });

  const priceParams: Stripe.PriceCreateParams = {
    unit_amount: Math.round(plan.price * 100),
    currency: 'eur',
    product: product.id,
    metadata: {
      planId: plan.id,
      planName: plan.name,
      billingCycle: plan.billingCycle,
      isFree: plan.price === 0 ? 'true' : 'false'
    }
  };

  // Only add recurring for paid plans
  if (plan.price > 0) {
    priceParams.recurring = {
      interval: plan.billingCycle === 'ANNUAL' ? 'year' : 'month'
    };
  }

  const price = await stripe.prices.create(priceParams);

  console.log(`Created: Product ${product.id}, Price ${price.id}`);
  return { productId: product.id, priceId: price.id };
}

async function seedDatabase() {
  console.log('🌱 Starting database seeding...\n');

  try {
    // 1. Admin User
    const adminEmail = config.ADMIN_EMAIL || 'super@gmail.com';
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (existingAdmin) {
      console.log(`👤 Admin user exists: ${adminEmail}`);
    } else {
      const hashed = await bcrypt.hash(config.ADMIN_PASSWORD || 'SabbirMridha12', 10);
      await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashed,
          role: 'ADMIN',
          isVerified: true,
          needPasswordChange: false,
          status: 'ACTIVE'
        }
      });
      console.log(`👤 Admin user created: ${adminEmail}`);
    }

    // 2. Free Plan — created in Stripe with 0 EUR
    console.log('\n🆓 Creating Free plan in Stripe + DB...');
    const freeStripeData = await ensureStripeProductAndPrice(FREE_PLAN);

    const freePlanData = {
      name: FREE_PLAN.name,
      description: FREE_PLAN.description,
      type: FREE_PLAN.type,
      billingCycle: FREE_PLAN.billingCycle,
      price: FREE_PLAN.price,
      currency: 'EUR',
      supplierLimit: FREE_PLAN.features.supplierLimit,
      assessmentLimit: 10,
      storageLimit: 10,
      userLimit: 1,
      features: FREE_PLAN.features,
      trialDays: FREE_PLAN.trialDays,
      isActive: true,
      isDefault: true,
      isPopular: false,
      stripeProductId: freeStripeData.productId,
      stripePriceId: freeStripeData.priceId
    };

    const existingFree = await prisma.plan.findFirst({ where: { type: 'FREE' } });

    if (existingFree) {
      await prisma.plan.update({ where: { id: existingFree.id }, data: freePlanData });
      console.log('📝 Free plan updated');
    } else {
      await prisma.plan.create({ data: freePlanData });
      console.log('✅ Free plan created');
    }

    // 3. Paid Plans
    const allPaidPlans = [...PRICING_PLANS.MONTHLY, ...PRICING_PLANS.ANNUAL];

    console.log('\n💰 Processing paid plans...');
    for (const planData of allPaidPlans) {
      const existingPlan = await prisma.plan.findFirst({
        where: {
          type: planData.type,
          billingCycle: planData.billingCycle
        }
      });

      const stripeData = await ensureStripeProductAndPrice(planData);

      const dbData = {
        name: planData.name,
        description: planData.description,
        type: planData.type,
        billingCycle: planData.billingCycle,
        price: planData.price,
        originalPrice: (planData as any).originalPrice || null,
        currency: 'EUR',
        supplierLimit: planData.features.supplierLimit,
        assessmentLimit: 100,
        storageLimit: 100,
        userLimit: planData.type === 'STARTER' ? 3 : planData.type === 'PROFESSIONAL' ? 10 : null,
        features: planData.features,
        trialDays: planData.trialDays,
        isActive: true,
        isDefault: false,
        isPopular: planData.isPopular || false,
        stripeProductId: stripeData.productId,
        stripePriceId: stripeData.priceId
      };

      if (existingPlan) {
        await prisma.plan.update({ where: { id: existingPlan.id }, data: dbData });
        console.log(`📝 Updated: ${planData.name} (${planData.billingCycle})`);
      } else {
        await prisma.plan.create({ data: dbData });
        console.log(`✅ Created: ${planData.name} (${planData.billingCycle})`);
      }
    }

    // 4. Final Summary
    const plans = await prisma.plan.findMany({
      where: { isDeleted: false },
      orderBy: [{ price: 'asc' }, { billingCycle: 'asc' }]
    });

    console.log('\n🎉 Seeding completed successfully!');
    console.log(`📊 Total plans: ${plans.length}\n`);

    plans.forEach(p => {
      console.log(`- ${p.name} (${p.billingCycle}): ${p.price} EUR${p.originalPrice ? ` (from ${p.originalPrice} EUR)` : ''}`);
      console.log(`  🔗 Stripe Price: ${p.stripePriceId}`);
    });

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedDatabase();
}

export { seedDatabase, PRICING_PLANS, FREE_PLAN };