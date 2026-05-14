import React, { useState, useCallback } from 'react';
import { analyzeData, MEDIA_DISPLAY } from './utils/parseData';
import './App.css';

const TABS = Object.keys(MEDIA_DISPLAY);

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

function UploadBox({ label, file, onChange, color }) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(e => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onChange(f);
  }, [onChange]);

  return (
    <div
      className={`upload-box ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
      style={{ '--accent': color }}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => document.getElementById(`input-${label}`).click()}
    >
      <input
        id={`input-${label}`}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={e => e.target.files[0] && onChange(e.target.files[0])}
      />
      <div className="upload-icon">{file ? '✓' : '↑'}</div>
      <div className="upload-label">{label}</div>
      <div className="upload-filename">
        {file ? file.name : '点击或拖拽上传 CSV 文件'}
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
      <div className="summary-item">
        <span className="summary-num">{totalEvents}</span>
        <span className="summary-desc">事件总数</span>
      </div>
      <div className={`summary-item ${anomalyCount > 0 ? 'anomaly' : 'ok'}`}>
        <span className="summary-num">{anomalyCount}</span>
        <span className="summary-desc">异常事件</span>
      </div>
      <div className="summary-item">
        <span className="summary-num">{formatUsers(overall.yActive)}</span>
        <span className="summary-desc">昨日 Active 用户</span>
      </div>
      <div className="summary-item">
        <span className="summary-num">{formatUsers(overall.sActive)}</span>
        <span className="summary-desc">7日 Active 用户</span>
      </div>
    </div>
  );
}

function EventTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <div className="empty">该媒体无数据</div>;
  }

  return (
    <div className="table-wrap">
      <table className="event-table">
        <thead>
          <tr>
            <th className="col-event">事件名称</th>
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
            <tr key={row.event} className={row.isAnomaly ? 'row-anomaly' : ''}>
              <td className="col-event">
                <span className="event-name">{row.event}</span>
              </td>
              <td>{formatUsers(row.yUsers)}</td>
              <td className={row.isAnomaly ? 'pct-anomaly' : ''}>{formatPct(row.yRatio)}</td>
              <td>{formatUsers(row.sUsers)}</td>
              <td>{formatPct(row.sRatio)}</td>
              <td className={`diff-cell ${row.diff !== null ? (row.diff >= 0 ? 'diff-up' : 'diff-down') : ''}`}>
                {formatDiff(row.diff)}
              </td>
              <td>
                {row.isAnomaly
                  ? <span className="badge badge-anomaly">⚠ 异常</span>
                  : row.diff !== null
                    ? <span className="badge badge-ok">正常</span>
                    : <span className="badge badge-na">—</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [yesterdayFile, setYesterdayFile] = useState(null);
  const [sevenDayFile, setSevenDayFile] = useState(null);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('overall');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const readFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });

  const handleAnalyze = async () => {
    if (!yesterdayFile || !sevenDayFile) return;
    setLoading(true);
    setError(null);
    try {
      const [yText, sText] = await Promise.all([
        readFile(yesterdayFile),
        readFile(sevenDayFile),
      ]);
      const data = analyzeData(yText, sText);
      setResult(data);
      setActiveTab('overall');
    } catch (e) {
      setError('解析失败，请检查 CSV 文件格式是否正确');
      console.error(e);
    }
    setLoading(false);
  };

  const handleReset = () => {
    setResult(null);
    setYesterdayFile(null);
    setSevenDayFile(null);
    setError(null);
  };

  const tabData = result?.[activeTab];
  const anomalyCountForTab = tabData?.rows?.filter(r => r.isAnomaly).length ?? 0;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="logo">📊</div>
          <div>
            <h1>AF 用户流失监控</h1>
            <p>对比昨日 vs 过去7天的事件转化率，自动识别异常</p>
          </div>
        </div>
        {result && (
          <button className="btn-reset" onClick={handleReset}>重新上传</button>
        )}
      </header>

      {!result ? (
        <div className="upload-section">
          <div className="upload-grid">
            <UploadBox
              label="昨日数据"
              file={yesterdayFile}
              onChange={setYesterdayFile}
              color="#3b82f6"
            />
            <UploadBox
              label="过去7日数据"
              file={sevenDayFile}
              onChange={setSevenDayFile}
              color="#8b5cf6"
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button
            className="btn-analyze"
            disabled={!yesterdayFile || !sevenDayFile || loading}
            onClick={handleAnalyze}
          >
            {loading ? '分析中...' : '开始分析'}
          </button>

          <div className="upload-hint">
            <p>📌 使用说明</p>
            <ul>
              <li>从 AppsFlyer 事件面板分别导出「昨日」和「过去7日」的汇总绩效报告（CSV格式）</li>
              <li>转化率 = 各事件独立用户数 ÷ vgsdk_af_app_active 独立用户数</li>
              <li>昨日转化率比7日转化率下降超过 <strong>3%</strong> 则标记为异常</li>
              <li>支持媒体：Organic、Facebook、ASA、TikTok、Google</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="result-section">
          <SummaryBar data={result} />

          <div className="tabs">
            {TABS.map(tab => {
              const count = result[tab]?.rows?.filter(r => r.isAnomaly).length ?? 0;
              const hasData = result[tab]?.rows?.length > 0;
              return (
                <button
                  key={tab}
                  className={`tab ${activeTab === tab ? 'active' : ''} ${count > 0 ? 'has-anomaly' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {MEDIA_DISPLAY[tab]}
                  {hasData && count > 0 && (
                    <span className="tab-badge">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="tab-content">
            <div className="tab-header">
              <div className="tab-title">
                {MEDIA_DISPLAY[activeTab]}
                <span className="tab-active-info">
                  昨日 Active: <strong>{formatUsers(tabData?.yActive)}</strong>
                  &nbsp;｜ 7日 Active: <strong>{formatUsers(tabData?.sActive)}</strong>
                </span>
              </div>
              {anomalyCountForTab > 0 && (
                <div className="anomaly-summary">
                  ⚠ 发现 <strong>{anomalyCountForTab}</strong> 个异常事件（转化率下降 &gt;3%）
                </div>
              )}
            </div>
            <EventTable rows={tabData?.rows} />
          </div>
        </div>
      )}
    </div>
  );
}
