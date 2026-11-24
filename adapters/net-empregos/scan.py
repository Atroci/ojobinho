#!/usr/bin/env python3
# Vendored operator scanner. search() stays listing-only and keeps the historical search URLs.
# The Node adapter is the default runtime; it parses the same pages.
"""Scan net-empregos.com for website maintenance / development offers. Prints only NEW matches (JSON)."""
import re, json, html, time, urllib.request, urllib.parse, os, sys
BASE="https://www.net-empregos.com"
DIR=os.path.dirname(os.path.abspath(__file__))
SEEN=os.path.join(DIR,"seen.json")
QUERIES=["manutenção website","manutenção websites","manutenção sites","desenvolvimento websites","desenvolvimento web","web developer","wordpress","criação de websites","programador web","web designer","loja online","front-end"]
PAGES=3
WEB=r"(web ?sites?|sites?\b|p[áa]ginas? web|wordpress|woocommerce|shopify|loja(s)? online|e-?commerce|front-?end|full[ -]?stack|web)"
ACT=r"(manuten[çc][ãa]o|desenvolv\w*|cria[çc][ãa]o|programa\w*|developer|design\w*|atualiza\w*|gest[ãa]o)"
def get(u):
    r=urllib.request.Request(u,headers={"User-Agent":"Mozilla/5.0"})
    b=urllib.request.urlopen(r,timeout=30).read()
    try: return b.decode("utf-8")
    except UnicodeDecodeError: return b.decode("cp1252","ignore")
def txt(s):
    s=re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>"," ",s)
    return html.unescape(re.sub(r"\s+"," ",re.sub(r"<[^>]+>"," ",s)))
def items(page):
    out=[]
    for b in page.split('<div class="job-item media">')[1:]:
        m=re.search(r'href=/?"?/(\d{6,})/([^/"> ]+)/"?>([^<]+)</a>',b)
        if not m: continue
        lis=[txt(x).strip() for x in re.findall(r"<li[^>]*>(.*?)</li>",b,re.S)]
        out.append({"id":m.group(1),"url":f"{BASE}/{m.group(1)}/{m.group(2)}/","title":html.unescape(m.group(3)).strip(),"meta":[l for l in lis if l]})
    return out
def search(queries=None,pages=None,sleep=0.7,errors=None):
    """Listing-level search (no detail pages, no seen.json writes). Returns {id: item}.
    Used by CareerOps (/home/box/agent-data/shared/careerops/vizuh/adapters/net_empregos.py)."""
    cands={}
    for q in (queries or QUERIES):
        for p in range(1,(pages or PAGES)+1):
            u=f"{BASE}/pesquisa-empregos.asp?"+urllib.parse.urlencode({"page":p,"chaves":q,"categoria":0,"zona":0,"tipo":0})
            try: pg=get(u)
            except Exception as e:
                print("ERR",u,e,file=sys.stderr)
                if errors is not None: errors.append(f"{u}: {e}")
                continue
            for it in items(pg):
                it.setdefault("query",q); cands.setdefault(it["id"],it)
            time.sleep(sleep)
    return cands
def match(title,desc=""):
    """Website-work classifier used by the daily scan. Returns (strong, snippet) or None."""
    hay=(title+" "+desc).lower()
    near=re.search(ACT+r".{0,60}"+WEB,hay) or re.search(WEB+r".{0,60}"+ACT,hay)
    strong=re.search(r"(manuten[çc][ãa]o|desenvolv\w*|cria[çc][ãa]o)\s+(de\s+|do\s+|dos\s+)?(web ?sites?|sites?|p[áa]ginas web|lojas? online|wordpress)",hay)
    if strong or (near and re.search(WEB, title.lower())):
        m=strong or near
        return bool(strong), hay[max(0,m.start()-150):m.end()+150]
    return None
def main():
    seen=set(json.load(open(SEEN))) if os.path.exists(SEEN) else set()
    first=not seen
    cands=search()
    new=[]
    for i,it in cands.items():
        if i in seen: continue
        seen.add(i)
        t=it["title"]
        try:
            body=txt(get(it["url"])); time.sleep(0.5)
        except Exception: body=""
        k=body.find(t); desc=body[k:k+6000] if k>=0 else body[:6000]
        it.pop("query",None)
        r=match(t,desc)
        if r:
            it["strong"],it["snippet"]=r
            new.append(it)
    json.dump(sorted(seen),open(SEEN,"w"))
    print(json.dumps({"first_run":first,"scanned":len(cands),"new_matches":new},ensure_ascii=False,indent=1))
if __name__=="__main__":
    main()
