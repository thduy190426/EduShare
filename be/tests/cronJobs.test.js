const cron = require('node-cron');
const { initCronJobs } = require('../services/cronJobs');

jest.mock('node-cron', () => ({
    schedule: jest.fn()
}));

describe('Cron Jobs', () => {
    let mockPool;
    let mockConnection;

    beforeEach(() => {
        jest.clearAllMocks();

        mockConnection = {
            execute: jest.fn().mockResolvedValue([[]]),
            beginTransaction: jest.fn().mockResolvedValue(),
            commit: jest.fn().mockResolvedValue(),
            rollback: jest.fn().mockResolvedValue(),
            release: jest.fn()
        };

        mockPool = {
            execute: jest.fn().mockResolvedValue([[]]),
            getConnection: jest.fn().mockResolvedValue(mockConnection)
        };
    });

    it('Nên đăng ký các cron job đúng định dạng', () => {
        initCronJobs(mockPool);
        expect(cron.schedule).toHaveBeenCalledTimes(2);
        expect(cron.schedule).toHaveBeenCalledWith('1 0 1 * *', expect.any(Function));
        expect(cron.schedule).toHaveBeenCalledWith('0 3 * * *', expect.any(Function));
    });

    it('Nên không làm gì nếu không có top users', async () => {
        initCronJobs(mockPool);
        const rewardJob = cron.schedule.mock.calls[0][1];
        
        await rewardJob();
        
        expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
        expect(mockConnection.beginTransaction).not.toHaveBeenCalled();
    });

    it('Nên phát thưởng thành công cho top users', async () => {
        mockPool.execute.mockResolvedValue([
            [{ MaND: 1 }, { MaND: 2 }]
        ]);

        initCronJobs(mockPool);
        const rewardJob = cron.schedule.mock.calls[0][1];
        
        await rewardJob();
        
        expect(mockConnection.beginTransaction).toHaveBeenCalled();
        expect(mockConnection.execute).toHaveBeenCalledTimes(6); // 2 users * 3 queries
        expect(mockConnection.commit).toHaveBeenCalled();
        expect(mockConnection.release).toHaveBeenCalled();
    });
    
    it('Nên rollback nếu có lỗi trong quá trình phát thưởng', async () => {
        mockPool.execute.mockResolvedValue([
            [{ MaND: 1 }]
        ]);
        mockConnection.execute.mockRejectedValue(new Error('Lỗi DB'));

        initCronJobs(mockPool);
        const rewardJob = cron.schedule.mock.calls[0][1];
        
        await rewardJob();
        
        expect(mockConnection.beginTransaction).toHaveBeenCalled();
        expect(mockConnection.rollback).toHaveBeenCalled();
        expect(mockConnection.release).toHaveBeenCalled();
    });
    
    it('Nên xóa token hết hạn thành công', async () => {
        mockPool.execute.mockResolvedValue([{ affectedRows: 5 }]);

        initCronJobs(mockPool);
        const cleanupJob = cron.schedule.mock.calls[1][1];
        
        await cleanupJob();
        
        expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM REFRESH_TOKENS'));
    });
});
