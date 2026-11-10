"""Genera pantallazo.png (tabla diaria caudal Km101 + cotas de embalses y gráfico acumulado) y datos_resumen.xlsx."""
import os, sqlite3, pandas as pd, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt, matplotlib.dates as mdates
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
c = sqlite3.connect(f"{B}/caudales.db")
q = pd.read_sql("SELECT * FROM caudales_diarios ORDER BY fecha", c, parse_dates=["fecha"])
e = pd.read_sql("SELECT * FROM niveles_embalses ORDER BY fecha", c, parse_dates=["fecha"])
orden = ["Punta Negra", "Ullum", "Los Caracoles", "Cuesta del Viento"]
niv = e.pivot_table(index="fecha", columns="embalse", values="nivel")[orden]
vol = e.pivot_table(index="fecha", columns="embalse", values="volumen_hm3")[orden]
fin = max(q.fecha.max(), niv.index.max())
dias = pd.date_range(fin - pd.Timedelta(days=20), fin)
tab = pd.DataFrame(index=dias)
tab["caudal"] = q.set_index("fecha").caudal_m3s.reindex(dias)
tab = tab.join(niv.reindex(dias))
f = lambda v, d: "s/d" if pd.isna(v) else f"{v:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")
rows = [[i.strftime("%a %d/%m/%Y").replace("Mon","Lun").replace("Tue","Mar").replace("Wed","Mié").replace("Thu","Jue").replace("Fri","Vie").replace("Sat","Sáb").replace("Sun","Dom"),
         f(r.caudal, 3)] + [f(r[k], 2) for k in orden] for i, r in tab.iloc[::-1].iterrows()]
# acumulado del año hidrológico (1-jul a 30-jun), hm3 = sum(Q m3/s * 86400)/1e6, solo días con dato (sin interpolar)
s = q.set_index("fecha").caudal_m3s
def hy(d): return d.year if d.month >= 7 else d.year - 1
s_hm3 = s * 86400 / 1e6
dfh = pd.DataFrame({"hm3": s_hm3}); dfh["ah"] = [hy(d) for d in dfh.index]
dfh["dia"] = [(d - pd.Timestamp(year=a, month=7, day=1)).days for d, a in zip(dfh.index, dfh.ah)]
cur = hy(fin)
fig = plt.figure(figsize=(16, 8.6), dpi=110)
fig.suptitle("Río San Juan – caudal diario en Km 101 y nivel de embalses (Departamento de Hidráulica de San Juan)", fontsize=15, fontweight="bold", x=0.015, ha="left", y=0.975)
lq = q.iloc[-1]
fig.text(0.015, 0.915, f"Último caudal publicado: {f(lq.caudal_m3s,3)} m³/s ({lq.fecha:%d/%m/%Y})   ·   última lectura de embalses: {niv.index.max():%d/%m/%Y} 08:00 h   ·   cotas en m.s.n.m.", fontsize=11, color="#0b5394")
ax = fig.add_axes([0.01, 0.07, 0.53, 0.82]); ax.axis("off")
cols = ["Fecha", "Caudal Km 101\n(m³/s)"] + [f"{k}\n(m.s.n.m.)" for k in orden]
t = ax.table(cellText=rows, colLabels=cols, loc="upper center", cellLoc="center", colWidths=[.2, .16, .16, .16, .16, .17])
t.auto_set_font_size(False); t.set_fontsize(9.5); t.scale(1, 1.5)
for (i, j), cell in t.get_celld().items():
    if i == 0: cell.set_facecolor("#0b5394"); cell.get_text().set_color("white"); cell.get_text().set_fontweight("bold"); cell.set_height(cell.get_height()*1.6)
    elif i % 2 == 0: cell.set_facecolor("#eef3fa")
    if i > 0 and cell.get_text().get_text() == "s/d": cell.get_text().set_color("#999")
