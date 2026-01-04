import { Server } from 'http';
import app from './app';
import { connectRedis } from './app/shared/redis';
import { config } from './config';
import { seedDatabase } from './app/shared/seed';
import { resetExpiredSubscriptions } from './utils/resetPlanUsage';
import cron from 'node-cron';


async function bootstrap() {
    // This variable will hold our server instance
    let server: Server;

    try {
        // Start the server
        server = app.listen(config.port, () => {
            console.log(`🚀 Server is running on http://localhost:${config.port}`);
        });

        // Function to gracefully shut down the server
        const exitHandler = () => {
            if (server) {
                server.close(() => {
                    console.log('Server closed gracefully.');
                    process.exit(1); // Exit with a failure code
                });
            } else {
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
            } else {
                process.exit(1);
            }
        });
    } catch (error) {
        console.error('Error during server startup:', error);
        process.exit(1);
    }
    (async () => {
        await connectRedis();
        await seedDatabase();
        cron.schedule('0 2 * * *', () => {
            console.log('Running subscription reset cron job...');
            resetExpiredSubscriptions().catch(console.error);
        });
    })();



}




bootstrap();