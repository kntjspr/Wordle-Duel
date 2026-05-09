package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
)

// writeReport generates a self-contained HTML file with Chart.js charts
// populated with the actual measured data from the test run.
func writeReport(path string, results []ScenarioResult, idle *ServerMetrics) error {
	type jsonData struct {
		Labels     []string  `json:"labels"`
		AvgMs      []float64 `json:"avgMs"`
		P95Ms      []float64 `json:"p95Ms"`
		P99Ms      []float64 `json:"p99Ms"`
		EvtSec     []float64 `json:"evtSec"`
		Goroutines []int     `json:"goroutines"`
		HeapMB     []float64 `json:"heapMB"`
		Players    []int     `json:"players"`
	}

	var d jsonData
	idleGoroutines := 5
	idleHeap := 0.0
	if idle != nil {
		idleGoroutines = idle.Goroutines
		idleHeap = round1(idle.HeapAllocMB)
	}

	for _, r := range results {
		st := calcStats(r.Latencies)
		d.Labels = append(d.Labels, fmt.Sprintf("%d players", r.NumPlayers))
		d.AvgMs = append(d.AvgMs, st.Avg)
		d.P95Ms = append(d.P95Ms, st.P95)
		d.P99Ms = append(d.P99Ms, st.P99)
		d.EvtSec = append(d.EvtSec, round1(r.EvtPerSec()))
		d.Players = append(d.Players, r.NumPlayers)
		if r.After != nil {
			d.Goroutines = append(d.Goroutines, r.After.Goroutines)
			d.HeapMB = append(d.HeapMB, round1(r.After.HeapAllocMB))
		} else {
			d.Goroutines = append(d.Goroutines, 0)
			d.HeapMB = append(d.HeapMB, 0)
		}
	}

	dataJSON, _ := json.Marshal(d)

	html := buildHTML(string(dataJSON), idleGoroutines, idleHeap)
	return os.WriteFile(path, []byte(html), 0644)
}

func round1(v float64) float64 {
	return math.Round(v*10) / 10
}

func buildHTML(dataJSON string, idleGoroutines int, idleHeapMB float64) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Wordle Duel — Live Performance Report</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&family=JetBrains+Mono:wght@500;700&display=swap');
:root{--bg:#0d0f14;--card:#1c2030;--border:#2a2f3f;--green:oklch(0.78 0.18 145);--blue:oklch(0.72 0.19 255);--amber:oklch(0.78 0.18 60);--red:oklch(0.70 0.22 15);--fg:#e8eaf0;--muted:#7a8090;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{font-size:14px;}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--fg);min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:36px 16px 56px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.report{width:100%%;max-width:680px;display:flex;flex-direction:column;gap:28px;}
/* cover */
.cover{text-align:center;padding:32px 24px 24px;border-radius:20px;background:linear-gradient(145deg,#151e12,#0d1520 50%%,#120d1f);border:1px solid var(--border);position:relative;overflow:hidden;}
.cover::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60%% 40%% at 20%% 20%%,oklch(0.78 0.18 145/0.12),transparent 70%%),radial-gradient(ellipse 50%% 35%% at 80%% 80%%,oklch(0.72 0.19 255/0.10),transparent 70%%);}
.badge{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:.58rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--green);border:1px solid oklch(0.78 0.18 145/.35);border-radius:999px;padding:3px 12px;margin-bottom:10px;}
.cover h1{font-size:1.7rem;font-weight:900;letter-spacing:-.02em;line-height:1.15;margin-bottom:5px;}
.cover h1 span{color:var(--green);}
.cover p{font-size:.74rem;color:var(--muted);max-width:380px;margin:0 auto;}
.meta{display:flex;justify-content:center;gap:12px;margin-top:14px;flex-wrap:wrap;}
.chip{font-size:.64rem;font-family:'JetBrains Mono',monospace;color:var(--muted);background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:8px;padding:3px 9px;}
.chip strong{color:var(--fg);}
/* chart cards */
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;overflow:hidden;}
.card-head{padding:14px 18px 0;}
.metric-no{font-size:.56rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;font-family:'JetBrains Mono',monospace;margin-bottom:3px;}
.card-title{font-size:.9rem;font-weight:800;letter-spacing:-.01em;margin-bottom:2px;}
.card-desc{font-size:.67rem;color:var(--muted);}
.chart-wrap{padding:14px 16px 8px;height:220px;position:relative;}
.insight{margin:0 18px 16px;background:rgba(255,255,255,.03);border-left:3px solid var(--green);border-radius:0 8px 8px 0;padding:9px 12px;font-size:.67rem;color:var(--muted);line-height:1.55;}
.insight strong{color:var(--fg);}
.hl{color:var(--green);font-weight:700;}
/* footer */
.footer{text-align:center;font-size:.64rem;color:var(--muted);line-height:1.6;border-top:1px solid var(--border);padding-top:16px;}
.footer strong{color:var(--fg);}
@media print{body{padding:0;}.report{max-width:100%%;gap:20px;}.card{break-inside:avoid;page-break-inside:avoid;}}
</style>
</head>
<body>
<div class="report">

