import React, { useState, useCallback } from 'react';
import { analyzeData, MEDIA_DISPLAY } from './utils/parseData';
import './App.css';

const PRIORITY_TABS = ['overall', 'organic', 'Facebook Ads', 'googleadwords_int', 'Apple Search Ads', 'tiktokglobal_int'];

function formatPct(val) {
  if (val === null || val === undefined) return '—';
  return (val * 100).toFixed(1) + '%';
}

function formatDiff(val) {
  if (val === null || val === undefined) return '—';
  const pct = (val * 100).toFixed(1);
  return (val >= 0 ? '+' : '') + pct + '%';
}

function formatUsers(val) {
  if (val === null || val === undefined) return '—';
  return val.toLocaleString();
}

function UploadBox({ label, sublabel, file, onChange, accent }) {
  const [dragging, setDragging] = useState(false);
  const id = `input-${label}`;

  const handleDrop = useCallback(e => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onChange(f);
  }, [onChange]);

  return (
    <div
      className={`upload-card ${dragging ? 'dragging' : ''} ${file ? 'ready' : ''}`}
      style={{ '--accent': accent }}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => document.getElementById(id).click()}
    >
      <input id={id} type="file" accept=".csv" style={{ display: 'none' }}
        onChange={e => e.target.files[0] && onChange(e.target.files[0])} />
      <div className="uc-top">
        <div className="uc-dot" />
        <span className="uc-label">{label}</span>
      </div>
      <div className="uc-body">
        {file ? (
          <>
            <div className="uc-check">✓</div>
            <div className="uc-filename">{file.name}</div>
          </>
        ) : (
          <>
            <div className="uc-icon">↑</div>
            <div className="uc-sub">{sublabel}</div>
          </>
        )}
      </div>
      <div className="uc-footer">
        {file ? '点击重新选择' : '点击或拖拽 CSV 文件'}
      </div>
    </div>
  );
}

function SummaryBar({ data }) {
  const overall = data['overall'];
  if (!overall) return null;
  const anomalyCount = overall.rows.filter(r => r.isAnomaly).length;
  const totalEvents = overall.rows.length;

  return (
    <div className="summary-bar">
      <div className="s-card">
        <div className="s-val">{totalEvents}</div>
        <div className="s-key">事件总数</div>
      </div>
      <div className={`s-card ${anomalyCount > 0 ? 's-red' : 's-green'}`}>
        <div className="s-val">{anomalyCount}</div>
        <div className="s-key">异常事件</div>
      </div>
      <div className="s-card">
        <div className="s-val">{formatUsers(overall.yActive)}</div>
        <div className="s-key">昨日 Active</div>
      </div>
      <div className="s-card">
        <div className="s-val">{formatUsers(overall.sActive)}</div>
        <div className="s-key">7日 Active</div>
      </div>
    </div>
  );
}

