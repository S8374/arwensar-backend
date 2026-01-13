// src/server.ts
import { Server } from 'http';
import app from './app';
import { config } from './config';
import { seedDatabase } from './app/shared/seed';
import { resetExpiredSubscriptions } from './utils/resetPlanUsage';
import { MonitoringQueueService } from './automatedMonitoring/automatedMonitoring.service';
import { connectRedis } from './app/shared/redis';

let server: Server;
let monitoringService: MonitoringQueueService | null = null;

async function bootstrap() {
  try {
    console.log('🚀 Starting CyberNark Server...');

    // Connect to Redis
    await connectRedis();
    console.log('✅ Redis connected');

    // Seed database
    await seedDatabase();
    console.log('✅ Database seeded');

    // Initialize monitoring service
    monitoringService = new MonitoringQueueService();
    await monitoringService.initializeMonitoringSystem();
    console.log('✅ Monitoring system initialized');

    // Start the server
    server = app.listen(config.port, () => {
      console.log(`✅ Server is running on http://localhost:${config.port}`);
      console.log(`📁 Environment: ${config.node_env}`);
      console.log(`🔗 Database: Connected`);
      console.log(`👤 Admin: ${config.ADMIN_EMAIL}`);
    });

    // Setup subscription reset cron (using node-cron for this)
    const cron = await import('node-cron');
    cron.schedule('0 0 * * *', async () => {
      console.log('🔄 Running subscription reset cron job...');
      try {
        await resetExpiredSubscriptions();
        console.log('✅ Subscription reset completed');
      } catch (error) {
        console.error('❌ Subscription reset failed:', error);
      }
    });
    console.log('✅ Subscription reset cron scheduled');

    // Setup graceful shutdown
    setupGracefulShutdown();

  } catch (error) {
    console.error('❌ Error during server startup:', error);
    await gracefulShutdown();
    process.exit(1);
  }
}

// ========== GRACEFUL SHUTDOWN ==========
function setupGracefulShutdown() {
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error);
    if (server) {
      server.close(() => {
        console.log('🔒 Server closed due to unhandled rejection');
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    gracefulShutdown().then(() => {
      process.exit(1);
    });
  });

  // Handle termination signals
  process.on('SIGTERM', () => {
    console.log('🔻 SIGTERM received');
    gracefulShutdown().then(() => {
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('🔻 SIGINT received (Ctrl+C)');
    gracefulShutdown().then(() => {
      process.exit(0);
    });
  });
}

// ========== GRACEFUL SHUTDOWN FUNCTION ==========
async function gracefulShutdown() {
  console.log('\n🔻 Starting graceful shutdown...');

  try {
    // Cleanup monitoring service
    if (monitoringService) {
      await monitoringService.cleanup();
      console.log('✅ Monitoring service cleaned up');
    }

    // Close server
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            console.error('❌ Error closing server:', err);
            reject(err);
          } else {
            console.log('✅ HTTP server closed');
            resolve();
          }
        });
      });
    }

    console.log('✅ Graceful shutdown completed');

  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
  }
}

bootstrap();