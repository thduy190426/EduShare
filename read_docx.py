import docx

docx_path = r'C:\Users\duyho\Downloads\TL\Mau Cuon Bao Cao Do An ĐBCLPM_Nhom10_EduShare_V5.docx'
doc = docx.Document(docx_path)

content = []
for p in doc.paragraphs:
    text = p.text.strip()
    if text.startswith("Xử lý"):
        content.append(text)

with open(r'C:\Users\duyho\Downloads\EduShare\existing_processes.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(content))
