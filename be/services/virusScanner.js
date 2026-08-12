async function scanFileVirus(fileHash) {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;

    if (!apiKey || apiKey.trim() === '' || apiKey === '3a73b4f146f91977c3d0666e95c0e6a099d08f2986d0036216fc368420f5d27b') {
        console.warn('[VirusScanner] Chưa cấu hình VIRUSTOTAL_API_KEY trong .env — Bỏ qua bước quét virus.');
        return { safe: true, message: 'Bỏ qua bước quét virus do chưa cấu hình API Key.' };
    }

    try {
        const response = await fetch(`https://www.virustotal.com/api/v3/files/${fileHash}`, {
            method: 'GET',
            headers: {
                'x-apikey': apiKey
            }
        });

        if (response.status === 200) {
            const data = await response.json();
            const stats = data?.data?.attributes?.last_analysis_stats;

            if (stats && stats.malicious > 0) {
                console.error(`[VirusScanner] Phát hiện mã độc! SHA-256: ${fileHash} — Cảnh báo từ ${stats.malicious} trình diệt virus.`);
                return { 
                    safe: false, 
                    message: `Tệp bị phát hiện có chứa mã độc bởi ${stats.malicious} trình diệt virus! Hệ thống đã từ chối tải lên.` 
                };
            }

            console.log(`[VirusScanner] Tệp an toàn. SHA-256: ${fileHash}`);
            return { safe: true, message: 'Tệp an toàn (Đã quét bởi VirusTotal).' };
        } else if (response.status === 404) {
            console.log(`[VirusScanner] Tệp mới (SHA-256: ${fileHash}) chưa có dữ liệu báo cáo mã độc.`);
            return { safe: true, message: 'Tệp mới chưa từng bị gắn cờ độc hại.' };
        } else {
            console.warn(`[VirusScanner] Phản hồi từ VirusTotal API (Status ${response.status}).`);
            return { safe: true, message: 'Không thể xác minh virus, cho phép tải lên.' };
        }
    } catch (error) {
        console.error('[VirusScanner] Lỗi trong quá trình quét virus:', error.message);
        return { safe: true, message: 'Lỗi dịch vụ quét virus, tự động bỏ qua.' };
    }
}

module.exports = { scanFileVirus };
