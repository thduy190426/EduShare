const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function generateAISummary(text) {
    if (!text || text.trim() === '') return null;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn('GEMINI_API_KEY is not set. Skipping AI Summarization.');
        return null;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' }); 

        const prompt = `Bạn là một chuyên gia tóm tắt tài liệu học tập. Dựa trên nội dung trích xuất dưới đây, hãy tạo một đoạn tóm tắt ngắn gọn từ 3 đến 5 câu bằng tiếng Việt. Tập trung vào ý chính và đối tượng hướng đến để người đọc có cái nhìn tổng quan trước khi tải.\n\nNội dung tài liệu:\n"""\n${text}\n"""\n\nTóm tắt:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Error generating AI summary:', error);
        return null; 
    }
}

module.exports = {
    generateAISummary
};