function EventTable({ rows }) {
  if (!rows || rows.length === 0) return <div className="empty">该媒体暂无数据</div>;
  return (
    <div className="table-wrap">
      <table className="event-table">
        <thead>
          <tr>
            <th className="th-event">事件名称</th>
            <th>昨日用户数</th>
            <th>昨日转化率</th>
            <th>7日用户数</th>
            <th>7日转化率</th>
            <th>变化幅度</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.event} className={row.isAnomaly ? 'tr-anomaly' : ''}>
              <td className="td-event">{row.event}</td>
              <td>{formatUsers(row.yUsers)}</td>
              <td className={row.isAnomaly ? 'td-red' : ''}>{formatPct(row.yRatio)}</td>
              <td>{formatUsers(row.sUsers)}</td>
              <td>{formatPct(row.sRatio)}</td>
              <td className={`td-diff ${row.diff !== null ? (row.diff >= 0 ? 'td-up' : 'td-down') : ''}`}>
                {formatDiff(row.diff)}
              </td>
              <td>
                {row.isAnomaly
                  ? <span className="badge b-red">⚠ 异常</span>
                  : row.diff !== null
                    ? <span className="badge b-green">正常</span>
                    : <span className="badge b-muted">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [yFile, setYFile] = useState(null);
  const [sFile, setSFile] = useState(null);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('overall');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const readFile = f => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = rej;
    r.readAsText(f, 'UTF-8');
  });

  const handleAnalyze = async () => {
    if (!yFile || !sFile) return;
    setLoading(true); setError(null);
    try {
      const [yText, sText] = await Promise.all([readFile(yFile), readFile(sFile)]);
      const data = analyzeData(yText, sText);
      setResult(data);
      setActiveTab('overall');
    } catch (e) {
      setError('解析失败，请检查 CSV 文件格式');
      console.error(e);
    }
    setLoading(false);
  };

  const handleReset = () => { setResult(null); setYFile(null); setSFile(null); setError(null); };

  const buildTabs = data => {
    const keys = Object.keys(data);
    const pri = PRIORITY_TABS.filter(k => keys.includes(k));
    const rest = keys.filter(k => !PRIORITY_TABS.includes(k)).sort();
    return [...pri, ...rest];
  };

  const tabs = result ? buildTabs(result) : [];
  const tabData = result?.[activeTab];
  const anomalyCount = tabData?.rows?.filter(r => r.isAnomaly).length ?? 0;
  const getLabel = k => MEDIA_DISPLAY[k] || k;

  return (
    <div className="app">
      {/* BG decoration */}
      <div className="bg-grad" />

      <header className="header">
        <div className="header-brand">
          <div className="brand-icon">AF</div>
          <div>
            <h1>用户流失监控</h1>
            <p>AppsFlyer · 昨日 vs 过去7天 · 事件转化率对比</p>
          </div>
        </div>
        {result && <button className="btn-ghost" onClick={handleReset}>↩ 重新上传</button>}
      </header>

      {!result ? (
        <div className="upload-page">
          <div className="upload-intro">
            <h2>上传数据文件</h2>
            <p>分别上传昨日和过去7日的 AF 汇总绩效报告（CSV 格式）</p>
          </div>

          <div className="upload-grid">
            <UploadBox label="昨日数据" sublabel="Yesterday" file={yFile} onChange={setYFile} accent="#4f8ef7" />
            <UploadBox label="过去7日数据" sublabel="Last 7 Days" file={sFile} onChange={setSFile} accent="#a78bfa" />
          </div>

          {error && <div className="error-bar">{error}</div>}

          <button className="btn-analyze" disabled={!yFile || !sFile || loading} onClick={handleAnalyze}>
            {loading ? <span className="btn-loading">分析中<span className="dots" /></span> : '开始分析 →'}
          </button>

          <div className="hint-box">
            <div className="hint-title">使用说明</div>
            <div className="hint-row"><span className="hint-num">1</span><span>从 AF 事件面板分别导出昨日和7日的汇总绩效报告</span></div>
            <div className="hint-row"><span className="hint-num">2</span><span>转化率 = 各事件独立用户数 ÷ <code>vgsdk_af_app_active</code> 独立用户数</span></div>
            <div className="hint-row"><span className="hint-num">3</span><span>昨日转化率比7日转化率<strong>下降超过 3%</strong> 自动标记为异常</span></div>
          </div>
        </div>
      ) : (
        <div className="result-page">
          <SummaryBar data={result} />

          <div className="tabs-row">
            {tabs.map(tab => {
              const cnt = result[tab]?.rows?.filter(r => r.isAnomaly).length ?? 0;
              return (
                <button key={tab}
                  className={`tab-btn ${activeTab === tab ? 'tab-active' : ''} ${cnt > 0 ? 'tab-warn' : ''}`}
                  onClick={() => setActiveTab(tab)}>
                  {getLabel(tab)}
                  {cnt > 0 && <span className="tab-cnt">{cnt}</span>}
                </button>
              );
            })}
          </div>

          <div className="table-card">
            <div className="table-card-header">
              <div className="tch-left">
                <span className="tch-title">{getLabel(activeTab)}</span>
                <span className="tch-meta">
                  昨日 Active <strong>{formatUsers(tabData?.yActive)}</strong>
                  <span className="tch-sep">·</span>
                  7日 Active <strong>{formatUsers(tabData?.sActive)}</strong>
                </span>
              </div>
              {anomalyCount > 0 && (
                <div className="anomaly-pill">⚠ {anomalyCount} 个异常</div>
              )}
            </div>
            <EventTable rows={tabData?.rows} />
          </div>
        </div>
      )}
    </div>
  );
}
