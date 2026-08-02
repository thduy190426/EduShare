import docx

docx_path = r'C:\Users\duyho\Downloads\TL\Mau Cuon Bao Cao Do An ĐBCLPM_Nhom10_EduShare_V5.docx'
doc = docx.Document(docx_path)

content = [p.text.strip() for p in doc.paragraphs if p.text.strip()]

with open(r'C:\Users\duyho\Downloads\EduShare\full_text.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(content))
