// prisma/seed.ts
import { PrismaClient, PlanType, BillingCycle } from '@prisma/client';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import { config } from '../../config';

const prisma = new PrismaClient();

// Initialize Stripe
const stripe = new Stripe(config.STRIPE.SECRET_KEY, {
  apiVersion: '2025-12-15.clover'
});

// Define the exact pricing plans structure
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
        supplierLimit: 999999, // Unlimited
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
      price: 139, // Discounted from 199
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
      price: 279, // Discounted from 399
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
      price: 489, // Discounted from 699
      originalPrice: 699,
      features: {
        supplierLimit: 999999, // Unlimited
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

// Add Free Trial Plan
const FREE_TRIAL_PLAN = {
  id: 'free-trial',
  name: 'Free Trial',
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
    prioritySupport: false,
    trialOnly: true
  },
  description: '14-day free trial with basic features',
  trialDays: 14,
  isActive: true,
  isDefault: true,
  isPopular: false
};

async function createStripeProductAndPrice(plan: any): Promise<{ productId: string; priceId: string }> {
  try {
    console.log(`🔄 Creating Stripe product for: ${plan.name} (${plan.billingCycle})`);

    // Create or get product
    let productId = plan.stripeProductId;
    if (!productId) {
      const product = await stripe.products.create({
        name: `${plan.name} Plan - ${plan.billingCycle}`,
        description: plan.description || '',
        metadata: {
          planId: plan.id,
          planType: plan.type,
          billingCycle: plan.billingCycle
        }
      });
      productId = product.id;
      console.log(`✅ Stripe product created: ${productId}`);
    }

    // Convert billing cycle to Stripe format
    let stripeInterval: 'month' | 'year';
    if (plan.billingCycle === 'MONTHLY') {
      stripeInterval = 'month';
    } else if (plan.billingCycle === 'ANNUAL') {
      stripeInterval = 'year';
    } else {
      stripeInterval = 'month'; // Default
    }

    // Create price
    const price = await stripe.prices.create({
      unit_amount: Math.round(plan.price * 100), // Convert to cents
      currency: 'eur',
      recurring: {
        interval: stripeInterval,
        interval_count: 1
      },
      product: productId,
      metadata: {
        planId: plan.id,
        planName: plan.name,
        billingCycle: plan.billingCycle
      }
    });

    console.log(`✅ Stripe price created: ${price.id} (${plan.price} EUR/${plan.billingCycle})`);

    return {
      productId,
      priceId: price.id
    };
  } catch (error: any) {
    console.error(`❌ Error creating Stripe product/price for ${plan.name}:`, error.message);
    throw error;
  }
}

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  try {
    // 1. Create Admin User
    console.log('\n👤 Creating admin user...');
    const existingAdmin = await prisma.user.findUnique({
      where: { email: config.ADMIN_EMAIL || 'super@gmail.com' }
    });

    if (existingAdmin) {
      console.log('✅ Admin user already exists:', existingAdmin.email);
    } else {
      const hashPassword = await bcrypt.hash(config.ADMIN_PASSWORD || 'SabbirMridha12', 10);
      
      const admin = await prisma.user.create({
        data: {
          email: config.ADMIN_EMAIL || 'super@gmail.com',
          password: hashPassword,
          role: 'ADMIN',
          isVerified: true,
          needPasswordChange: false,
          status: 'ACTIVE'
        }
      });

      console.log('✅ Admin user created:', admin.email);
    }

    // 2. Create Free Trial Plan (No Stripe product needed)
    console.log('\n🆓 Creating Free Trial plan...');
    const existingFreePlan = await prisma.plan.findFirst({
      where: { 
        type: 'FREE',
        billingCycle: 'MONTHLY'
      }
    });

    if (existingFreePlan) {
      await prisma.plan.update({
        where: { id: existingFreePlan.id },
        data: {
          name: FREE_TRIAL_PLAN.name,
          description: FREE_TRIAL_PLAN.description,
          type: FREE_TRIAL_PLAN.type,
          billingCycle: FREE_TRIAL_PLAN.billingCycle,
          price: FREE_TRIAL_PLAN.price,
          currency: 'EUR',
          supplierLimit: 5,
          assessmentLimit: 10,
          storageLimit: 10,
          userLimit: 1,
          features: FREE_TRIAL_PLAN.features,
          trialDays: FREE_TRIAL_PLAN.trialDays,
          isActive: FREE_TRIAL_PLAN.isActive,
          isDefault: FREE_TRIAL_PLAN.isDefault,
          isPopular: FREE_TRIAL_PLAN.isPopular
        }
      });
      console.log('📝 Free Trial plan updated');
    } else {
      await prisma.plan.create({
        data: {
          name: FREE_TRIAL_PLAN.name,
          description: FREE_TRIAL_PLAN.description,
          type: FREE_TRIAL_PLAN.type,
          billingCycle: FREE_TRIAL_PLAN.billingCycle,
          price: FREE_TRIAL_PLAN.price,
          currency: 'EUR',
          supplierLimit: 5,
          assessmentLimit: 10,
          storageLimit: 10,
          userLimit: 1,
          features: FREE_TRIAL_PLAN.features,
          trialDays: FREE_TRIAL_PLAN.trialDays,
          isActive: FREE_TRIAL_PLAN.isActive,
          isDefault: FREE_TRIAL_PLAN.isDefault,
          isPopular: FREE_TRIAL_PLAN.isPopular
        }
      });
      console.log('✅ Free Trial plan created');
    }

    // 3. Create Monthly Plans with Stripe Integration
    console.log('\n💰 Creating Monthly plans with Stripe...');
    for (const planData of PRICING_PLANS.MONTHLY) {
      const existingPlan = await prisma.plan.findFirst({
        where: { 
          type: planData.type,
          billingCycle: 'MONTHLY'
        }
      });

      // Create Stripe product and price (only for paid plans)
      let stripeData = null;
      if (planData.price > 0) {
        stripeData = await createStripeProductAndPrice(planData);
      }

      const dbPlanData = {
        name: planData.name,
        description: planData.description,
        type: planData.type,
        billingCycle: planData.billingCycle,
        price: planData.price,
        originalPrice: (planData as any).originalPrice || null,
        currency: 'EUR',
        supplierLimit: planData.features.supplierLimit,
        assessmentLimit: 100, // Default value
        storageLimit: 100, // Default value
        userLimit: planData.type === 'STARTER' ? 3 : planData.type === 'PROFESSIONAL' ? 10 : null,
        features: planData.features,
        trialDays: planData.trialDays,
        isActive: planData.isActive,
        isDefault: false,
        isPopular: planData.isPopular || false,
        stripeProductId: stripeData?.productId || null,
        stripePriceId: stripeData?.priceId || null
      };

      if (existingPlan) {
        await prisma.plan.update({
          where: { id: existingPlan.id },
          data: dbPlanData
        });
        console.log(`📝 Monthly plan updated: ${planData.name}`);
      } else {
        await prisma.plan.create({
          data: dbPlanData
        });
        console.log(`✅ Monthly plan created: ${planData.name}`);
      }
    }

    // 4. Create Annual Plans with Stripe Integration
    console.log('\n📅 Creating Annual plans with Stripe...');
    for (const planData of PRICING_PLANS.ANNUAL) {
      const existingPlan = await prisma.plan.findFirst({
        where: { 
          type: planData.type,
          billingCycle: 'ANNUAL'
        }
      });

      // Create Stripe product and price (only for paid plans)
      let stripeData = null;
      if (planData.price > 0) {
        stripeData = await createStripeProductAndPrice(planData);
      }

      const dbPlanData = {
        name: planData.name,
        description: planData.description,
        type: planData.type,
        billingCycle: planData.billingCycle,
        price: planData.price,
        originalPrice: (planData as any).originalPrice || null,
        currency: 'EUR',
        supplierLimit: planData.features.supplierLimit,
        assessmentLimit: 100, // Default value
        storageLimit: 100, // Default value
        userLimit: planData.type === 'STARTER' ? 3 : planData.type === 'PROFESSIONAL' ? 10 : null,
        features: planData.features,
        trialDays: planData.trialDays,
        isActive: planData.isActive,
        isDefault: false,
        isPopular: planData.isPopular || false,
        stripeProductId: stripeData?.productId || null,
        stripePriceId: stripeData?.priceId || null
      };

      if (existingPlan) {
        await prisma.plan.update({
          where: { id: existingPlan.id },
          data: dbPlanData
        });
        console.log(`📝 Annual plan updated: ${planData.name}`);
      } else {
        await prisma.plan.create({
          data: dbPlanData
        });
        console.log(`✅ Annual plan created: ${planData.name}`);
      }
    }

    // 5. Verify all plans are created
    console.log('\n🔍 Verifying all plans...');
    const allPlans = await prisma.plan.findMany({
      where: { isDeleted: false }
    });

    console.log(`📊 Total plans in database: ${allPlans.length}`);
    
    allPlans.forEach(plan => {
      console.log(`  - ${plan.name} (${plan.billingCycle}): ${plan.price} EUR`);
      if (plan.originalPrice) {
        console.log(`    Discounted from: ${plan.originalPrice} EUR`);
      }
    });

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('✅ Admin user created/verified');
    console.log('✅ Free Trial plan created');
    console.log('✅ Monthly plans created with Stripe integration');
    console.log('✅ Annual plans created with Stripe integration');
    console.log('\n🔗 Stripe products and prices have been created');
    console.log('💳 Plans are ready for subscription management');

  } catch (error) {
    console.error('❌ Seeding error:', error);
    throw error;
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .catch((error) => {
      console.error('❌ Fatal seeding error:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { seedDatabase, PRICING_PLANS, FREE_TRIAL_PLAN };