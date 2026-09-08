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

async function askAIAssistant(query, contextDocs) {
    if (!query || query.trim() === '') return null;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn('GEMINI_API_KEY is not set. Skipping AI Assistant.');
        return "Xin lỗi, hệ thống AI hiện đang bảo trì (thiếu API Key).";
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' }); 

        let docsText = '';
        if (contextDocs && contextDocs.length > 0) {
            docsText = contextDocs.map(doc => `- Tên tài liệu: ${doc.TenTL} (Môn: ${doc.TenMH || 'Không rõ'}, Lượt tải: ${doc.SoLuotTai || 0})\n  Link: /pages/document/documentDetails.html?id=${doc.MaTL}\n  Mô tả: ${doc.MoTa || 'Không có mô tả'}`).join('\n\n');
        } else {
            docsText = 'Không tìm thấy tài liệu nào khớp trong hệ thống.';
        }

        const prompt = `Bạn là trợ lý AI chuyên nghiệp của nền tảng chia sẻ tài liệu học tập EduShare. Nhiệm vụ của bạn là tư vấn và trả lời câu hỏi của người dùng một cách thân thiện, ngắn gọn và hữu ích.
Nếu câu hỏi liên quan đến việc tìm kiếm tài liệu, hãy sử dụng danh sách tài liệu tham khảo dưới đây để trả lời. Nếu người dùng hỏi một câu hỏi chung chung, hãy trả lời tự nhiên. Trả về kết quả có sử dụng định dạng Markdown nhẹ (như in đậm, in nghiêng, list, link) để đẹp mắt hơn. ĐỪNG BỊA ĐẶT TÀI LIỆU KHÔNG CÓ TRONG DANH SÁCH. KHÔNG DÙNG THẺ HEADER (#) QUÁ LỚN. CÂU TRẢ LỜI CẦN GỌN GÀNG, KHÔNG DÀI DÒNG.

Câu hỏi của người dùng: "${query}"

Danh sách tài liệu tìm thấy trong hệ thống:
"""
${docsText}
"""

Hãy tạo câu trả lời:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Error in askAIAssistant:', error);
        return "Xin lỗi, đã xảy ra lỗi trong quá trình xử lý câu hỏi của bạn. Vui lòng thử lại sau.";
    }
}

module.exports = {
    generateAISummary,
    askAIAssistant
};