ax2 = fig.add_axes([0.6, 0.12, 0.38, 0.74])
base = pd.Timestamp(year=2000, month=7, day=1)
for a, col, lw, lab in [(cur, "#0b5394", 2.6, None), (cur - 1, "#e69138", 1.6, None), (cur - 2, "#93c47d", 1.3, None)]:
    d = dfh[dfh.ah == a].sort_values("dia")
    if d.empty or (a != cur and len(d) < 300): continue
    ax2.plot(base + pd.to_timedelta(d.dia, "D"), d.hm3.cumsum(), color=col, lw=lw,
             label=f"{a}-{str(a+1)[2:]}: {d.hm3.sum():,.0f} hm³ ({len(d)} días con dato)".replace(",", "."))
# media de años hidrológicos completos (≥360 días con dato)
comp = dfh.groupby("ah").filter(lambda g: len(g) >= 360)
if not comp.empty:
    m = comp.groupby(["ah", "dia"]).hm3.sum().groupby(level=0).cumsum().groupby(level=1).mean()
    ax2.plot(base + pd.to_timedelta(m.index, "D"), m.values, color="#666", ls="--", lw=1.3,
             label=f"Media {comp.ah.nunique()} años hidrológicos completos ({comp.ah.min()}–{comp.ah.max()+1})")
ax2.xaxis.set_major_locator(mdates.MonthLocator()); ax2.xaxis.set_major_formatter(mdates.DateFormatter("%b"))
ax2.set_xlim(base, base + pd.Timedelta(days=365))
ax2.set_title("Escurrimiento acumulado del año hidrológico (jul–jun), Km 101", fontsize=11.5, loc="left")
ax2.set_ylabel("Volumen acumulado (hm³)"); ax2.grid(alpha=.3); ax2.legend(fontsize=8.5, loc="upper left")
fig.text(0.015, 0.02, "Fuente: Departamento de Hidráulica de San Juan – planilla diaria 'Distribución de Riego' 08:00 h "
         "(hidraulica.sanjuan.gob.ar/irrigacionver2/planillas_pdf) y Base de datos DH Km 101 (datos y estadisticas/chart2.php). "
         "El caudal de la planilla del día D se asigna al día D-1 (convención de la base DH). s/d = sin dato publicado; no se interpola. "
         f"Acumulado = Σ Q·86400 sobre días con dato. Generado {pd.Timestamp.now():%d/%m/%Y %H:%M} (UTC-3).", fontsize=7.6, color="#555", wrap=True)
fig.savefig(f"{B}/pantallazo.png"); print("png ok", fin.date())
with pd.ExcelWriter(f"{B}/datos_resumen.xlsx") as w:
    out = tab.iloc[::-1].reset_index().rename(columns={"index": "fecha", "caudal": "caudal_km101_m3s"})
    out.columns = [str(x) if x in ("fecha", "caudal_km101_m3s") else f"cota_{x.replace(' ','_')}_msnm" for x in out.columns]
    out.to_excel(w, sheet_name="ultimos_21_dias", index=False)
    ult = e[e.fecha == e.fecha.max()][["fecha", "embalse", "nivel", "unidad", "volumen_hm3", "volumen_disponible_hm3", "fuente"]]
    ult.to_excel(w, sheet_name="embalses_ultima_lectura", index=False)
    acu = dfh[dfh.ah >= cur - 2].copy(); acu["acumulado_hm3"] = acu.groupby("ah").hm3.cumsum()
    acu.reset_index().rename(columns={"index": "fecha", "ah": "anio_hidrologico"}).to_excel(w, sheet_name="acumulado_anio_hidrologico", index=False)
    q.to_excel(w, sheet_name="caudal_diario_completo", index=False)
    wide = niv.join(vol, lsuffix="_cota_msnm", rsuffix="_volumen_hm3").reset_index()
    wide.to_excel(w, sheet_name="embalses_diario_completo", index=False)
print("xlsx ok")
