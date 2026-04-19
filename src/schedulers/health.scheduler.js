const cron = require('node-cron');
const Account = require('../models/Account');
const accountService = require('../services/account.service');
const socketIO = require('../utils/socket');

const startHealthScheduler = () => {
    // Chạy mỗi giờ (0 * * * *)
    cron.schedule('0 * * * *', async () => {
        console.log('🕒 Starting Periodic Health Check for all active accounts...');
        
        try {
            const activeAccounts = await Account.find({ is_active: true });
            console.log(`🔍 Found ${activeAccounts.length} active accounts to check.`);

            for (const acc of activeAccounts) {
                console.log(`🏥 Checking health for: ${acc.name} (${acc._id})`);
                try {
                    // Gọi service checkHealth (tuần tự để tránh mở quá nhiều browser)
                    const result = await accountService.checkHealth(acc._id);
                    
                    // Phát tín hiệu qua Socket sau khi check xong mỗi tài khoản
                    socketIO.emitAccountUpdate({
                        accountId: acc._id,
                        status: result.healthy ? 'healthy' : (result.reason === 'checkpoint' ? 'checkpoint' : 'expired'),
                        lastChecked: new Date(),
                        reason: result.reason
                    });
                    
                } catch (error) {
                    console.error(`❌ Error checking health for ${acc.name}:`, error.message);
                }
            }
            console.log('✅ Periodic Health Check completed.');
        } catch (error) {
            console.error('❌ Periodic Health Check failed:', error);
        }
    });

    console.log('📡 Health Scheduler initialized (runs every 60 minutes)');
};

module.exports = { startHealthScheduler };
