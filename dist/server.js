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
const app_1 = __importDefault(require("./app"));
const redis_1 = require("./app/shared/redis");
const config_1 = require("./config");
const seed_1 = require("./app/shared/seed");
const resetPlanUsage_1 = require("./utils/resetPlanUsage");
const node_cron_1 = __importDefault(require("node-cron"));
function bootstrap() {
    return __awaiter(this, void 0, void 0, function* () {
        // This variable will hold our server instance
        let server;
        try {
            // Start the server
            server = app_1.default.listen(config_1.config.port, () => {
                console.log(`🚀 Server is running on http://localhost:${config_1.config.port}`);
            });
            // Function to gracefully shut down the server
            const exitHandler = () => {
                if (server) {
                    server.close(() => {
                        console.log('Server closed gracefully.');
                        process.exit(1); // Exit with a failure code
                    });
                }
                else {
                    process.exit(1);
                }
            };
            // Handle unhandled promise rejections
            process.on('unhandledRejection', (error) => {
                console.log('Unhandled Rejection is detected, we are closing our server...');
                if (server) {
                    server.close(() => {
                        console.log(error);
                        process.exit(1);
                    });
                }
                else {
                    process.exit(1);
                }
            });
        }
        catch (error) {
            console.error('Error during server startup:', error);
            process.exit(1);
        }
        (() => __awaiter(this, void 0, void 0, function* () {
            yield (0, redis_1.connectRedis)();
            yield (0, seed_1.seedDatabase)();
            node_cron_1.default.schedule('0 2 * * *', () => {
                console.log('Running subscription reset cron job...');
                (0, resetPlanUsage_1.resetExpiredSubscriptions)().catch(console.error);
            });
            // setTimeout(() => {
            //     comprehensiveMonitorService.startAllMonitors();
            //     console.log('📡 Comprehensive Monitoring: ACTIVE');
            //     // Log initial stats
            //     comprehensiveMonitorService.getComprehensiveStats().then(stats => {
            //         if (stats) {
            //             console.log('📊 Initial Monitoring Stats:', stats);
            //         }
            //     });
            // }, 20000); // 20 seconds after startup
        }))();
    });
}
// process.on('SIGTERM', () => {
//   console.log('🛑 SIGTERM received, stopping monitors...');
//   comprehensiveMonitorService.stopAllMonitors();
//   process.exit(0);
// });
// process.on('SIGINT', () => {
//   console.log('🛑 SIGINT received, stopping monitors...');
//   comprehensiveMonitorService.stopAllMonitors();
//   process.exit(0);
// });
bootstrap();