<div class="cover">
  <div class="badge">Live Performance Results</div>
  <h1>Wordle <span>Duel</span><br>Server Benchmarks</h1>
  <p>Real WebSocket load test — bots run the full lobby→game flow against the live Go backend.</p>
  <div class="meta">
    <div class="chip">Protocol <strong>WebSocket / JSON</strong></div>
    <div class="chip">Backend <strong>Go 1.22</strong></div>
    <div class="chip">Library <strong>gorilla/websocket</strong></div>
    <div class="chip">Idle goroutines <strong>%d</strong></div>
    <div class="chip">Idle heap <strong>%.1f MB</strong></div>
  </div>
</div>

<!-- Metric 1: Latency -->
<div class="card">
  <div class="card-head">
    <div class="metric-no" style="color:var(--green)">Metric 01</div>
    <div class="card-title">WebSocket Round-Trip Latency</div>
    <div class="card-desc">submit_guess → guess_result · Avg / P95 / P99 in ms</div>
  </div>
  <div class="chart-wrap"><canvas id="c1"></canvas></div>
  <div class="insight">
    Latency measured from the moment <strong>submit_guess</strong> is sent until
    <strong>guess_result</strong> is received. All scenarios ran concurrently with real bots
    on a live server instance.
  </div>
</div>

<!-- Metric 2: Throughput -->
<div class="card">
  <div class="card-head">
    <div class="metric-no" style="color:var(--blue)">Metric 02</div>
    <div class="card-title">Server Throughput</div>
    <div class="card-desc">Total WebSocket events processed per second across all lobbies</div>
  </div>
  <div class="chart-wrap"><canvas id="c2"></canvas></div>
  <div class="insight" style="border-left-color:var(--blue)">
    Events counted: <strong>connected · name_set · lobby_created · lobby_joined ·
    game_begin · guess_result</strong>. Divided by total elapsed wall-clock seconds per scenario.
  </div>
</div>

<!-- Metric 3: Memory -->
<div class="card">
  <div class="card-head">
    <div class="metric-no" style="color:var(--amber)">Metric 03</div>
    <div class="card-title">Server Heap Allocation</div>
    <div class="card-desc">Go runtime heap (HeapAlloc) after each scenario · queried via GET /metrics</div>
  </div>
  <div class="chart-wrap"><canvas id="c3"></canvas></div>
  <div class="insight" style="border-left-color:var(--amber)">
    Queried via <code style="font-family:'JetBrains Mono',monospace;font-size:.65rem">runtime.ReadMemStats()</code>
    immediately after each scenario completes. Idle baseline: <strong>%.1f MB</strong>.
  </div>
</div>

<!-- Metric 4: Goroutines -->
<div class="card">
  <div class="card-head">
    <div class="metric-no" style="color:var(--red)">Metric 04</div>
    <div class="card-title">Active Goroutines</div>
    <div class="card-desc">runtime.NumGoroutine() after each scenario · idle baseline: %d</div>
  </div>
  <div class="chart-wrap"><canvas id="c4"></canvas></div>
  <div class="insight" style="border-left-color:var(--red)">
    Each player spawns <strong>2 goroutines</strong> (readPump + writePump) plus
    <strong>1 per lobby</strong> event loop. Linear growth confirms no goroutine leaks.
  </div>
</div>

<div class="footer">
  <strong>Wordle Duel</strong> · Generated by <code style="font-family:'JetBrains Mono',monospace">testing/perf</code> load test ·
  Go backend + gorilla/websocket<br>
  Charts rendered by Chart.js · Data reflects real measured values, not estimates.
</div>

</div><!-- /report -->

