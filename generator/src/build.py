# 生成单文件网页。默认路径与本机 /workspace/langui 布局一致；测试可设 LANGUI_ROOT / LANGUI_DATA / LANGUI_PORTRAIT / LANGUI_HTML。
import base64, io, json, os
ROOT = os.environ.get('LANGUI_ROOT', '/workspace/langui').rstrip('/')
R = ROOT + '/restore/'
S = ROOT + '/src/'
DATA = os.environ.get('LANGUI_DATA', ROOT + '/build/data.json')
PORTRAIT = os.environ.get('LANGUI_PORTRAIT', S + 'langui-portrait.jpg')
OUT = os.environ.get('LANGUI_HTML', R + 'LanGui专业工作库.html')
def b64(p, maxw, q):
    from PIL import Image
    im=Image.open(p).convert('RGB'); im.thumbnail((maxw,maxw)); bio=io.BytesIO(); im.save(bio,'JPEG',quality=q,optimize=True)
    return 'data:image/jpeg;base64,'+base64.b64encode(bio.getvalue()).decode()
html=open(R+'src/app.html',encoding='utf-8').read()
html=html.replace('/*__APP__*/',open(R+'src/app.js',encoding='utf-8').read())
html=html.replace('/*__DATA__*/null',json.dumps(json.load(open(DATA,encoding='utf-8')),ensure_ascii=False).replace('</','<\\/'))
html=html.replace('/*__PORTRAIT__*/', os.environ.get('LANGUI_PORTRAIT_URI') or b64(PORTRAIT,900,82))
open(OUT,'w',encoding='utf-8').write(html)
print(len(html)//1024,'KB')
