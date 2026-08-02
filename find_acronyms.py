import docx
import re
from collections import Counter

docx_path = r'C:\Users\duyho\Downloads\TL\Mau Cuon Bao Cao Do An ĐBCLPM_Nhom10_EduShare_V8.docx'
doc = docx.Document(docx_path)

full_text = " ".join([p.text for p in doc.paragraphs])

# Find all words that are fully uppercase and length >= 2
acronyms = re.findall(r'\b[A-Z]{2,}\b', full_text)
# Also find acronyms containing numbers like SHA-256, HTML5
acronyms += re.findall(r'\b[A-Z]+[0-9-]*[A-Z0-9]*\b', full_text)

# Count and filter
counter = Counter(acronyms)

# Filter out common Vietnamese words that might be uppercase if the whole line is uppercase (e.g. CHƯƠNG, BÁO, CÁO, TỔNG, QUAN)
# Or just print everything sorted by frequency so I can manually inspect.

for k, v in counter.most_common(100):
    if len(k) >= 2 and k not in ["CHƯƠNG", "BÁO", "CÁO", "TỔNG", "QUAN", "PHẦN", "THIẾT", "KẾ", "XỬ", "LÝ", "HỆ", "THỐNG", "MỤC", "LỤC", "TÀI", "LIỆU", "NGƯỜI", "DÙNG", "MÔN", "HỌC", "NHÓM", "THÔNG", "BÁO", "ĐỀ", "XUẤT", "GIAO", "DỊCH", "VI", "PHẠM", "QUẢN", "TRỊ", "VIÊN"]:
        print(f"{k}: {v}")
