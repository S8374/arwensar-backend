"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const app_1 = __importDefault(require("./app"));
const config_1 = require("./config");
const seed_1 = require("./app/shared/seed");
const resetPlanUsage_1 = require("./utils/resetPlanUsage");
const automatedMonitoring_service_1 = require("./automatedMonitoring/automatedMonitoring.service");
const redis_1 = require("./app/shared/redis");
let server;
let monitoringService = null;
function bootstrap() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('🚀 Starting CyberNark Server...');
            // Connect to Redis
            yield (0, redis_1.connectRedis)();
            console.log('✅ Redis connected');
            // Seed database
            yield (0, seed_1.seedDatabase)();
            console.log('✅ Database seeded');
            // Initialize monitoring service
            monitoringService = new automatedMonitoring_service_1.MonitoringQueueService();
            yield monitoringService.initializeMonitoringSystem();
            console.log('✅ Monitoring system initialized');
            // Start the server
            server = app_1.default.listen(config_1.config.port, () => {
                console.log(`✅ Server is running on http://localhost:${config_1.config.port}`);
                console.log(`📁 Environment: ${config_1.config.node_env}`);
                console.log(`🔗 Database: Connected`);
                console.log(`👤 Admin: ${config_1.config.ADMIN_EMAIL}`);
            });
            // Setup subscription reset cron (using node-cron for this)
            const cron = yield Promise.resolve().then(() => __importStar(require('node-cron')));
            cron.schedule('0 0 * * *', () => __awaiter(this, void 0, void 0, function* () {
                console.log('🔄 Running subscription reset cron job...');
                try {
                    yield (0, resetPlanUsage_1.resetExpiredSubscriptions)();
                    console.log('✅ Subscription reset completed');
                }
                catch (error) {
                    console.error('❌ Subscription reset failed:', error);
                }
            }));
            console.log('✅ Subscription reset cron scheduled');
            // Setup graceful shutdown
            setupGracefulShutdown();
        }
        catch (error) {
            console.error('❌ Error during server startup:', error);
            yield gracefulShutdown();
            process.exit(1);
        }
    });
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
        }
        else {
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
function gracefulShutdown() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('\n🔻 Starting graceful shutdown...');
        try {
            // Cleanup monitoring service
            if (monitoringService) {
                yield monitoringService.cleanup();
                console.log('✅ Monitoring service cleaned up');
            }
            // Close server
            if (server) {
                yield new Promise((resolve, reject) => {
                    server.close((err) => {
                        if (err) {
                            console.error('❌ Error closing server:', err);
                            reject(err);
                        }
                        else {
                            console.log('✅ HTTP server closed');
                            resolve();
                        }
                    });
                });
            }
            console.log('✅ Graceful shutdown completed');
        }
        catch (error) {
            console.error('❌ Error during graceful shutdown:', error);
        }
    });
}
bootstrap();