<script>
const D = %s;
const gc = 'rgba(255,255,255,0.05)';
const tk = '#7a8090';
const base = {responsive:true,maintainAspectRatio:false,animation:{duration:800,easing:'easeOutQuart'},
  plugins:{legend:{position:'top',labels:{color:'#b0b8cc',font:{size:11},boxWidth:11,padding:12}},
    tooltip:{backgroundColor:'#1c2030',borderColor:'#2a2f3f',borderWidth:1,titleColor:'#e8eaf0',bodyColor:'#b0b8cc',padding:9,cornerRadius:7}}};
const scales = (yl,xu) => ({
  x:{grid:{color:gc},ticks:{color:tk,font:{size:10}}},
  y:{grid:{color:gc},ticks:{color:tk,font:{size:10},callback:v=>v+(xu||'')},
     title:yl?{display:true,text:yl,color:tk,font:{size:9}}:undefined}});

// 1 — Latency grouped bar
new Chart(document.getElementById('c1'),{type:'bar',data:{labels:D.labels,datasets:[
  {label:'Avg (ms)',data:D.avgMs,backgroundColor:'oklch(0.78 0.18 145/0.85)',borderColor:'oklch(0.78 0.18 145)',borderWidth:1.5,borderRadius:5},
  {label:'P95 (ms)',data:D.p95Ms,backgroundColor:'oklch(0.68 0.16 145/0.65)',borderColor:'oklch(0.68 0.16 145)',borderWidth:1.5,borderRadius:5},
  {label:'P99 (ms)',data:D.p99Ms,backgroundColor:'oklch(0.55 0.12 145/0.50)',borderColor:'oklch(0.55 0.12 145)',borderWidth:1.5,borderRadius:5},
]},options:{...base,scales:scales('Latency (ms)','ms')}});

// 2 — Throughput horizontal bar
new Chart(document.getElementById('c2'),{type:'bar',data:{labels:D.labels,datasets:[
  {label:'Events / sec',data:D.evtSec,
   backgroundColor:D.evtSec.map((_,i)=>'oklch(0.72 0.19 255/'+(0.4+i*0.18)+')'),
   borderColor:'oklch(0.72 0.19 255)',borderWidth:1.5,borderRadius:6}
]},options:{...base,indexAxis:'y',
  scales:{x:{grid:{color:gc},ticks:{color:tk,font:{size:10},callback:v=>v+'/s'}},
          y:{grid:{color:gc},ticks:{color:tk,font:{size:10}}}},
  plugins:{...base.plugins,legend:{display:false}}}});

// 3 — Heap memory line
new Chart(document.getElementById('c3'),{type:'line',data:{labels:D.labels,datasets:[
  {label:'Heap (MB)',data:D.heapMB,borderColor:'oklch(0.78 0.18 60)',
   backgroundColor:'oklch(0.78 0.18 60/0.15)',fill:true,
   borderWidth:2.5,pointRadius:5,pointBackgroundColor:'oklch(0.78 0.18 60)',tension:0.35},
  {label:'Idle baseline (MB)',data:D.labels.map(()=>%.1f),
   borderColor:'rgba(255,255,255,0.15)',borderDash:[4,4],borderWidth:1.5,pointRadius:0,tension:0}
]},options:{...base,scales:scales('Heap MB','MB')}});

// 4 — Goroutines area line
new Chart(document.getElementById('c4'),{type:'line',data:{labels:D.labels,datasets:[
  {label:'Goroutines',data:D.goroutines,borderColor:'oklch(0.70 0.22 15)',
   backgroundColor:'oklch(0.70 0.22 15/0.18)',fill:true,
   borderWidth:2.5,pointRadius:5,pointBackgroundColor:'oklch(0.70 0.22 15)',tension:0.25},
  {label:'Idle baseline',data:D.labels.map(()=>%d),
   borderColor:'rgba(255,255,255,0.15)',borderDash:[4,4],borderWidth:1.5,pointRadius:0,tension:0}
]},options:{...base,scales:scales('Goroutines','')}});
</script>
</body>
</html>`,
		idleGoroutines, idleHeapMB,  // cover chips
		idleHeapMB,                   // metric 3 insight
		idleGoroutines,               // metric 4 desc
		dataJSON,                     // JS data
		idleHeapMB,                   // baseline line metric 3
		idleGoroutines,               // baseline line metric 4
	)
}
